/* eslint no-console:0 */
const assert = require('assert');
const Connection = require('../');
const connect = Connection.connect;
const mock = require('mock-require');
const sinon = require('sinon');

const setupListeners = () => {};

// TODO: These instances are now turned off
const data = require('mongodb-connection-fixture');

describe('mongodb-connection#connect', () => {
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

    describe('ssh tunnel failures', () => {
      const spy = sinon.spy();

      mock('../lib/ssh-tunnel', (model, cb) => {
        // simulate successful tunnel creation
        cb();
        // then return a mocked tunnel object with a spy close() function
        return {close: spy};
      });

      const MockConnection = mock.reRequire('../lib/extended-model');
      const mockConnect = mock.reRequire('../lib/connect');

      it('should close ssh tunnel if the connection fails', (done) => {
        const model = new MockConnection({
          hostname: 'localhost',
          port: '27017',
          sshTunnel: 'USER_PASSWORD',
          sshTunnelHostname: 'my.ssh-server.com',
          sshTunnelPassword: 'password',
          sshTunnelUsername: 'my-user'
        });

        assert(model.isValid());
        mockConnect(model, setupListeners, (err) => {
          // must throw error here, because the connection details are invalid
          assert.ok(err);
          console.log(err.message);
          assert.ok(/ECONNREFUSED/.test(err.message));
          // assert that tunnel.close() was called once
          assert.ok(spy.calledOnce);
          done();
        });
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
