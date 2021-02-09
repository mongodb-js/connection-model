const { MongoClient } = require('mongodb');
const createSSHTunnel = require('./ssh-tunnel');
const Connection = require('./extended-model');
const fs = require('fs');
const { promisify } = require('util');

const debug = require('debug')('mongodb-connection-model:connect');

/* Some of the SSL options can be arrays with one file path in them.
 * This method returns the options so that those arrays are instead just
 * a string that is the first item in the array.
 **/
const flattenSSLOptions = (driverOptions) => {
  const flattenedOptions = {};

  ['sslCA', 'sslCert', 'sslKey'].forEach((key) => {
    const option = driverOptions[key];
    if (Array.isArray(option)) {
      flattenedOptions[key] = option[0];
    } else if (option) {
      flattenedOptions[key] = option;
    }
  });

  return flattenedOptions;
};

const getSSLFileOptionsAsBuffers = async(driverOptions) => {
  const sslOptions = {
    ...flattenSSLOptions(driverOptions)
  };

  await Promise.all(Object.keys(sslOptions).map(async(key) => {
    const runReadFile = promisify(fs.readFile);
    sslOptions[key] = await runReadFile(sslOptions[key]);
  }));

  return sslOptions;
};

const createConnectionOptions = async(model) => {
  const sslFileOptionsAsBuffers = await getSSLFileOptionsAsBuffers(
    model.driverOptions
  );

  const options = {
    ...model.driverOptions,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    ...sslFileOptionsAsBuffers
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
    options.directConnection = true;
  }

  delete options.auth;

  return options;
};

/**
 * Make sure the driver doesn't puke on the URL and cause
 * an uncaughtException.
 *
 * @param {Connection | Object} connectionModel
 * @param {Function} setupListeners - A function to be called with the
 * mongoClient to listen to SDAM events.
 * @returns {Array} The first index being an error, if there's no error,
 * the second index is the client, and the third is the connectionOptions.
 */
const connect = async(connectionModel, setupListeners) => {
  let model;
  if (connectionModel.serialize === undefined) {
    model = new Connection(model);
  } else {
    model = connectionModel;
  }

  const connectionOptions = await createConnectionOptions(model);

  let tunnel;

  if (model.sshTunnel !== 'NONE') {
    debug('creating SSH tunnel');
    try {
      tunnel = await createSSHTunnel(model);
    } catch (error) {
      debug('unable to create SSH tunnel:', error);
      throw error;
    }
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
  } catch (error) {
    debug('error connecting to MongoDB:', error);
    if (tunnel) {
      debug('data-service connection error, shutting down ssh tunnel');
      tunnel.close();
    }

    throw new Error(error);
  }

  return [
    client,
    {
      url: model.driverUrlWithSsh,
      options: connectionOptions
    }
  ];
};

module.exports = connect;
module.exports.createConnectionOptions = createConnectionOptions;
