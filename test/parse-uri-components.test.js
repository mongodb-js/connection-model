const Connection = require('../');
const chai = require('chai');
const expect = chai.expect;
const proxyquire = require('proxyquire');

// To test SRV connection strings we need to use `proxyquire`.
// Because driver parser resolves the SRV record and uses the result as the list
// of hosts to connect to. Since tests don't have real data that can be resolved
// the driver check would always fail.
// To make tests work we need to mock dns methods.
let stubHostname = '';
const stubs = {
  dns: {
    resolveSrv: (uri, callback) => callback(null, [{ name: stubHostname }]),
    resolveTxt: (addresses, callback) => callback(null),
    // To get access to the deeply nested dependencies we need to move them to the global level
    '@global': true
  }
};
const stubedConnection = proxyquire('../', stubs);

chai.use(require('chai-subset'));

describe('connection model parser should parse URI components such as', () => {
  describe('prefix', () => {
    it('should set isSrvRecord to false', async() => {
      const result = await Connection.from(
        'mongodb://mongodb1.example.com:27317,mongodb2.example.com:27017/?replicaSet=mySet&authSource=authDB',
      );
      expect(result.isSrvRecord).to.be.equal(false);
    });

    it('should set isSrvRecord to true', async() => {
      stubHostname = 'server.example.com';
      const result = await stubedConnection.from(
        `mongodb+srv://${stubHostname}/?connectTimeoutMS=300000&authSource=aDifferentAuthDB`,
      );
      expect(result.isSrvRecord).to.be.equal(true);
    });

    it('should catch ampersand validation errors', async() => {
      stubHostname = 'server.example.com';
      let error;
      try {
        // note: socketTimeoutMS=1&socketTimeoutMS=2 will cause the validation to fail.
        await stubedConnection.from(
          `mongodb+srv://${stubHostname}/?connectTimeoutMS=300000&authSource=aDifferentAuthDB&socketTimeoutMS=1&socketTimeoutMS=2`,
        );
      } catch (err) {
        error = err;
      }
      expect(error).to.exist;
      expect(error.message).to.contain('Property \'socketTimeoutMS\' must be of type number');
    });

    it('should set only one hostname without decorating it with the replica set info', async() => {
      stubHostname = 'test.mongodb.net';
      const result = await stubedConnection.from(
        `mongodb+srv://admin:qwerty@${stubHostname}/admin`,
      );
      expect(result.isSrvRecord).to.be.equal(true);
      expect(result.hostname).to.be.equal('test.mongodb.net');
    });
  });

  describe('authentication credentials', () => {
    it('should parse username and password', async() => {
      const result = await Connection.from(
        'mongodb://someUsername:testPassword@localhost',
      );
      expect(result.hostname).to.be.equal('localhost');
      expect(result).to.have.property('auth');
      expect(result.mongodbUsername).to.be.equal('someUsername');
      expect(result.mongodbPassword).to.be.equal('testPassword');
      expect(result.ns).to.be.equal('test');
      expect(result.authStrategy).to.be.equal('MONGODB');
    });

    it('should not return authentication info', async() => {
      const result = await Connection.from('mongodb://localhost');
      expect(result.hostname).to.be.equal('localhost');
      expect(result.authStrategy).to.be.equal('NONE');
    });
  });

  describe('the host and optional port number', () => {
    it('should parse host and port', async() => {
      const result = await Connection.from('mongodb://host:27018');
      expect(result.hostname).to.be.equal('host');
      expect(result.hosts[0].host).to.equal('host');
      expect(result.hosts[0].port).to.equal(27018);
    });

    it('should provide a default port if one is not provided', async() => {
      const result = await Connection.from('mongodb://host');
      expect(result.hostname).to.be.equal('host');
      expect(result.hosts[0].host).to.equal('host');
      expect(result.hosts[0].port).to.equal(27017);
    });
  });

  describe('the name of the database to authenticate', () => {
    it('should parse a database name', async() => {
      const result = await Connection.from(
        'mongodb://root:password123@localhost:27017/databasename',
      );
      expect(result.mongodbUsername).to.equal('root');
      expect(result.mongodbPassword).to.equal('password123');
    });
  });

  describe('connection string options that include', () => {
    describe('replica set options', () => {
      it('should parse replicaSet', async() => {
        const result = await Connection.from(
          'mongodb://db0.example.com:27017,db1.example.com:27017,db2.example.com:27017/admin?replicaSet=myRepl',
        );
        expect(result.replicaSet).to.be.equal('myRepl');
        expect(result.hostname).to.be.equal('db0.example.com');
        expect(result.port).to.be.equal(27017);
        expect(result.ns).to.be.equal('admin');
      });
    });

    describe('connection options', () => {
      it('should parse ssl', async() => {
        const result = await Connection.from(
          'mongodb://db0.example.com,db1.example.com,db2.example.com/?replicaSet=myReplOther&ssl=true',
        );
        expect(result.replicaSet).to.be.equal('myReplOther');
        expect(result.ssl).to.be.equal(true);
      });

      it('should parse connectTimeoutMS', async() => {
        const result = await Connection.from(
          'mongodb://mongodb1.example.com:27317,mongodb2.example.com:27017/?connectTimeoutMS=300000&replicaSet=mySet&authSource=aDifferentAuthDB',
        );
        expect(result.connectTimeoutMS).to.be.equal(300000);
      });

      it('should parse socketTimeoutMS with w', async() => {
        const result = await Connection.from(
          'mongodb://localhost:27017/sampleDb?socketTimeoutMS=30000&w=majority',
        );
        expect(result.socketTimeoutMS).to.be.equal(30000);
      });

      it('should parse socketTimeoutMS with multiple servers', async() => {
        const result = await Connection.from(
          'mongodb://localhost:27017,localhost:27018,localhost:27019/sampleDb?replicaSet=rs0&socketTimeoutMS=5000',
        );
        expect(result.socketTimeoutMS).to.be.equal(5000);
      });

      it('should parse compressors with snappy value', async() => {
        const result = await Connection.from(
          'mongodb://localhost/?compressors=snappy',
        );
        expect(result).to.have.property('compression');
        expect(result.compression.compressors).to.have.lengthOf(1);
        expect(result.compression.compressors).to.include('snappy');
      });

      it('should parse compressors with zlib value', async() => {
        const result = await Connection.from(
          'mongodb://localhost/?compressors=zlib',
        );
        expect(result).to.have.property('compression');
        expect(result.compression.compressors).to.have.lengthOf(1);
        expect(result.compression.compressors).to.include('zlib');
      });

      it('should throw the error if compressors contain invalid value', async() => {
        let error;
        try {
          await Connection.from('mongodb://localhost/?compressors=bunnies');
        } catch (err) {
          error = err;
        }

        expect(error).to.exist;
      });

      it('should parse compressors with snappy and zlib values', async() => {
        const result = await Connection.from(
          'mongodb://localhost/?compressors=snappy,zlib',
        );
        expect(result).to.have.property('compression');
        expect(result.compression.compressors).to.have.lengthOf(2);
        expect(result.compression.compressors).to.include('zlib');
        expect(result.compression.compressors).to.include('snappy');
      });

      it('should parse zlibCompressionLevel', async() => {
        const result = await Connection.from(
          'mongodb://localhost/?compressors=zlib&zlibCompressionLevel=4',
        );
        expect(result).to.have.property('compression');
        expect(result.compression).to.eql({
          compressors: ['zlib'],
          zlibCompressionLevel: 4
        });
      });

      it('should throw the error if zlibCompressionLevel has invalid value', async() => {
        let error;
        try {
          await Connection.from(
            'mongodb://localhost/?zlibCompressionLevel=15',
          );
        } catch (err) {
          error = err;
        }
        expect(error).to.exist;
      });
    });

    describe('connection pool options', () => {
      it('should parse minPoolSize and maxPoolSize', async() => {
        const result = await Connection.from(
          'mongodb://localhost:27017,localhost:27018,localhost:27019/databasename?replicaSet=rs01&ssl=false&connectTimeoutMS=100000&minPoolSize=5&maxPoolSize=10',
        );
        expect(result.minPoolSize).to.be.equal(5);
        expect(result.maxPoolSize).to.be.equal(10);
      });

      it('should parse maxIdleTimeMS', async() => {
        const result = await Connection.from(
          'mongodb://localhost/test?maxIdleTimeMS=30000',
        );
        expect(result.maxIdleTimeMS).to.be.equal(30000);
      });

      it('should parse waitQueueMultiple', async() => {
        const result = await Connection.from(
          'mongodb://user:password@ip:27017/?waitQueueMultiple=10',
        );
        expect(result.waitQueueMultiple).to.be.equal(10);
      });

      it('should parse escaped URI with maxIdleTimeMS, waitQueueTimeoutMS, waitQueueTimeoutMS and journal', async() => {
        const result = await Connection.from(
          'mongodb://localhost/test?readPreference=primary&amp;maxPoolSize=50&amp;minPoolSize=5&amp;maxIdleTimeMS=1000&amp;waitQueueMultiple=200&amp;waitQueueTimeoutMS=100&amp;w=1&amp;journal=true',
        );
        expect(result.journal).to.be.equal(true);
        expect(result.maxIdleTimeMS).to.be.equal(1000);
        expect(result.waitQueueMultiple).to.be.equal(200);
        expect(result.waitQueueTimeoutMS).to.be.equal(100);
      });
    });

    describe('write concern options', () => {
      it('should parse write concern w option with number value', async() => {
        const result = await Connection.from(
          'mongodb://localhost/DBName?replicaSet=xxxx&w=1&readPreference=nearest&maxPoolSize=50',
        );
        expect(result.w).to.be.equal(1);
      });

      it('should parse write concern w option with majority value', async() => {
        const result = await Connection.from(
          'mongodb://localhost/DBName?replicaSet=xxxx&w=majority',
        );
        expect(result.w).to.be.equal('majority');
      });

      it('should parse write concern w option with tag set value', async() => {
        const result = await Connection.from(
          'mongodb://localhost/DBName?w=MultipleDC',
        );
        expect(result.w).to.be.equal('MultipleDC');
      });

      it('should parse wTimeoutMS', async() => {
        const result = await Connection.from(
          'mongodb://host1:port1,host2:port2/?ssl=1&wtimeoutMS=1000', // Note the difference `wtimeoutMS` and `wTimeoutMS`
        );
        expect(result.wTimeoutMS).to.be.equal(1000); // Returned value was camelCased
      });

      it('should parse journal', async() => {
        const result = await Connection.from(
          'mongodb://localhost/test?readPreference=primary&w=1&journal=true',
        );
        expect(result.journal).to.be.equal(true);
      });

      it('should parse j option', async() => {
        const result = await Connection.from(
          'mongodb://localhost/test?readPreference=primary&w=1&j=true',
        );
        expect(result.journal).to.be.equal(true); // Converts j=true to journal=true
      });

      it('should parse wtimeout', async() => {
        const result = await Connection.from(
          'mongodb://localhost/test?w=1&wtimeout=2500',
        );
        expect(result.wTimeoutMS).to.be.equal(2500); // Converts jwtimeout to wTimeoutMS
      });
    });

    describe('read concern options', () => {
      it('should parse readConcernLevel with local value', async() => {
        const result = await Connection.from(
          'mongodb://localhost/?readConcernLevel=local',
        );
        expect(result.readConcernLevel).to.be.equal('local');
      });

      it('should parse readConcernLevel with majority value', async() => {
        const result = await Connection.from(
          'mongodb://db0.example.com,db1.example.com,db2.example.com/?replicaSet=myRepl&readConcernLevel=majority',
        );
        expect(result.readConcernLevel).to.be.equal('majority');
      });
    });

    describe('read preference options', () => {
      it('should parse readPreference and maxStalenessSeconds', async() => {
        const result = await Connection.from(
          'mongodb://mongos1.example.com,mongos2.example.com/?readPreference=secondary&maxStalenessSeconds=120',
        );
        expect(result.readPreference).to.be.equal('secondary');
        expect(result.maxStalenessSeconds).to.be.equal(120);
      });

      it('should throw the error if readPreference has invalid value', async() => {
        let error;
        try {
          await Connection.from(
            'mongodb://localhost/?readPreference=llamasPreferred',
          );
        } catch (err) {
          error = err;
        }
        expect(error).to.exist;
      });

      it('should parse readPreference and readPreferenceTags', async() => {
        const result = await Connection.from(
          'mongodb://mongos1.example.com,mongos2.example.com/?readPreference=secondary&readPreferenceTags=dc:ny,rack:1',
        );
        expect(result.readPreference).to.be.equal('secondary');
        expect(result).to.have.property('readPreferenceTags');
        expect(result.readPreferenceTags).to.eql([{ dc: 'ny', rack: 1 }]);
      });
    });

    describe('authentication options', () => {
      it('should parse authSource', async() => {
        const result = await Connection.from(
          'mongodb://myDBReader:D1fficultP%40ssw0rd@mongodb0.example.com:27017,mongodb1.example.com:27017,mongodb2.example.com:27017/test?replicaSet=myRepl&authSource=admin',
        );
        expect(result).to.have.property('authSource');
        expect(result.authSource).to.equal('admin');
      });

      it('should parse authSource and authMechanism', async() => {
        const result = await Connection.from(
          'mongodb://user:password@example.com/?authSource=theDatabase&authMechanism=SCRAM-SHA-256',
        );
        expect(result.authSource).to.be.equal('theDatabase');
        expect(result.authMechanism).to.be.equal('SCRAM-SHA-256');
      });

      it('should throw the error if authMechanism has invalid value', async() => {
        let error;
        try {
          await Connection.from('mongodb://localhost/?authMechanism=DOGS');
        } catch (err) {
          error = err;
        }

        expect(error).to.exist;
      });

      it('should parse authMechanismProperties', async() => {
        const result = await Connection.from(
          'mongodb://user%40EXAMPLE.COM:secret@localhost/?authMechanismProperties=SERVICE_NAME:other,SERVICE_REALM:blah,CANONICALIZE_HOST_NAME:true&authMechanism=GSSAPI',
        );
        expect(result).to.deep.include({
          gssapiServiceName: 'other',
          gssapiServiceRealm: 'blah',
          gssapiCanonicalizeHostName: true
        });
        expect(result).to.have.property('authMechanism');
        expect(result.authMechanism).to.equal('GSSAPI');
      });

      it('should parse authMechanismProperties', async() => {
        const result = await Connection.from(
          'mongodb://user:password@example.com/?authMechanism=GSSAPI&authSource=$external&gssapiServiceName=mongodb',
        );
        expect(result.gssapiServiceName).to.be.equal('mongodb');
      });
    });

    describe('server selection and discovery options', () => {
      it('should parse multiple options including localThresholdMS, serverSelectionTimeoutMS and heartbeatFrequencyMS', async() => {
        const result = await Connection.from(
          'mongodb://localhost/?replicaSet=test&w=1&ssl=true&readPreference=secondary&serverSelectionTimeoutMS=25000&localThresholdMS=30&heartbeatFrequencyMS=20000',
        );
        expect(result.localThresholdMS).to.be.equal(30);
        expect(result.serverSelectionTimeoutMS).to.be.equal(25000);
        expect(result.heartbeatFrequencyMS).to.be.equal(20000);
      });

      it('should parse serverSelectionTryOnce', async() => {
        const result = await Connection.from(
          'mongodb://a/?serverSelectionTryOnce=false',
        );
        expect(result.serverSelectionTryOnce).to.be.equal(false);
      });

      it('defaults directConnection undefined', async() => {
        const result = await Connection.from(
          'mongodb://localhost:27017',
        );
        expect(result.directConnection).to.be.equal(undefined);
      });

      it('saves directConnection true', async() => {
        const result = await Connection.from(
          'mongodb://localhost:27017/?directConnection=true',
        );
        expect(result.directConnection).to.be.equal(true);
      });

      it('saves directConnection false', async() => {
        const result = await Connection.from(
          'mongodb://localhost:27017/?directConnection=false',
        );
        expect(result.directConnection).to.be.equal(false);
      });
    });

    describe('miscellaneous configuration', () => {
      it('should parse appname', async() => {
        const result = await Connection.from('mongodb://localhost/?appname=foo');
        expect(result.appname).to.be.equal('foo');
      });

      it('should parse retryWrites with invalid value eql 1', async() => {
        const result = await Connection.from('mongodb://hostname?retryWrites=1');
        expect(result.retryWrites).to.be.equal(false); // retryWrites expects a bool value. Other values are being treated as false
      });

      it('should parse retryWrites with invalid value eql 3', async() => {
        const result = await Connection.from('mongodb://hostname?retryWrites=1');
        expect(result.retryWrites).to.be.equal(false);
      });

      it('should parse retryWrites with false value', async() => {
        const result = await Connection.from(
          'mongodb://hostname?retryWrites=false',
        );
        expect(result.retryWrites).to.be.equal(false);
      });

      it('should parse retryWrites with true value', async() => {
        const result = await Connection.from(
          'mongodb://hostname?retryWrites=true',
        );
        expect(result.retryWrites).to.be.equal(true);
      });

      it('should parse uuidRepresentation', async() => {
        const result = await Connection.from(
          'mongodb://foo/?uuidrepresentation=csharpLegacy',
        );
        expect(result.uuidRepresentation).to.be.equal('csharpLegacy');
      });
    });
  });
});
