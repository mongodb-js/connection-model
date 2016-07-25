var fs = require('fs');
var async = require('async');
var _ = require('lodash');
var MongoClient = require('mongodb').MongoClient;
var Connection = require('./model');
var parseURL = require('mongodb/lib/url_parser');
var debug = require('debug')('mongodb-connection-model:connect');

function loadOptions(model, done) {
  if (model.ssl === 'NONE' || model.ssl === 'UNVALIDATED') {
    process.nextTick(function() {
      done(null, model.driver_options);
    });
    return;
  }

  var tasks = {};
  var opts = _.clone(model.driver_options, true);
  Object.keys(opts.server).map(function(key) {
    if (key.indexOf('ssl') === -1) {
      return;
    }

    if (Array.isArray(opts.server[key])) {
      tasks[key] = function(cb) {
        async.parallel(opts.server[key].map(function(k) {
          return fs.readFile.bind(null, k);
        }), cb);
      };
    }

    if (typeof opts.server[key] !== 'string') {
      return;
    }
    if (key === 'sslPass') {
      return;
    }

    tasks[key] = fs.readFile.bind(null, opts.server[key]);
  });
  async.parallel(tasks, function(err, res) {
    if (err) {
      return done(err);
    }
    Object.keys(res).map(function(key) {
      opts.server[key] = res[key];
    });
    done(null, opts);
  });
}

/**
 * Make sure the driver doesn't puke on the URL and cause
 * an uncaughtException.
 *
 * @param {Connection} model
 * @param {Function} done
 */
function validateURL(model, done) {
  var url = model.driver_url;
  debug('validating URL with driver...');
  try {
    var res = parseURL(url);
    debug('URL parsed ok', res);
    done(null, url);
  } catch (e) {
    debug('error parsing URL', e);
    // URL parsing errors are just generic `Error` instances
    // so overwrite name so mongodb-js-server will know
    // the message is safe to display.
    e.name = 'MongoError';
    process.nextTick(function() {
      done(e);
    });
  }
}


function connect(model, done) {
  if (!(model instanceof Connection)) {
    model = new Connection(model);
  }
  debug('preparing model...');
  async.series([
    validateURL.bind(null, model),
    loadOptions.bind(null, model)
  ], function(err, args) {
    if (err) {
      debug('error preparing model', err);
      return done(err);
    }
    var url = args[0];
    var options = args[1];
    debug('model prepared!  calling driver.connect...');
    MongoClient.connect(url, options, done);
  });
}

}

exports.loadOptions = loadOptions;
exports.validateURL = validateURL;
exports.connect = connect;

module.exports = exports;
