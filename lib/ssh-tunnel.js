var assert = require('assert');
var ssh2 = require('ssh2');
var net = require('net');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var debug = require('debug')('mongodb-connection-model:ssh-tunnel');
var async = require('async');

function SSHTunnel(model) {
  assert(model.hostname, 'hostname required');
  assert(model.port, 'port required');

  this.model = model;
  this.options = this.model.ssh_tunnel_options;
}
inherits(SSHTunnel, EventEmitter);

SSHTunnel.prototype.createTunnel = function(done) {
  var hadError = null;

  const onStartupError = function(err) {
    hadError = err;
    debug('ssh tunnel startup error', err);
    done(err);
  };

  this.tunnel = new ssh2.Client();
  this.tunnel.on('end', function() {
    debug('ssh tunnel is disconnected.');
  })
  .on('close', (closeError) => {
    if (!hadError && closeError) {
      hadError = closeError;
    }

    if (hadError) {
      debug('ssh tunnel is closed due to errors.');
    } else {
      debug('ssh tunnel is closed.');
    }
    this.tunnel.end();
  })
  .on('error', onStartupError)
  .on('ready', () => {
    debug('ssh tunnel is ready.');
    this.tunnel.removeListener('error', onStartupError);
    done();
  })
  .connect(this.options);
  return this.tunnel;
};

SSHTunnel.prototype.forward = function(done) {
  var timedOut = false;
  var timeout = setTimeout(() => {
    timedOut = true;
    this.tunnel.end();
    done(new Error('Timed out while waiting for forwardOut'));
  }, this.options.forwardTimeout);

  const onForward = (err, stream) => {
    if (timedOut) {
      debug('port forward timed out.');
      return null;
    }

    clearTimeout(timeout);

    if (err) {
      this.tunnel.end();
      return done(err);
    }

    stream.on('close', () => debug('port forward stream is closed.'));

    debug('port forward stream is ready.');
    done(null, stream);
  };

  this.tunnel.forwardOut(this.options.srcAddr, this.options.srcPort,
    this.options.dstAddr, this.options.dstPort, onForward);
};

SSHTunnel.prototype.createServer = function(done) {
  this.server = net.createServer((connection) => {
    this.forward((err, stream) => {
      if (err) {
        return done(err);
      }
      connection.pipe(stream).pipe(connection);
      debug('tunnel pipeline created.');

      stream.on('close', () => {
        debug('closing server');
        this.server.close();
      });
    });
  })
  .on('error', (err) => {
    done(err);
    this.tunnel.end();
  })
  .on('close', () => this.tunnel.end())
  .listen(this.options.localPort, this.options.localAddr, () => {
    debug('local tcp server listening.');
    this.emit('status', {
      message: 'Create SSH Tunnel',
      complete: true
    });
    done();
  });
  return this.server;
};

SSHTunnel.prototype.listen = function(done) {
  this.emit('status', {
    message: 'Create SSH Tunnel',
    pending: true
  });
  async.series([
    this.createTunnel.bind(this),
    this.forward.bind(this),
    this.createServer.bind(this)
  ], done);

  return this;
};

SSHTunnel.prototype.close = function() {
  this.emit('status', {
    message: 'Closing SSH Tunnel'
  });

  if (this.tunnel) {
    this.tunnel.end();
  }
};

module.exports = function(model, done) {
  var tunnel = new SSHTunnel(model);
  if (model.ssh_tunnel === 'NONE') {
    done();
    return tunnel;
  }

  tunnel.listen(done);
  return tunnel;
};
