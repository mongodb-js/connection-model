const Connection = require('../');
const chai = require('chai');
const expect = chai.expect;

chai.use(require('chai-subset'));

describe('connection model should parse URI components such as', () => {
  describe('prefix', () => {
    it('should not set isSrvRecord', (done) => {
      Connection.from(
        'mongodb://mongodb1.example.com:27317,mongodb2.example.com:27017/?replicaSet=mySet&authSource=authDB',
        (error, result) => {
          expect(error).to.not.exist;
          expect(result.isSrvRecord).to.be.equal(false);
          done();
        }
      );
    });
  });

  describe('authentication credentials', () => {
    it('should parse username and password', (done) => {
      Connection.from(
        'mongodb://someUsername:testPassword@localhost',
        (error, result) => {
          expect(error).to.not.exist;
          expect(result.hostname).to.be.equal('localhost');
          expect(result).to.have.property('auth');
          expect(result.auth.username).to.be.equal('someUsername');
          expect(result.auth.password).to.be.equal('testPassword');
          expect(result.auth.db).to.be.equal('admin');
          expect(result.authentication).to.be.equal('MONGODB');
          done();
        }
      );
    });

    it('should not return authentication info', (done) => {
      Connection.from(
        'mongodb://localhost',
        (error, result) => {
          expect(error).to.not.exist;
          expect(result.hostname).to.be.equal('localhost');
          expect(result.auth).to.be.equal(null);
          expect(result.authentication).to.be.equal('NONE');
          done();
        }
      );
    });
  });

  describe('connection string options that include', () => {
    describe('replica set options', () => {
      it('should parse replicaSet', (done) => {
        Connection.from(
          'mongodb://db0.example.com:27017,db1.example.com:27017,db2.example.com:27017/admin?replicaSet=myRepl',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.replicaSet).to.be.equal('myRepl');
            expect(result.hostname).to.be.equal('db0.example.com');
            expect(result.port).to.be.equal(27017);
            expect(result.ns).to.be.equal('admin');
            done();
          }
        );
      });
    });

    describe('connection options', () => {
      it('should parse ssl', (done) => {
        Connection.from(
          'mongodb://db0.example.com,db1.example.com,db2.example.com/?replicaSet=myReplOther&ssl=true',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.replicaSet).to.be.equal('myReplOther');
            expect(result.options.ssl).to.be.equal(true);
            done();
          }
         );
      });

      it('should parse connectTimeoutMS', (done) => {
        Connection.from(
          'mongodb://mongodb1.example.com:27317,mongodb2.example.com:27017/?connectTimeoutMS=300000&replicaSet=mySet&authSource=aDifferentAuthDB',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.connectTimeoutMS).to.be.equal(300000);
            done();
          }
         );
      });

      it('should parse socketTimeoutMS with w', (done) => {
        Connection.from(
          'mongodb://localhost:27017/sampleDb?socketTimeoutMS=30000&w=majority',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.socketTimeoutMS).to.be.equal(30000);
            done();
          }
         );
      });

      it('should parse socketTimeoutMS with multiple servers', (done) => {
        Connection.from(
          'mongodb://localhost:27017,localhost:27018,localhost:27019/sampleDb?replicaSet=rs0&socketTimeoutMS=5000',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.socketTimeoutMS).to.be.equal(5000);
            done();
          }
         );
      });

      it('should parse compressors with snappy value', (done) => {
        Connection.from(
          'mongodb://localhost/?compressors=snappy',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options).to.have.property('compression');
            expect(result.options.compression.compressors).to.have.lengthOf(1);
            expect(result.options.compression.compressors).to.include('snappy');
            done();
          }
         );
      });

      it('should parse compressors with zlib value', (done) => {
        Connection.from(
          'mongodb://localhost/?compressors=zlib',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options).to.have.property('compression');
            expect(result.options.compression.compressors).to.have.lengthOf(1);
            expect(result.options.compression.compressors).to.include('zlib');
            done();
          }
         );
      });

      it('should throw the error if compressors contain invalid value', (done) => {
        Connection.from(
          'mongodb://localhost/?compressors=bunnies',
          (error) => {
            expect(error).to.exist;
            done();
          }
         );
      });

      it('should parse compressors with snappy and zlib values', (done) => {
        Connection.from(
          'mongodb://localhost/?compressors=snappy,zlib',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options).to.have.property('compression');
            expect(result.options.compression.compressors).to.have.lengthOf(2);
            expect(result.options.compression.compressors).to.include('zlib');
            expect(result.options.compression.compressors).to.include('snappy');
            done();
          }
         );
      });

      it('should parse zlibCompressionLevel', (done) => {
        Connection.from(
          'mongodb://localhost/?compressors=zlib&zlibCompressionLevel=4',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options).to.have.property('compression');
            expect(result.options.compression).to.eql({
              compressors: ['zlib'],
              zlibCompressionLevel: 4
            });
            done();
          }
         );
      });

      it('should throw the error if zlibCompressionLevel has invalid value', (done) => {
        Connection.from(
          'mongodb://localhost/?zlibCompressionLevel=15',
          (error) => {
            expect(error).to.exist;
            done();
          }
         );
      });
    });

    describe('connection pool options', () => {
      it('should parse minPoolSize and maxPoolSize', (done) => {
        Connection.from(
          'mongodb://localhost:27017,localhost:27018,localhost:27019/databasename?replicaSet=rs01&ssl=false&connectTimeoutMS=100000&minPoolSize=5&maxPoolSize=10',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.minPoolSize).to.be.equal(5);
            expect(result.options.maxPoolSize).to.be.equal(10);
            done();
          }
         );
      });

      it('should parse maxIdleTimeMS', (done) => {
        Connection.from(
          'mongodb://localhost/test?maxIdleTimeMS=30000',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.maxIdleTimeMS).to.be.equal(30000);
            done();
          }
         );
      });

      it('should parse waitQueueMultiple', (done) => {
        Connection.from(
          'mongodb://user:password@ip:27017/?waitQueueMultiple=10',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.waitQueueMultiple).to.be.equal(10);
            done();
          }
         );
      });

      it('should parse escaped URI with maxIdleTimeMS, waitQueueTimeoutMS, waitQueueTimeoutMS and journal', (done) => {
        Connection.from(
          'mongodb://localhost/test?readPreference=primary&amp;maxPoolSize=50&amp;minPoolSize=5&amp;maxIdleTimeMS=1000&amp;waitQueueMultiple=200&amp;waitQueueTimeoutMS=100&amp;w=1&amp;journal=true',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.journal).to.be.equal(true);
            expect(result.options.maxIdleTimeMS).to.be.equal(1000);
            expect(result.options.waitQueueMultiple).to.be.equal(200);
            expect(result.options.waitQueueTimeoutMS).to.be.equal(100);
            done();
          }
         );
      });
    });

    describe('write concern options', () => {
      it('should parse write concern w option with number value', (done) => {
        Connection.from(
          'mongodb://localhost/DBName?replicaSet=xxxx&w=1&readPreference=nearest&maxPoolSize=50',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.w).to.be.equal(1);
            done();
          }
         );
      });

      it('should parse write concern w option with majority value', (done) => {
        Connection.from(
          'mongodb://localhost/DBName?replicaSet=xxxx&w=majority',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.w).to.be.equal('majority');
            done();
          }
         );
      });

      it('should parse write concern w option with tag set value', (done) => {
        Connection.from(
          'mongodb://localhost/DBName?w=MultipleDC',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.w).to.be.equal('MultipleDC');
            done();
          }
         );
      });

      it('should parse wTimeoutMS', (done) => {
        Connection.from(
          'mongodb://host1:port1,host2:port2/?ssl=1&wtimeoutMS=1000', // Note the difference `wtimeoutMS` and `wTimeoutMS`
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.wTimeoutMS).to.be.equal(1000); // Returned value was camelCased
            done();
          }
         );
      });

      it('should parse journal', (done) => {
        Connection.from(
          'mongodb://localhost/test?readPreference=primary&w=1&journal=true',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.journal).to.be.equal(true);
            done();
          }
         );
      });

      it('should parse j option', (done) => {
        Connection.from(
          'mongodb://localhost/test?readPreference=primary&w=1&j=true',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.journal).to.be.equal(true); // Converts j=true to journal=true
            done();
          }
         );
      });

      it('should parse wtimeout', (done) => {
        Connection.from(
          'mongodb://localhost/test?w=1&wtimeout=2500',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.wTimeoutMS).to.be.equal(2500); // Converts jwtimeout to wTimeoutMS
            done();
          }
         );
      });
    });

    describe('read concern options', () => {
      it('should parse readConcernLevel with local value', (done) => {
        Connection.from(
          'mongodb://localhost/?readConcernLevel=local',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options).to.have.property('readConcern');
            expect(result.options.readConcern).to.eql({ level: 'local' });
            done();
          }
         );
      });

      it('should parse readConcernLevel with majority value', (done) => {
        Connection.from(
          'mongodb://db0.example.com,db1.example.com,db2.example.com/?replicaSet=myRepl&readConcernLevel=majority',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options).to.have.property('readConcern');
            expect(result.options.readConcern).to.eql({ level: 'majority' });
            done();
          }
         );
      });
    });

    describe('read preference options', () => {
      it('should parse readPreference and maxStalenessSeconds', (done) => {
        Connection.from(
          'mongodb://mongos1.example.com,mongos2.example.com/?readPreference=secondary&maxStalenessSeconds=120',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.readPreference).to.be.equal('secondary');
            expect(result.options.maxStalenessSeconds).to.be.equal(120);
            done();
          }
         );
      });

      it('should throw the error if readPreference has invalid value', (done) => {
        Connection.from(
          'mongodb://localhost/?readPreference=llamasPreferred',
          (error) => {
            expect(error).to.exist;
            done();
          }
         );
      });

      it('should parse readPreference and readPreferenceTags', (done) => {
        Connection.from(
          'mongodb://mongos1.example.com,mongos2.example.com/?readPreference=secondary&readPreferenceTags=dc:ny,rack:1',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.readPreference).to.be.equal('secondary');
            expect(result.options).to.have.property('readPreferenceTags');
            expect(result.options.readPreferenceTags).to.eql({ dc: 'ny', rack: 1 });
            done();
          }
         );
      });
    });

    describe('authentication options', () => {
      it('should parse authSource', (done) => {
        Connection.from(
          'mongodb://myDBReader:D1fficultP%40ssw0rd@mongodb0.example.com:27017,mongodb1.example.com:27017,mongodb2.example.com:27017/test?replicaSet=myRepl&authSource=admin',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options).to.have.property('authSource');
            expect(result.options.authSource).to.equal('admin');
            done();
          }
         );
      });

      it('should parse authSource and authMechanism', (done) => {
        Connection.from(
          'mongodb://user:password@example.com/?authSource=theDatabase&authMechanism=SCRAM-SHA-256',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.authSource).to.be.equal('theDatabase');
            expect(result.options.authMechanism).to.be.equal('SCRAM-SHA-256');
            done();
          }
         );
      });

      it('should throw the error if authMechanism has invalid value', (done) => {
        Connection.from(
          'mongodb://localhost/?authMechanism=DOGS',
          (error) => {
            expect(error).to.exist;
            done();
          }
         );
      });

      it('should parse authMechanismProperties', (done) => {
        Connection.from(
          'mongodb://user%40EXAMPLE.COM:secret@localhost/?authMechanismProperties=SERVICE_NAME:other,SERVICE_REALM:blah,CANONICALIZE_HOST_NAME:true&authMechanism=GSSAPI',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options).to.deep.include({
              gssapiServiceName: 'other',
              gssapiServiceRealm: 'blah',
              gssapiCanonicalizeHostName: true
            });
            expect(result.options).to.have.property('authMechanism');
            expect(result.options.authMechanism).to.equal('GSSAPI');
            done();
          }
         );
      });

      it('should parse authMechanismProperties', (done) => {
        Connection.from(
          'mongodb://user:password@example.com/?authMechanism=GSSAPI&authSource=$external&gssapiServiceName=mongodb',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.gssapiServiceName).to.be.equal('mongodb');
            done();
          }
         );
      });
    });

    describe('server selection and discovery options', () => {
      it('should parse multiple options including localThresholdMS, serverSelectionTimeoutMS and heartbeatFrequencyMS', (done) => {
        Connection.from(
          'mongodb://localhost/?replicaSet=test&w=1&ssl=true&readPreference=secondary&serverSelectionTimeoutMS=25000&localThresholdMS=30&heartbeatFrequencyMS=20000',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.localThresholdMS).to.be.equal(30);
            expect(result.options.serverSelectionTimeoutMS).to.be.equal(25000);
            expect(result.options.heartbeatFrequencyMS).to.be.equal(20000);
            done();
          }
         );
      });

      it('should parse serverSelectionTryOnce', (done) => {
        Connection.from(
          'mongodb://a/?serverSelectionTryOnce=false',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.serverSelectionTryOnce).to.be.equal(false);
            done();
          }
         );
      });
    });

    describe('miscellaneous configuration', () => {
      it('should parse appName', (done) => {
        Connection.from(
          'mongodb://localhost/?appname=foo',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.appname).to.be.equal('foo');
            done();
          }
         );
      });

      it('should parse retryWrites with invalid value eql 1', (done) => {
        Connection.from(
          'mongodb://hostname?retryWrites=1',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.retryWrites).to.be.equal(false); // retryWrites expects a bool value. Other values are being treated as false
            done();
          }
         );
      });

      it('should parse retryWrites with invalid value eql 3', (done) => {
        Connection.from(
          'mongodb://hostname?retryWrites=1',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.retryWrites).to.be.equal(false);
            done();
          }
         );
      });

      it('should parse retryWrites with false value', (done) => {
        Connection.from(
          'mongodb://hostname?retryWrites=false',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.retryWrites).to.be.equal(false);
            done();
          }
         );
      });

      it('should parse retryWrites with true value', (done) => {
        Connection.from(
          'mongodb://hostname?retryWrites=true',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.retryWrites).to.be.equal(true);
            done();
          }
         );
      });

      it('should parse uuidRepresentation', (done) => {
        Connection.from(
          'mongodb://foo/?uuidrepresentation=csharpLegacy',
          (error, result) => {
            expect(error).to.not.exist;
            expect(result.options.uuidRepresentation).to.be.equal('csharpLegacy');
            done();
          }
         );
      });
    });
  });
});
