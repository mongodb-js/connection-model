const { MongoClient } = require('mongodb');
const createSSHTunnel = require('./ssh-tunnel');
const { promisify } = require('util');

const debug = require('debug')('mongodb-connection-model:connect');

const createConnectionOptions = (model) => {
  const options = {
    ...model.driverOptions,
    useNewUrlParser: true,
    useUnifiedTopology: true
  };

  if (
    model.directConnection === undefined &&
    (!model.hosts || model.hosts.length === 1) &&
    !model.isSrvRecord &&
    (model.replicaSet === undefined || model.replicaSet === '')
  ) {
    // Previous to the node driver 3.6.3, directConnection was
    // set to true under these conditions. In 3.6.3 this defaulting
    // behavior was removed and now we add it. COMPASS-4534
    // https://github.com/mongodb/node-mongodb-native/commit/f8fd310a11a91db82f1c0ddc57482b8edabc231b
    options.directConnection = true;
  }

  delete options.auth;

  return options;
};

/**
 * Make sure the driver doesn't puke on the URL and cause
 * an uncaughtException.
 *
 * @param {Connection} model
 * @param {Function} setupListeners - A function to be called with the
 * mongoClient to listen to SDAM events.
 * @returns {Array} The first index being an error, if there's no error,
 * the second index is the client, and the third is the connectionOptions.
 */
const connect = async(model, setupListeners) => {
  const connectionOptions = createConnectionOptions(model);

  let tunnel;

  if (model.sshTunnel !== 'NONE') {
    debug('creating SSH tunnel');
    const runCreateSSHTunnel = promisify(createSSHTunnel);
    tunnel = await runCreateSSHTunnel(model);
    debug('created SSH tunnel');
  }

  debug('connecting to MongoDB');

  let client;
  try {
    const mongoClient = new MongoClient(
      model.driverUrlWithSsh,
      connectionOptions
    );

    if (setupListeners) {
      setupListeners(mongoClient);
    }

    client = await mongoClient.connect();

    debug('connected to MongoDB');

    if (tunnel) {
      client.on('close', () => {
        debug('data-service disconnected. shutting down ssh tunnel');
        tunnel.close();
      });
    }
  } catch (err) {
    debug('error connecting to MongoDB:', err);
    if (tunnel) {
      debug('data-service connection error, shutting down ssh tunnel');
      tunnel.close();
    }

    return [
      err
    ];
  }

  return [
    null, // No error.
    client,
    {
      url: model.driverUrlWithSsh,
      options: connectionOptions
    }
  ];
};

module.exports = connect;
