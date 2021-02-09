const assert = require('assert');
const Connection = require('../');
const connect = Connection.connect;
const { createConnectionOptions } = require('../lib/connect');
const mock = require('mock-require');
const sinon = require('sinon');
const fixture = require('mongodb-connection-fixture');
const fs = require('fs');

const setupListeners = () => {};

// TODO: These instances are now turned off
const data = require('mongodb-connection-fixture');
const { expect } = require('chai');

describe('connection model connector', () => {
  describe('#createConnectionOptions', () => {
    let expectedCA;
    let expectedClient;

    before(() => {
      /* eslint-disable no-sync */
      expectedCA = fs.readFileSync(fixture.ssl.ca);
      expectedClient = fs.readFileSync(fixture.ssl.client);
      /* eslint-enable no-sync */
    });


    it('should load ssl files into buffers', async() => {
      const model = new Connection({
        sslMethod: 'ALL',
        sslCA: fixture.ssl.ca,
        sslCert: fixture.ssl.client,
        sslKey: fixture.ssl.client
      });

      const connectionOptions = await createConnectionOptions(model);

      expect(
        connectionOptions.sslCA
      ).to.deep.equal(expectedCA);
      expect(
        connectionOptions.sslCert
      ).to.deep.equal(expectedClient);
      expect(
        connectionOptions.sslKey
      ).to.deep.equal(expectedClient);
    });

    it('should load ssl files that are arrays into buffers', async() => {
      const model = new Connection({
        sslMethod: 'ALL',
        sslCA: [fixture.ssl.ca],
        sslCert: [fixture.ssl.client],
        sslKey: [fixture.ssl.client]
      });

      const connectionOptions = await createConnectionOptions(model);

      /* eslint-disable no-sync */
      expectedCA = fs.readFileSync(fixture.ssl.ca);
      expectedClient = fs.readFileSync(fixture.ssl.client);
      /* eslint-enable no-sync */

      expect(
        connectionOptions.sslCA
      ).to.deep.equal(expectedCA);
      expect(
        connectionOptions.sslCert
      ).to.deep.equal(expectedClient);
      expect(
        connectionOptions.sslKey
      ).to.deep.equal(expectedClient);
    });
  });

  describe('local', () => {
    before(
      require('mongodb-runner/mocha/before')({ port: 27018, version: '4.0.0' })
    );

    after(
      require('mongodb-runner/mocha/after')({ port: 27018, version: '4.0.0' })
    );

    it('should return connection config when connected successfully', async() => {
      const model = await Connection.from('mongodb://localhost:27018');

      const [
        client,
        { url, options }
      ] = await connect(
        model,
        setupListeners
      );

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
        client
      ] = await connect(model, setupListeners);

      client.close(true);
    });

    it('should connect to `localhost:27018 with object`', async() => {
      const [ client ] = await connect(
        { port: 27018, host: 'localhost' },
        setupListeners
      );
      client.close(true);
    });

    describe('ssh tunnel failures', () => {
      const spy = sinon.spy();

      mock('../lib/ssh-tunnel', () => {
        // Return a mocked tunnel object with a spy close() function.
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
        try {
          await mockConnect(model, setupListeners);
          assert(false);
        } catch (err) {
          // Must throw error here, because the connection details are invalid.
          assert.ok(err);
          assert.ok(/ECONNREFUSED/.test(err.message));
          // Assert that tunnel.close() was called once.
          assert.ok(spy.calledOnce);
        }
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
