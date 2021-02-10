const Connection = require('../');
const chai = require('chai');
const expect = chai.expect;

chai.use(require('chai-subset'));

describe('connection model parser should parse URI strings for common connection targets such as', () => {
  context('ATLAS - mongodb.net when a database is provided', () => {
    const atlasConnection =
      'mongodb://ADMINUSER:<PASSWORD>@' +
      'a-compass-atlas-test-shard-00-00-vll9l.mongodb.net:38128,' +
      'a-compass-atlas-test-shard-00-01-vll9l.mongodb.net:38128,' +
      'a-compass-atlas-test-shard-00-02-vll9l.mongodb.net:38128/<DATABASE>?' +
      'ssl=true&replicaSet=a-compass-atlas-test-shard-0&authSource=admin&readPreference=secondary';
    const okAtlasPassword = 'A_MUCH_LONGER_PASSWORD_should_be_more secure...';
    const okAtlasPasswordConnection = atlasConnection.replace(
      '<PASSWORD>',
      okAtlasPassword
    );

    it('sets replicaSet, readPreference, ssl, ns, authSource and clears the default password', async() => {
      const result = await Connection.from(atlasConnection);
      expect(result.replicaSet).to.be.equal('a-compass-atlas-test-shard-0');
      expect(result.readPreference).to.be.equal('secondary');
      expect(result.sslMethod).to.be.equal('SYSTEMCA');
      expect(result.mongodbPassword).to.be.equal('');
      expect(result.ns).to.be.equal('admin');
      expect(result.driverUrl).to.include('authSource=admin');
    });

    it('does not clear sufficiently long passwords that happen to contain PASSWORD', async() => {
      const result = await Connection.from(okAtlasPasswordConnection);
      expect(result.mongodbPassword).to.be.equal(okAtlasPassword);
    });

    it('works with a non-default secure password', async() => {
      const userPass = '6NuZPtHCrjYBAWnI7Iq6jvtsdJx67X0';
      const modifiedAtlasConnection = atlasConnection.replace(
        '<PASSWORD>',
        userPass
      );

      const result = await Connection.from(modifiedAtlasConnection);
      expect(result.sslMethod).to.be.equal('SYSTEMCA');
      expect(result.mongodbPassword).to.be.equal(userPass);
    });

    it('does not false positive on hi.mongodb.net.my.domain.com', async() => {
      const modifiedAtlasConnection = atlasConnection.replace(
        /mongodb.net/g,
        'hi.mongodb.net.my.domain.com'
      );

      const result = await Connection.from(modifiedAtlasConnection);
      expect(result.sslMethod).to.be.equal('NONE');
    });

    it('is case insensitive, see RFC4343', async() => {
      const modifiedAtlasConnection = atlasConnection.replace(
        /mongodb.net/g,
        'mOnGOdB.NeT'
      );

      const result = await Connection.from(modifiedAtlasConnection);
      expect(result.sslMethod).to.be.equal('SYSTEMCA');
    });
  });

  context('ATLAS - mongodb.net when a database is not provided', () => {
    const atlasConnection =
      'mongodb://ADMINUSER:<PASSWORD>@' +
      'a-compass-atlas-test-shard-00-00-vll9l.mongodb.net:38128,' +
      'a-compass-atlas-test-shard-00-01-vll9l.mongodb.net:38128,' +
      'a-compass-atlas-test-shard-00-02-vll9l.mongodb.net:38128';

    it('sets hostname, port, ns, authSource', async() => {
      const result = await Connection.from(atlasConnection);
      expect(result.hostname).to.be.equal(
        'a-compass-atlas-test-shard-00-00-vll9l.mongodb.net'
      );
      expect(result.port).to.be.equal(38128);
      expect(result.ns).to.be.equal('test');
      expect(result.driverUrl).to.include('authSource=admin');
    });
  });

  context('localhost', () => {
    it('database server running locally', async() => {
      const result = await Connection.from('mongodb://localhost');
      expect(result.hostname).to.be.equal('localhost');
      expect(result.port).to.be.equal(27017);
    });

    it('admin database', async() => {
      const result = await Connection.from('mongodb://sysop:moon@localhost');
      expect(result.mongodbUsername).to.be.equal('sysop');
      expect(result.mongodbPassword).to.be.equal('moon');
    });

    it('records database', async() => {
      const result = await Connection.from(
        'mongodb://sysop:moon@localhost/records',
      );
      expect(result.mongodbUsername).to.be.equal('sysop');
      expect(result.mongodbPassword).to.be.equal('moon');
      expect(result.ns).to.be.equal('records');
    });

    it('replica set with members on localhost', async() => {
      const result = await Connection.from(
        'mongodb://localhost,localhost:27018,localhost:27019/?replicaSet=test',
      );
      expect(result.replicaSet).to.be.equal('test');
      expect(result).to.have.property('hosts');
      expect(result.hosts).to.have.lengthOf(3);
      expect(result.hosts[0]).to.be.deep.equal({
        host: 'localhost',
        port: 27017
      });
      expect(result.hosts[1]).to.be.deep.equal({
        host: 'localhost',
        port: 27018
      });
      expect(result.hosts[2]).to.be.deep.equal({
        host: 'localhost',
        port: 27019
      });
    });

    it('with explicit authSource', async() => {
      const result = await Connection.from(
        'mongodb://%40rlo:w%40of@localhost:27017/dogdb?authMechanism=SCRAM-SHA-1&authSource=catdb',
      );
      expect(result.ns).to.be.equal('dogdb');
      expect(result.mongodbDatabaseName).to.be.equal('catdb');
    });

    it('when authSource is not specified should fall back to dbName', async() => {
      const result = await Connection.from(
        'mongodb://%40rlo:w%40of@localhost:27017/dogdb?authMechanism=SCRAM-SHA-1',
      );
      expect(result.ns).to.be.equal('dogdb');
      expect(result.mongodbDatabaseName).to.be.equal('admin');
    });

    it('when using MONGODB auth', async() => {
      const result = await Connection.from(
        'mongodb://%40rlo:w%40of@localhost:27017/?authSource=%40dmin',
      );
      expect(result.hostname).to.be.equal('localhost');
      expect(result.port).to.be.equal(27017);
      expect(result.authStrategy).to.be.equal('MONGODB');
      expect(result.mongodbUsername).to.be.equal('@rlo');
      expect(result.mongodbPassword).to.be.equal('w@of');
      expect(result.mongodbDatabaseName).to.be.equal('@dmin'); // this is the authSource, not dbName!
    });

    it('when using LDAP auth', async() => {
      const result = await Connection.from(
        'mongodb://arlo:w%40of@localhost:27017/ldap?authMechanism=PLAIN',
      );
      expect(result.hostname).to.be.equal('localhost');
      expect(result.port).to.be.equal(27017);
      expect(result.authStrategy).to.be.equal('LDAP');
      expect(result.ldapUsername).to.be.equal('arlo');
      expect(result.ldapPassword).to.be.equal('w@of');
      expect(result.ns).to.be.equal('ldap');
    });

    it('when using X509 auth with a username', async() => {
      const result = await Connection.from(
        'mongodb://CN%3Dclient%2COU%3Darlo%2CO%3DMongoDB%2CL%3DPhiladelphia%2CST%3DPennsylvania%2CC%3DUS@localhost:27017/x509?authMechanism=MONGODB-X509',
      );
      expect(result.hostname).to.be.equal('localhost');
      expect(result.port).to.be.equal(27017);
      expect(result.authStrategy).to.be.equal('X509');
      expect(result.x509Username).to.be.equal(
        'CN=client,OU=arlo,O=MongoDB,L=Philadelphia,ST=Pennsylvania,C=US'
      );
      expect(result.ns).to.be.equal('x509');
    });

    it('when using X509 auth without a username', async() => {
      const result = await Connection.from(
        'mongodb://localhost:27017/x509?authMechanism=MONGODB-X509',
      );
      expect(result.hostname).to.be.equal('localhost');
      expect(result.port).to.be.equal(27017);
      expect(result.authStrategy).to.be.equal('X509');
      expect(result.x509Username).to.be.equal(undefined);
      expect(result.ns).to.be.equal('x509');
    });

    it('when using KERBEROS auth', async() => {
      const result = await Connection.from(
        'mongodb://arlo%2Fdog%40krb5.mongodb.parts:w%40%40f@localhost:27017/kerberos?gssapiServiceName=mongodb&authMechanism=GSSAPI',
      );
      expect(result.hostname).to.be.equal('localhost');
      expect(result.port).to.be.equal(27017);
      expect(result.authStrategy).to.be.equal('KERBEROS');
      expect(result.kerberosPrincipal).to.be.equal(
        'arlo/dog@krb5.mongodb.parts'
      );
      expect(result.ns).to.be.equal('kerberos');
    });
  });

  context('remote host', () => {
    it('UNIX domain socket', async() => {
      const result = await Connection.from(
        'mongodb://%2Ftmp%2Fmongodb-27017.sock',
      );
      expect(result.hostname).to.be.equal('/tmp/mongodb-27017.sock');
      expect(result.port).to.be.equal(27017);
    });

    it('replica set with members on different machines', async() => {
      const result = await Connection.from(
        'mongodb://db1.example.net,db2.example.com/?replicaSet=test',
      );
      expect(result.replicaSet).to.be.equal('test');
      expect(result).to.have.property('hosts');
      expect(result.hosts).to.have.lengthOf(2);
      expect(result.hosts[0]).to.be.deep.equal({
        host: 'db1.example.net',
        port: 27017
      });
      expect(result.hosts[1]).to.be.deep.equal({
        host: 'db2.example.com',
        port: 27017
      });
    });

    it('replica set with read distribution', async() => {
      const result = await Connection.from(
        'mongodb://example1.com,example2.com,example3.com/?replicaSet=test&readPreference=secondary',
      );
      expect(result.replicaSet).to.be.equal('test');
      expect(result.readPreference).to.be.equal('secondary');
      expect(result).to.have.property('hosts');
      expect(result.hosts).to.have.lengthOf(3);
      expect(result.hosts[0]).to.be.deep.equal({
        host: 'example1.com',
        port: 27017
      });
      expect(result.hosts[1]).to.be.deep.equal({
        host: 'example2.com',
        port: 27017
      });
      expect(result.hosts[2]).to.be.deep.equal({
        host: 'example3.com',
        port: 27017
      });
    });

    it('replica set with a high level of write concern', async() => {
      const result = await Connection.from(
        'mongodb://example1.com,example2.com,example3.com/?replicaSet=test&w=2&wtimeoutMS=2000',
      );
      expect(result.replicaSet).to.be.equal('test');
      expect(result.w).to.be.equal(2);
      expect(result.wTimeoutMS).to.be.equal(2000);
      expect(result).to.have.property('hosts');
      expect(result.hosts).to.have.lengthOf(3);
      expect(result.hosts[0]).to.be.deep.equal({
        host: 'example1.com',
        port: 27017
      });
      expect(result.hosts[1]).to.be.deep.equal({
        host: 'example2.com',
        port: 27017
      });
      expect(result.hosts[2]).to.be.deep.equal({
        host: 'example3.com',
        port: 27017
      });
    });

    it('sharded cluster', async() => {
      const result = await Connection.from(
        'mongodb://router1.example.com:27017,router2.example2.com:27017,router3.example3.com:27017/'
      );
      expect(result).to.have.property('hosts');
      expect(result.hosts).to.have.lengthOf(3);
      expect(result.hosts[0]).to.be.deep.equal({
        host: 'router1.example.com',
        port: 27017
      });
      expect(result.hosts[1]).to.be.deep.equal({
        host: 'router2.example2.com',
        port: 27017
      });
      expect(result.hosts[2]).to.be.deep.equal({
        host: 'router3.example3.com',
        port: 27017
      });
    });

    it('sharded cluster and admin database', async() => {
      const result = await Connection.from(
        'mongodb://mongos0.example.com:27017,mongos1.example.com:27017,mongos2.example.com:27017/admin'
      );
      expect(result).to.have.property('hosts');
      expect(result.hosts).to.have.lengthOf(3);
      expect(result.hosts[0]).to.be.deep.equal({
        host: 'mongos0.example.com',
        port: 27017
      });
      expect(result.hosts[1]).to.be.deep.equal({
        host: 'mongos1.example.com',
        port: 27017
      });
      expect(result.hosts[2]).to.be.deep.equal({
        host: 'mongos2.example.com',
        port: 27017
      });
      expect(result.ns).to.be.equal('admin');
    });

    it('sharded cluster that enforces access control, include user credentials', async() => {
      const result = await Connection.from(
        'mongodb://myDBReader:D1fficultP%40ssw0rd@mongos0.example.com:27017,mongos1.example.com:27017,mongos2.example.com:27017/admin',
      );
      expect(result).to.have.property('hosts');
      expect(result.hosts).to.have.lengthOf(3);
      expect(result.hosts[0]).to.be.deep.equal({
        host: 'mongos0.example.com',
        port: 27017
      });
      expect(result.hosts[1]).to.be.deep.equal({
        host: 'mongos1.example.com',
        port: 27017
      });
      expect(result.hosts[2]).to.be.deep.equal({
        host: 'mongos2.example.com',
        port: 27017
      });
      expect(result.mongodbUsername).to.be.equal('myDBReader');
      expect(result.mongodbPassword).to.be.equal('D1fficultP@ssw0rd');
      expect(result.ns).to.be.equal('admin');
      expect(result.authStrategy).to.be.equal('MONGODB');
    });

    it('when host and port are specified', async() => {
      const result = await Connection.from('mongodb://krb5.mongodb.parts:1234');
      expect(result.hostname).to.be.equal('krb5.mongodb.parts');
      expect(result.port).to.be.equal(1234);
    });

    it('when port is not specified', async() => {
      const result = await Connection.from('mongodb://data.mongodb.com/');
      expect(result.hostname).to.be.equal('data.mongodb.com');
      expect(result.port).to.be.equal(27017);
    });
  });
});
