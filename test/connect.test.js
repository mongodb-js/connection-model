/* eslint no-console:0 */
const assert = require('assert');
const Connection = require('../');
const connect = Connection.connect;
const mock = require('mock-require');
const sinon = require('sinon');
const { promisify } = require('util');

const setupListeners = () => {};

// TODO: These instances are now turned off
const data = require('mongodb-connection-fixture');

describe('connection model connector', () => {
  describe('local', () => {
    before(
      require('mongodb-runner/mocha/before')({ port: 27018, version: '4.0.0' })
    );

    after(
      require('mongodb-runner/mocha/after')({ port: 27018, version: '4.0.0' })
    );

    it('should return connection config when connected successfully', async() => {
      // const buildConnection = promisify(Connection.from);
      const model = await Connection.from('mongodb://localhost:27018');

      const [
        connectErr,
        client,
        { url, options }
      ] = await connect(
        model,
        setupListeners
      );

      if (connectErr) throw connectErr;

      assert.strictEqual(
        url,
        'mongodb://localhost:27018/?readPreference=primary&ssl=false'
      );

      assert.deepStrictEqual(options, {
        connectWithNoPrimary: true,
        directConnection: true,
        readPreference: 'primary',
        useNewUrlParser: true,
        useUnifiedTopology: true
      });

      client.close(true);
    });

    it('should connect to `localhost:27018 with model`', async() => {
      // const buildConnection = promisify();
      const model = await Connection.from('mongodb://localhost:27018');

      const [
        connectErr,
        client
      ] = await connect(model, setupListeners);

      assert.equal(connectErr, null);
      client.close(true);
    });

    it('should connect to `localhost:27018 with object`', async() => {
      const [ err, client ] = await connect(
        { port: 27018, host: 'localhost' },
        setupListeners
      );
      assert.equal(err, null);
      client.close(true);
    });

    describe('ssh tunnel failures', () => {
      const spy = sinon.spy();

      mock('../lib/ssh-tunnel', (model, cb) => {
        // simulate successful tunnel creation
        cb();
        // then return a mocked tunnel object with a spy close() function
        return { close: spy };
      });

      const MockConnection = mock.reRequire('../lib/extended-model');
      const mockConnect = mock.reRequire('../lib/connect');

      it('should close ssh tunnel if the connection fails', async() => {
        const model = new MockConnection({
          hostname: 'localhost',
          port: 27020,
          sshTunnel: 'USER_PASSWORD',
          sshTunnelHostname: 'my.ssh-server.com',
          sshTunnelPassword: 'password',
          sshTunnelUsername: 'my-user',
          extraOptions: { serverSelectionTimeoutMS: 100 }
        });

        assert(model.isValid());
        const [ err ] = await mockConnect(model, setupListeners);

        // Must throw error here, because the connection details are invalid.
        assert.ok(err);
        assert.ok(/ECONNREFUSED/.test(err.message));
        // Assert that tunnel.close() was called once.
        assert.ok(spy.calledOnce);
      });
    });
  });

  describe('cloud #slow', () => {
    data.MATRIX.map((d) => {
      it.skip('should connect to ' + d.name, (done) => {
        connect(d, setupListeners, (err, client) => {
          if (err) {
            return done(err);
          }

          client.close(true);
          done();
        });
      });
    });

    data.SSH_TUNNEL_MATRIX.map((d) => {
      it.skip(`connects via the sshTunnel to ${d.sshTunnelHostname}`, (done) => {
        connect(d, setupListeners, (err, client) => {
          if (err) {
            return done(err);
          }

          client.close(true);
          done();
        });
      });
    });
  });
});
