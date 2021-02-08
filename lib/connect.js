const { EventEmitter } = require('events');
const async = require('async');
const {
  assign,
  isFunction,
  omit
} = require('lodash');
const { MongoClient } = require('mongodb');
const Connection = require('./extended-model');
const createSSHTunnel = require('./ssh-tunnel');

const debug = require('debug')('mongodb-connection-model:connect');

const getStatusStateString = (evt) => {
  if (!evt) {
    return 'UNKNOWN';
  }

  if (evt.pending) {
    return 'PENDING';
  }

  if (evt.skipped) {
    return 'SKIPPED';
  }

  if (evt.error) {
    return 'ERROR';
  }

  if (evt.complete) {
    return 'COMPLETE';
  }
};

const Tasks = {
  CreateSSHTunnel: 'Create SSH Tunnel',
  ConnectToMongoDB: 'Connect to MongoDB'
};

const getTasks = (model, setupListeners) => {
  const state = new EventEmitter();
  const tasks = {};
  const _statuses = {};
  let options = {
    ...model.driverOptions
  };
  let tunnel;
  let client;

  const status = (message, cb) => {
    if (_statuses[message]) {
      return _statuses[message];
    }

    const ctx = (error, opts) => {
      options = { ...model.driverOptions, ...opts };

      if (error) {
        state.emit('status', { message, error });

        if (cb) {
          return cb(error);
        }

        return error;
      }

      state.emit('status', { message, complete: true });

      if (cb) {
        return cb();
      }
    };

    ctx.skip = (reason) => {
      state.emit('status', { message, skipped: true, reason });

      if (cb) {
        return cb();
      }
    };

    if (!ctx._initialized) {
      state.emit('status', { message, pending: true });
      ctx._initialized = true;
    }

    return ctx;
  };

  /**
   * TODO (imlucas) If localhost, check if MongoDB installed -> no: click/prompt to download
   * TODO (imlucas) If localhost, check if MongoDB running -> no: click/prompt to start
   * TODO (imlucas) dns.lookup() model.hostname and model.sshTunnelHostname to check for typos
   */
  assign(tasks, {
    [Tasks.CreateSSHTunnel]: (cb) => {
      const ctx = status('Create SSH Tunnel', cb);

      if (model.sshTunnel === 'NONE') {
        return ctx.skip('The selected SSH Tunnel mode is NONE.');
      }

      tunnel = createSSHTunnel(model, ctx);
    }
  });

  assign(tasks, {
    [Tasks.ConnectToMongoDB]: (cb) => {
      const ctx = status('Connect to MongoDB');

      let validOptions = omit(options, 'auth');

      validOptions = {
        ...validOptions,
        useNewUrlParser: true,
        useUnifiedTopology: true
      };

      if (
        model.directConnection === undefined &&
        model.hosts.length === 1 &&
        !model.isSrvRecord &&
        (model.replicaSet === undefined || model.replicaSet === '')
      ) {
        // Previous to the node driver 3.6.3, directConnection was
        // set to true under these conditions. In 3.6.3 this defaulting
        // behavior was removed and now we add it. COMPASS-4534
        // https://github.com/mongodb/node-mongodb-native/commit/f8fd310a11a91db82f1c0ddc57482b8edabc231b
        validOptions.directConnection = true;
      }

      const mongoClient = new MongoClient(model.driverUrlWithSsh, validOptions);

      if (setupListeners) {
        setupListeners(mongoClient);
      }

      mongoClient.connect((err, _client) => {
        ctx(err);

        if (err) {
          if (tunnel) {
            debug('data-service connection error, shutting down ssh tunnel');
            tunnel.close();
          }

          return cb(err);
        }

        client = _client;

        if (tunnel) {
          client.on('close', () => {
            debug('data-service disconnected. shutting down ssh tunnel');
            tunnel.close();
          });
        }

        cb(null, { url: model.driverUrlWithSsh, options: validOptions });
      });
    }
  });

  /**
   * TODO (imlucas) Could have unintended consequences.
   */
  // _.assign(tasks, {
  //   'List Databases': function(cb) {
  //     var ctx = status('List Databases', cb);
  //     db.db('admin').command({listDatabases: 1},
  //       {readPreference: ReadPreference.secondaryPreferred}, ctx);
  //   }
  // });

  Object.defineProperties(tasks, {
    model: {
      get: () => model,
      enumerable: false
    },
    driverOptions: {
      get: () => options,
      enumerable: false
    },
    client: {
      get: () => client,
      enumerable: false
    },
    tunnel: {
      get: () => tunnel,
      enumerable: false
    },
    state: {
      get: () => state,
      enumerable: false
    }
  });

  return tasks;
};

const connect = (model, setupListeners, done) => {
  if (model.serialize === undefined) {
    model = new Connection(model);
  }

  if (!isFunction(done)) {
    done = (err) => {
      if (err) {
        throw err;
      }
    };
  }

  const tasks = getTasks(model, setupListeners);
  const logTaskStatus = require('debug')(
    'mongodb-connection-model:connect:status'
  );

  tasks.state.on('status', (evt) => {
    logTaskStatus('%s [%s]', evt.message, getStatusStateString(evt));
  });

  logTaskStatus('Connecting...');

  async.series(tasks, (err, tasksArgs) => {
    const connectionOptions = tasksArgs[Tasks.ConnectToMongoDB];

    if (err) {
      logTaskStatus('Error connecting:', err);

      return done(err);
    }

    logTaskStatus('Successfully connected');

    return done(null, tasks.client, connectionOptions);
  });

  return tasks.state;
};

module.exports = connect;
