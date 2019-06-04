/* eslint no-console:0 */
const assert = require('assert');
const Connection = require('../');
const connect = Connection.connect;

const setupListeners = () => {};

// TODO: These instances are now turned off
const data = require('mongodb-connection-fixture');

describe('connection model connector', () => {
  describe('local', function() {
    this.slow(2000);
    this.timeout(10000);

    before(require('mongodb-runner/mocha/before')({ port: 27018 }));

    after(require('mongodb-runner/mocha/after')({ port: 27018 }));

    it('should connect to `localhost:27018 with model`', (done) => {
      Connection.from('mongodb://localhost:27018', (parseErr, model) => {
        assert.equal(parseErr, null);
        connect(model, setupListeners, (connectErr) => {
          assert.equal(connectErr, null);
          done();
        });
      });
    });

    it('should connect to `localhost:27018 with object`', (done) => {
      connect({port: 27018, host: 'localhost'}, setupListeners, (err) => {
        assert.equal(err, null);
        done();
      });
    });
  });

  describe('cloud #slow', function() {
    this.slow(5000);
    this.timeout(10000);

    data.MATRIX.map((d) => {
      it.skip('should connect to ' + d.name, (done) => {
        connect(d, setupListeners, (err, _db) => {
          if (err) {
            return done(err);
          }

          _db.close();
          done();
        });
      });
    });

    data.SSH_TUNNEL_MATRIX.map((d) => {
      it.skip(`connects via the sshTunnel to ${d.sshTunnelHostname}`, (done) => {
        connect(d, setupListeners, (err, _db) => {
          if (err) {
            return done(err);
          }

          _db.close();
          done();
        });
      });
    });
  });
});
