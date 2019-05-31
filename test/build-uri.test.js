const Connection = require('../');
const chai = require('chai');
const fixture = require('mongodb-connection-fixture');
const fs = require('fs');
const expect = chai.expect;
const loadOptions = Connection.connect.loadOptions;
const getTasks = Connection.connect.getTasks;

chai.use(require('chai-subset'));

describe.only('connection model', () => {
  describe('should build URI', () => {
    it('with appname included', (done) => {
      const c = new Connection({ appname: 'My App' });

      expect(c.driverUrl).to.be.equal('mongodb://localhost:27017/?readPreference=primary&appname=My%20App&ssl=false');

      Connection.from(c.driverUrl, (error) => {
        expect(error).to.not.exist;
        done();
      });
    });

    it('with the replica set name included', () => {
      const c = new Connection({ isSrvRecord: true });

      expect(c.driverUrl).to.be.equal('mongodb+srv://localhost/?readPreference=primary&ssl=false');
    });

    it('when the connection is a srv record and ssl is default', (done) => {
      const c = new Connection({ appname: 'My App', replicaSet: 'testing' });

      expect(c.driverUrl).to.be.equal('mongodb://localhost:27017/?replicaSet=testing&readPreference=primary&appname=My%20App&ssl=false');

      Connection.from(c.driverUrl, (error) => {
        expect(error).to.not.exist;
        done();
      });
    });

    it('when the connection is a srv record and ssl is set to false', () => {
      const c = new Connection({ isSrvRecord: true, ssl: 'NONE' });

      expect(c.driverUrl).to.be.equal('mongodb+srv://localhost/?readPreference=primary&ssl=false');
    });

    it('when ssl is false/NONE', (done) => {
      const c = new Connection({ ssl: 'NONE' });

      expect(c.driverUrl).to.be.equal('mongodb://localhost:27017/?readPreference=primary&ssl=false');

      Connection.from(c.driverUrl, (error) => {
        expect(error).to.not.exist;
        done();
      });
    });

    it('when ssl is UNVALIDATED', (done) => {
      const c = new Connection({ ssl: 'UNVALIDATED' });
      const options = Object.assign(
        {},
        Connection.DRIVER_OPTIONS_DEFAULT,
        {
          checkServerIdentity: false,
          sslValidate: false,
          readPreference: 'primary',
          connectWithNoPrimary: true
        }
      );

      expect(c.driverUrl).to.be.equal('mongodb://localhost:27017/?readPreference=primary&ssl=true');
      expect(c.driverOptions).to.deep.equal(options);

      Connection.from(c.driverUrl, (error) => {
        expect(error).to.not.exist;
        done();
      });
    });

    it('when ssl is SYSTEMCA', (done) => {
      const c = new Connection({ ssl: 'SYSTEMCA' });
      const options = Object.assign(
        {},
        Connection.DRIVER_OPTIONS_DEFAULT,
        {
          checkServerIdentity: true,
          sslValidate: true,
          readPreference: 'primary',
          connectWithNoPrimary: true
        }
      );

      expect(c.driverUrl).to.be.equal('mongodb://localhost:27017/?readPreference=primary&ssl=true');
      expect(c.driverOptions).to.deep.equal(options);

      Connection.from(c.driverUrl, (error) => {
        expect(error).to.not.exist;
        done();
      });
    });

    it('when ssl is IFAVAILABLE', (done) => {
      const c = new Connection({ ssl: 'IFAVAILABLE' });
      const options = Object.assign(
        {},
        Connection.DRIVER_OPTIONS_DEFAULT,
        {
          checkServerIdentity: false,
          sslValidate: true,
          readPreference: 'primary',
          connectWithNoPrimary: true
        }
      );

      expect(c.driverUrl).to.be.equal('mongodb://localhost:27017/?readPreference=primary&ssl=prefer');
      expect(c.driverOptions).to.deep.equal(options);

      Connection.from(c.driverUrl, (error) => {
        expect(error).to.not.exist;
        done();
      });
    });

    it('when ssl is SERVER', (done) => {
      const c = new Connection({ ssl: 'SERVER', sslCA: fixture.ssl.ca });
      const options = Object.assign(
        {},
        Connection.DRIVER_OPTIONS_DEFAULT,
        {
          sslCA: [fixture.ssl.ca],
          sslValidate: true,
          readPreference: 'primary',
          connectWithNoPrimary: true
        }
      );

      expect(c.driverUrl).to.be.equal('mongodb://localhost:27017/?readPreference=primary&ssl=true');
      expect(c.driverOptions).to.deep.equal(options);

      Connection.from(c.driverUrl, (error) => {
        expect(error).to.not.exist;
        done();
      });
    });

    it('when ssl is ALL and using X509 auth', (done) => {
      const c = new Connection({
        ssl: 'ALL',
        sslCA: fixture.ssl.ca,
        sslCert: fixture.ssl.server,
        sslKey: fixture.ssl.server,
        authentication: 'X509',
        x509Username: 'testing'
      });
      const options = Object.assign(
        {},
        Connection.DRIVER_OPTIONS_DEFAULT,
        {
          sslCA: [fixture.ssl.ca],
          sslCert: fixture.ssl.server,
          sslKey: fixture.ssl.server,
          checkServerIdentity: false,
          sslValidate: false,
          readPreference: 'primary',
          connectWithNoPrimary: true
        }
      );

      expect(c.driverUrl).to.be.equal('mongodb://testing@localhost:27017/?readPreference=primary&authMechanism=MONGODB-X509&ssl=true');
      expect(c.driverOptions).to.deep.equal(options);

      Connection.from(c.driverUrl, (error) => {
        expect(error).to.not.exist;
        done();
      });
    });

    it('when ssl is ALL and passwordless private keys', (done) => {
      const c = new Connection({
        ssl: 'ALL',
        sslCA: fixture.ssl.ca,
        sslCert: fixture.ssl.server,
        sslKey: fixture.ssl.server
      });
      const options = Object.assign(
        {},
        Connection.DRIVER_OPTIONS_DEFAULT,
        {
          sslCA: [fixture.ssl.ca],
          sslCert: fixture.ssl.server,
          sslKey: fixture.ssl.server,
          sslValidate: true,
          readPreference: 'primary',
          connectWithNoPrimary: true
        }
      );

      expect(c.driverUrl).to.be.equal('mongodb://localhost:27017/?readPreference=primary&ssl=true');
      expect(c.driverOptions).to.deep.equal(options);

      /* eslint-disable no-sync */
      const expectAfterLoad = {
        sslCA: [fs.readFileSync(fixture.ssl.ca)],
        sslCert: fs.readFileSync(fixture.ssl.server),
        sslKey: fs.readFileSync(fixture.ssl.server),
        sslValidate: true,
        connectWithNoPrimary: true,
        readPreference: 'primary'
      };
      /* eslint-enable no-sync */
      const tasks = getTasks(c);
      // Trigger relevant side-effect, loading the SSL files into memory
      tasks['Load SSL files'](function() { // eslint-disable-line new-cap
        // Read files into memory as the connect function does
        expect(tasks.driverOptions).to.deep.equal(expectAfterLoad);
        done();
      });
    });

    it('when ssl is ALL and password protected private keys', (done) => {
      const c = new Connection({
        ssl: 'ALL',
        sslCA: fixture.ssl.ca,
        sslCert: fixture.ssl.server,
        sslKey: fixture.ssl.server,
        sslPass: 'woof'
      });
      const options = Object.assign(
        {},
        Connection.DRIVER_OPTIONS_DEFAULT,
        {
          sslCA: [fixture.ssl.ca],
          sslCert: fixture.ssl.server,
          sslKey: fixture.ssl.server,
          sslPass: 'woof',
          sslValidate: true,
          connectWithNoPrimary: true,
          readPreference: 'primary'
        }
      );

      expect(c.driverUrl).to.be.equal('mongodb://localhost:27017/?readPreference=primary&ssl=true');
      expect(c.driverOptions).to.deep.equal(options);

      Connection.from(c.driverUrl, (error) => {
        expect(error).to.not.exist;
        done();
      });
    });

    it('when ssl is ALL `sslCA` string value should be converted into an array', (done) => {
      const c = new Connection({ sslCA: fixture.ssl.ca });

      expect(Array.isArray(c.sslCA)).to.be.equal(true);

      Connection.from(c.driverUrl, (error) => {
        expect(error).to.not.exist;
        done();
      });
    });

    it('and urlencode credentials when using SCRAM-SHA-256 auth', (done) => {
      const c = new Connection({
        mongodbUsername: '@rlo',
        mongodbPassword: 'w@of',
        authentication: 'SCRAM-SHA-256'
      });

      expect(c.driverUrl).to.be.equal('mongodb://%40rlo:w%40of@localhost:27017/?readPreference=primary&authSource=admin&authMechanism=SCRAM-SHA-256&ssl=false');

      Connection.from(c.driverUrl, (error) => {
        expect(error).to.not.exist;
        done();
      });
    });

    it('and urlencode credentials when using no auth', (done) => {
      const c = new Connection({
        mongodbUsername: '@rlo',
        mongodbPassword: 'w@of'
      });

      expect(c.driverUrl).to.be.equal('mongodb://%40rlo:w%40of@localhost:27017/?readPreference=primary&authSource=admin&ssl=false');

      Connection.from(c.driverUrl, (error) => {
        expect(error).to.not.exist;
        done();
      });
    });

    it('and urlencode credentials when using MONGODB auth', (done) => {
      const mongodbUsername = 'user@-azMPk]&3Wt)iP_9C:PMQ=';
      const mongodbPassword = 'user@-azMPk]&3Wt)iP_9C:PMQ=';
      const authExpect = `${encodeURIComponent(mongodbUsername)}:${encodeURIComponent(mongodbPassword)}`;
      const c = new Connection({ mongodbUsername, mongodbPassword });

      expect(c.driverUrl).to.be.equal(`mongodb://${authExpect}@localhost:27017/?readPreference=primary&authSource=admin&ssl=false`);

      Connection.from(c.driverUrl, (error) => {
        expect(error).to.not.exist;
        done();
      });
    });

    it('and urlencode credentials when using MONGODB auth with emoji 💕', (done) => {
      const mongodbUsername = '👌emoji😂😍😘🔥💕🎁💯🌹';
      const mongodbPassword = '👌emoji😂😍😘🔥💕🎁💯🌹';
      const authExpect = `${encodeURIComponent(mongodbUsername)}:${encodeURIComponent(mongodbPassword)}`;
      const c = new Connection({ mongodbUsername, mongodbPassword });

      expect(c.driverUrl).to.be.equal(`mongodb://${authExpect}@localhost:27017/?readPreference=primary&authSource=admin&ssl=false`);

      Connection.from(c.driverUrl, (error) => {
        expect(error).to.not.exist;
        done();
      });
    });

    it('and urlencode credentials when using LDAP auth', (done) => {
      const ldapUsername = 'user@-azMPk]&3Wt)iP_9C:PMQ=';
      const ldapPassword = 'user@-azMPk]&3Wt)iP_9C:PMQ=';
      const authExpect = `${encodeURIComponent(ldapUsername)}:${encodeURIComponent(ldapPassword)}`;
      const c = new Connection({ ldapUsername, ldapPassword });

      expect(c.driverUrl).to.be.equal(`mongodb://${authExpect}@localhost:27017/?readPreference=primary&authMechanism=PLAIN&ssl=false&authSource=$external`);

      Connection.from(c.driverUrl, (error) => {
        expect(error).to.not.exist;
        done();
      });
    });

    it('and urlencode credentials when using KERBEROS auth', (done) => {
      const kerberosPrincipal = 'user@-azMPk]&3Wt)iP_9C:PMQ=';
      const kerberosPassword = 'user@-azMPk]&3Wt)iP_9C:PMQ=';
      const authExpect = `${encodeURIComponent(kerberosPrincipal)}:${encodeURIComponent(kerberosPassword)}`;
      const c = new Connection({ kerberosPrincipal, kerberosPassword });

      expect(c.driverUrl).to.be.equal(`mongodb://${authExpect}@localhost:27017/?readPreference=primary&gssapiServiceName=mongodb&authMechanism=GSSAPI&ssl=false&authSource=$external`);

      Connection.from(c.driverUrl, (error) => {
        expect(error).to.not.exist;
        done();
      });
    });

    it('and urlencode credentials when using KERBEROS auth with canonicalizing the host name', (done) => {
      const kerberosPrincipal = 'user@-azMPk]&3Wt)iP_9C:PMQ=';
      const kerberosPassword = 'user@-azMPk]&3Wt)iP_9C:PMQ=';
      const authExpect = `${encodeURIComponent(kerberosPrincipal)}:${encodeURIComponent(kerberosPassword)}`;
      const c = new Connection({
        kerberosCanonicalizeHostname: true,
        kerberosPrincipal,
        kerberosPassword
      });

      expect(c.driverUrl).to.be.equal(`mongodb://${authExpect}@localhost:27017/?readPreference=primary&gssapiServiceName=mongodb&authMechanism=GSSAPI&ssl=false&authSource=$external&authMechanismProperties=CANONICALIZE_HOST_NAME:true`);

      Connection.from(c.driverUrl, (error) => {
        expect(error).to.not.exist;
        done();
      });
    });

    it('and adds the read preference when read preference is not the default', (done) => {
      const c = new Connection({ readPreference: 'secondary' });

      expect(c.driverUrl).to.be.equal('mongodb://localhost:27017/?readPreference=secondary&ssl=false');

      Connection.from(c.driverUrl, (error) => {
        expect(error).to.not.exist;
        done();
      });
    });

    it('and include non-dependent attribute if it was changed', (done) => {
      const c = new Connection({ authentication: 'LDAP' });

      c.ldapUsername = 'ldap-user';
      c.ldapPassword = 'ldap-password';

      expect(c.driverUrl).to.be.equal('mongodb://ldap-user:ldap-password@localhost:27017/?readPreference=primary&authMechanism=PLAIN&ssl=false&authSource=$external');

      Connection.from(c.driverUrl, (error) => {
        expect(error).to.not.exist;
        done();
      });
    });

    it('and urlencode ldapPassword when using LDAP auth', (done) => {
      const c = new Connection({
        authentication: 'LDAP',
        ldapUsername: 'arlo',
        ldapPassword: 'w@of',
        ns: 'ldap'
      });

      expect(c.driverAuthMechanism).to.be.equal('PLAIN');
      expect(c.driverUrl).to.be.equal('mongodb://arlo:w%40of@localhost:27017/ldap?readPreference=primary&authMechanism=PLAIN&ssl=false&authSource=$external');

      Connection.from(c.driverUrl, (error) => {
        expect(error).to.not.exist;
        done();
      });
    });

    it('and urlencode ldapUsername when using LDAP auth', (done) => {
      // COMPASS-745 - should urlencode @ once onl
      const c = new Connection({
        authentication: 'LDAP',
        ldapUsername: 'arlo@t.co',
        ldapPassword: 'woof',
        ns: 'ldap'
      });

      expect(c.driverAuthMechanism).to.be.equal('PLAIN');
      expect(c.driverUrl).to.be.equal('mongodb://arlo%40t.co:woof@localhost:27017/ldap?readPreference=primary&authMechanism=PLAIN&ssl=false&authSource=$external');

      Connection.from(c.driverUrl, (error) => {
        expect(error).to.not.exist;
        done();
      });
    });

    it('and urlencode credentials when using X509 auth', (done) => {
      const c = new Connection({
        authentication: 'X509',
        x509Username: 'CN=client,OU=kerneluser,O=10Gen,L=New York City,ST=New York,C=US'
      });

      expect(c.driverAuthMechanism).to.be.equal('MONGODB-X509');
      expect(c.driverUrl).to.be.equal(
        'mongodb://CN%3Dclient%2COU%3Dkerneluser%2CO%3D10Gen%2CL%3DNew%20York%20City'
        + '%2CST%3DNew%20York%2CC%3DUS@localhost:27017/'
        + '?readPreference=primary&authMechanism=MONGODB-X509&ssl=false'
      );

      Connection.from(c.driverUrl, (error) => {
        expect(error).to.not.exist;
        done();
      });
    });
  });

  describe('should build a connection object and', () => {
    context('authentication', () => {
      it('set authentication to SCRAM-SHA-256', (done) => {
        const c = new Connection({
          mongodbUsername: 'arlo',
          mongodbPassword: 'woof',
          authentication: 'SCRAM-SHA-256'
        });

        expect(c.authentication).to.be.equal('SCRAM-SHA-256');

        Connection.from(c.driverUrl, (error) => {
          expect(error).to.not.exist;
          done();
        });
      });

      it('throw the error if auth is SCRAM-SHA-256 and mongodbUsername is missing', () => {
        const attrs = {
          authentication: 'SCRAM-SHA-256',
          mongodbPassword: 'woof'
        };
        const c = new Connection(attrs);
        const error = c.validate(attrs);

        expect(c.isValid()).to.be.equal(false);
        expect(error.message).to.include('mongodbUsername field is required');
      });

      it('throw the error if auth is SCRAM-SHA-256 and mongodbPassword is missing', () => {
        const attrs = {
          mongodbUsername: 'arlo',
          authentication: 'SCRAM-SHA-256'
        };
        const c = new Connection(attrs);
        const error = c.validate(attrs);

        expect(c.isValid()).to.be.equal(false);
        expect(error.message).to.include('mongodbPassword field is required');
      });

      it('throw the error if MONGODB auth receives non-applicable fields', () => {
        const attrs = {
          mongodbUsername: 'arlo',
          mongodbPassword: 'woof',
          kerberosServiceName: 'mongodb'
        };
        const c = new Connection(attrs);
        const error = c.validate(attrs);

        expect(c.isValid()).to.be.equal(false);
        expect(error.message).to.include('kerberosServiceName field does not apply');
      });

      it('set authentication to MONGODB', (done) => {
        const c = new Connection({
          mongodbUsername: 'arlo',
          mongodbPassword: 'woof'
        });

        expect(c.authentication).to.be.equal('MONGODB');

        Connection.from(c.driverUrl, (error) => {
          expect(error).to.not.exist;
          done();
        });
      });

      it('throw the error if auth is MONGODB and mongodbUsername is missing', () => {
        const attrs = { authentication: 'MONGODB', mongodbPassword: 'woof' };
        const c = new Connection(attrs);
        const error = c.validate(attrs);

        expect(c.isValid()).to.be.equal(false);
        expect(error.message).to.include('mongodbUsername field is required');
      });

      it('throw the error if auth is MONGODB and mongodbPassword is missing', (done) => {
        const c = new Connection({
          mongodbUsername: 'arlo',
          mongodbPassword: 'woof'
        });

        expect(c.mongodbDatabaseName).to.be.equal(Connection.MONGODB_DATABASE_NAME_DEFAULT);

        Connection.from(c.driverUrl, (error) => {
          expect(error).to.not.exist;
          done();
        });
      });

      it('set authentication to LDAP', (done) => {
        const c = new Connection({ ldapUsername: 'arlo', ldapPassword: 'w@of'});

        expect(c.authentication).to.be.equal('LDAP');

        Connection.from(c.driverUrl, (error) => {
          expect(error).to.not.exist;
          done();
        });
      });

      it('throw the error if auth is LDAP and ldapUsername is missing', () => {
        const attrs = { authentication: 'LDAP' };
        const c = new Connection(attrs);
        const error = c.validate(attrs);

        expect(c.isValid()).to.be.equal(false);
        expect(error.message).to.include('ldapUsername field is required');
      });

      it('throw the error if auth is LDAP and ldapPassword is missing', () => {
        const attrs = { authentication: 'LDAP', ldapUsername: 'arlo' };
        const c = new Connection(attrs);
        const error = c.validate(attrs);

        expect(c.isValid()).to.be.equal(false);
        expect(error.message).to.include('ldapPassword field is required');
      });

      it('set authentication to X509', (done) => {
        const c = new Connection({
          x509Username: 'CN=client,OU=kerneluser,O=10Gen,L=New York City,ST=New York,C=US'
        });

        expect(c.authentication).to.be.equal('X509');

        Connection.from(c.driverUrl, (error) => {
          expect(error).to.not.exist;
          done();
        });
      });

      it('throw the error if auth is X509 and x509Username is missing', () => {
        const attrs = { authentication: 'X509' };
        const c = new Connection(attrs);
        const error = c.validate(attrs);

        expect(c.isValid()).to.be.equal(false);
        expect(error.message).to.include('x509Username field is required');
      });

      it('set authentication to KERBEROS', (done) => {
        const c = new Connection({
          kerberosPrincipal: 'lucas@kerb.mongodb.parts'
        });

        expect(c.authentication).to.be.equal('KERBEROS');

        Connection.from(c.driverUrl, (error) => {
          expect(error).to.not.exist;
          done();
        });
      });

      it('throw the error if auth is KERBEROS and kerberosPrincipal is missing', () => {
        const attrs = { authentication: 'KERBEROS' };
        const c = new Connection(attrs);
        const error = c.validate(attrs);

        expect(c.isValid()).to.be.equal(false);
        expect(error.message).to.include('kerberosPrincipal field is required');
      });

      it('should *only* require a kerberosPrincipal', () => {
        const attrs = {
          authentication: 'KERBEROS',
          kerberosPrincipal: 'lucas@kerb.mongodb.parts'
        };
        const c = new Connection(attrs);

        expect(c.isValid()).to.be.equal(true);
      });

      it('set driverAuthMechanism to GSSAPI when a password is provided', (done) => {
        const c = new Connection({
          kerberosPrincipal: 'arlo/dog@krb5.mongodb.parts',
          kerberosPassword: 'w@@f',
          kerberosServiceName: 'mongodb'
        });

        expect(c.driverAuthMechanism).to.be.equal('GSSAPI');

        Connection.from(c.driverUrl, (error) => {
          expect(error).to.not.exist;
          done();
        });
      });

      it('set driverAuthMechanism to GSSAPI when a password is provided and urlencode the principal', (done) => {
        const c = new Connection({
          kerberosPrincipal: 'arlo/dog@krb5.mongodb.parts',
          kerberosPassword: 'w@@f',
          kerberosServiceName: 'mongodb'
        });
        const kerberosPrincipal = encodeURIComponent(c.kerberosPrincipal);
        const kerberosPassword = encodeURIComponent(c.kerberosPassword);
        const expectedPrefix = `mongodb://${kerberosPrincipal}:${kerberosPassword}@localhost:27017`;

        expect(c.driverAuthMechanism).to.be.equal('GSSAPI');
        expect(c.driverUrl.indexOf(expectedPrefix)).to.be.equal(0);

        Connection.from(c.driverUrl, (error) => {
          expect(error).to.not.exist;
          done();
        });
      });

      it('set driverAuthMechanism to GSSAPI when a password is not provided', (done) => {
        const c = new Connection({
          kerberosPrincipal: 'arlo/dog@krb5.mongodb.parts'
        });

        expect(c.driverAuthMechanism).to.be.equal('GSSAPI');

        Connection.from(c.driverUrl, (error) => {
          expect(error).to.not.exist;
          done();
        });
      });

      it('include the `:` auth seperator when no password is provided', (done) => {
        const c = new Connection({
          kerberosPrincipal: 'lucas@kerb.mongodb.parts'
        });
        const kerberosPrincipal = encodeURIComponent(c.kerberosPrincipal);
        const expectedPrefix = `mongodb://${kerberosPrincipal}:@localhost:27017`;

        expect(c.driverUrl.indexOf(expectedPrefix)).to.be.equal(0);

        Connection.from(c.driverUrl, (error) => {
          expect(error).to.not.exist;
          done();
        });
      });
    });

    context('top level properties', () => {
      it('set the default read preference to primary preferred', (done) => {
        const c = new Connection({ appname: 'My App' });

        expect(c.driverOptions).to.be.deep.equal({ readPreference: 'primary', connectWithNoPrimary: true });

        Connection.from(c.driverUrl, (error) => {
          expect(error).to.not.exist;
          done();
        });
      });

      it('set isSrvRecord defaults to false', (done) => {
        const c = new Connection();

        expect(c.isSrvRecord).to.be.equal(false);

        Connection.from(c.driverUrl, (error) => {
          expect(error).to.not.exist;
          done();
        });
      });

      it('allow the mongodbDatabaseName to be optional', () => {
        const attrs = { mongodbUsername: 'arlo' };
        const c = new Connection(attrs);
        const error = c.validate(attrs);

        expect(c.isValid()).to.be.equal(false);
        expect(error.message).to.include('mongodbPassword field is required');
      });

      it('generate the local port when using a ssh tunne and bind to local port does not exist', () => {
        const c = new Connection();

        c.sshTunnel = 'USER_PASSWORD';
        c.sshTunnelHostname = '123.45.67.89';
        c.sshTunnelPort = '22';
        c.sshTunnelUsername = 'user';
        c.sshTunnelPassword = 'pass';

        expect(c.driverUrl).to.not.be.equal('');
        expect(c.sshTunnelBindToLocalPort).to.exist;
      });

      it('when ssl ia ALL should load all of the files from the filesystem', (done) => {
        const c = new Connection({
          ssl: 'ALL',
          sslCA: [fixture.ssl.ca],
          sslCert: fixture.ssl.server,
          sslKey: fixture.ssl.server
        });

        loadOptions(c, (error, driverOptions) => {
          if (error) {
            return done(error);
          }

          const opts = driverOptions;

          expect(opts.sslValidate).to.be.equal(true);
          expect(Array.isArray(opts.sslCA)).to.be.equal(true);
          expect(Buffer.isBuffer(opts.sslCA[0])).to.be.equal(true);
          expect(opts.sslPass).to.not.exist;
          expect(Buffer.isBuffer(opts.sslCert)).to.be.equal(true);
          expect(Buffer.isBuffer(opts.sslKey)).to.be.equal(true);
          done();
        });
      });
    });

    context('extra options', () => {
      it('use default driverOptions when there is no extra options', (done) => {
        const c = new Connection();

        expect(c.driverOptions).to.have.property('connectWithNoPrimary');
        expect(c.driverOptions).to.have.property('readPreference');
        expect(c.driverOptions).to.not.have.property('socketTimeoutMS');

        Connection.from(c.driverUrl, (error) => {
          expect(error).to.not.exist;
          done();
        });
      });

      it('include extra options in driverOptions when specified', (done) => {
        const c = new Connection({ extraOptions: { socketTimeoutMS: 1000 } });
        const options = Object.assign(
          {},
          Connection.DRIVER_OPTIONS_DEFAULT,
          { socketTimeoutMS: 1000, readPreference: 'primary' }
        );

        expect(c.driverOptions).to.deep.equal(options);

        Connection.from(c.driverUrl, (error) => {
          expect(error).to.not.exist;
          done();
        });
      });
    });

    context('promote values', () => {
      it('should not have promoteValues when not specified', (done) => {
        const c = new Connection();

        expect(c.driverOptions).to.not.have.property('promoteValues');

        Connection.from(c.driverUrl, (error) => {
          expect(error).to.not.exist;
          done();
        });
      });

      it('should set promoteValues to true', (done) => {
        const c = new Connection({ promoteValues: true });

        expect(c.driverOptions).to.have.property('promoteValues');
        expect(c.driverOptions.promoteValues).to.be.equal(true);

        Connection.from(c.driverUrl, (error) => {
          expect(error).to.not.exist;
          done();
        });
      });

      it('should set promoteValues to false', (done) => {
        const c = new Connection({ promoteValues: false });

        expect(c.driverOptions).to.have.property('promoteValues');
        expect(c.driverOptions.promoteValues).to.be.equal(false);

        Connection.from(c.driverUrl, (error) => {
          expect(error).to.not.exist;
          done();
        });
      });
    });

    context('connection type', () => {
      it('should set default connectionType to NODE_DRIVER', (done) => {
        const c = new Connection({});

        expect(c.connectionType).to.be.equal('NODE_DRIVER');

        Connection.from(c.driverUrl, (error) => {
          expect(error).to.not.exist;
          done();
        });
      });

      it('should set default host and port when connectionType is NODE_DRIVER', (done) => {
        const c = new Connection({ connectionType: 'NODE_DRIVER' });

        expect(c.hostname).to.be.equal('localhost');
        expect(c.port).to.be.equal(27017);

        Connection.from(c.driverUrl, (error) => {
          expect(error).to.not.exist;
          done();
        });
      });

      it('should not allow stitchClientAppId', () => {
        const c = new Connection({
          connectionType: 'NODE_DRIVER',
          stitchClientAppId: 'xkcd42'
        });

        expect(c.isValid()).to.be.equal(false);
      });

      it('should not allow stitchClientAppId', () => {
        const c = new Connection({
          connectionType: 'NODE_DRIVER',
          stitchBaseUrl: 'http://localhost:9001/'
        });

        expect(c.isValid()).to.be.equal(false);
      });

      it('should not allow stitchGroupId', () => {
        const c = new Connection({
          connectionType: 'NODE_DRIVER',
          stitchGroupId: '23xkcd'
        });

        expect(c.isValid()).to.be.equal(false);
      });

      it('should not allow stitchServiceName', () => {
        const c = new Connection({
          connectionType: 'NODE_DRIVER',
          stitchServiceName: 'woof'
        });

        expect(c.isValid()).to.be.equal(false);
      });

      it('when connectionType is STITCH_ATLAS should require stitchClientAppId', () => {
        const c = new Connection({ connectionType: 'STITCH_ATLAS' });

        expect(c.isValid()).to.be.equal(false);
      });

      it('when connectionType is STITCH_ATLAS should be valid when stitchClientAppId is included', () => {
        const c = new Connection({
          connectionType: 'STITCH_ATLAS',
          stitchClientAppId: 'xkcd42'
        });

        expect(c.isValid()).to.be.equal(true);
      });

      it('when connectionType is STITCH_ON_PREM should require stitchClientAppId', () => {
        const c = new Connection({
          connectionType: 'STITCH_ON_PREM',
          stitchBaseUrl: 'http://localhost:9001/',
          stitchGroupId: '23xkcd',
          stitchServiceName: 'woof'
        });

        expect(c.isValid()).to.be.equal(false);
      });

      it('when connectionType is STITCH_ON_PREM should require stitchBaseUrl', () => {
        const c = new Connection({
          connectionType: 'STITCH_ON_PREM',
          stitchClientAppId: 'xkcd42',
          stitchGroupId: '23xkcd',
          stitchServiceName: 'woof'
        });

        expect(c.isValid()).to.be.equal(false);
      });

      it('when connectionType is STITCH_ON_PREM should require stitchGroupId', () => {
        const c = new Connection({
          connectionType: 'STITCH_ON_PREM',
          stitchClientAppId: 'xkcd42',
          stitchBaseUrl: 'http://localhost:9001/',
          stitchServiceName: 'woof'
        });

        expect(c.isValid()).to.be.equal(false);
      });

      it('when connectionType is STITCH_ON_PREM should require stitchServiceName', () => {
        const c = new Connection({
          connectionType: 'STITCH_ON_PREM',
          stitchClientAppId: 'xkcd42',
          stitchBaseUrl: 'http://localhost:9001/',
          stitchGroupId: '23xkcd'
        });

        expect(c.isValid()).to.be.equal(false);
      });

      it('when connectionType is STITCH_ON_PREM should be valid when all required fields are included', () => {
        const c = new Connection({
          connectionType: 'STITCH_ON_PREM',
          stitchClientAppId: 'xkcd42',
          stitchBaseUrl: 'http://localhost:9001/',
          stitchGroupId: '23xkcd',
          stitchServiceName: 'woof'
        });

        expect(c.isValid()).to.be.equal(true);
      });
    });
  });

  describe('#isURI', () => {
    it('when using a mongodb protocol returns true', () => {
      const isURI = Connection.isURI('mongodb://localhost&ssl=false');

      expect(isURI).to.be.equal(true);
    });

    it('when using a mongodb+srv protocol returns true', () => {
      const isURI = Connection.isURI('mongodb+srv://localhost&ssl=false');

      expect(isURI).to.be.equal(true);
    });

    it('when using another protocol returns false', () => {
      const isURI = Connection.isURI('mongodb+somethign://localhost&ssl=false');

      expect(isURI).to.be.equal(false);
    });

    it('when using a shell connection string returns false', () => {
      const isURI = Connection.isURI('mongo "mongodb://localhost&ssl=false"');

      expect(isURI).to.be.equal(false);
    });
  });
});