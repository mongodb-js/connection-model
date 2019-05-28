const Connection = require('../');
const chai = require('chai');
const expect = chai.expect;

chai.use(require('chai-subset'));

describe('connection model should parse URI strings for common connection targets such as', () => {
  it('database server running locally', (done) => {
    Connection.from(
      'mongodb://localhost',
      (error, result) => {
        expect(error).to.not.exist;
        expect(result.hostname).to.be.equal('localhost');
        expect(result.port).to.be.equal(27017);
        done();
      }
    );
  });

  it('admin database', (done) => {
    Connection.from(
      'mongodb://sysop:moon@localhost',
      (error, result) => {
        expect(error).to.not.exist;
        expect(result).to.have.property('auth');
        expect(result.auth.username).to.be.equal('sysop');
        expect(result.auth.password).to.be.equal('moon');
        expect(result.auth.db).to.be.equal('admin');
        done();
      }
    );
  });

  it('records database', (done) => {
    Connection.from(
      'mongodb://sysop:moon@localhost/records',
      (error, result) => {
        expect(error).to.not.exist;
        expect(result).to.have.property('auth');
        expect(result.auth.username).to.be.equal('sysop');
        expect(result.auth.password).to.be.equal('moon');
        expect(result.auth.db).to.be.equal('records');
        done();
      }
    );
  });

  it('UNIX domain socket', (done) => {
    Connection.from(
      'mongodb://%2Ftmp%2Fmongodb-27017.sock',
      (error, result) => {
        expect(error).to.not.exist;
        expect(result.hostname).to.be.equal('/tmp/mongodb-27017.sock');
        expect(result.port).to.be.equal(27017);
        done();
      }
    );
  });

  it('replica set with members on different machines', (done) => {
    Connection.from(
      'mongodb://db1.example.net,db2.example.com/?replicaSet=test',
      (error, result) => {
        expect(error).to.not.exist;
        expect(result.options.replicaSet).to.be.equal('test');
        expect(result).to.have.property('hosts');
        expect(result.hosts).to.have.lengthOf(2);
        expect(result.hosts[0]).to.be.deep.equal({ host: 'db1.example.net', port: 27017 });
        expect(result.hosts[1]).to.be.deep.equal({ host: 'db2.example.com', port: 27017 });
        done();
      }
    );
  });

  it('replica set with members on localhost', (done) => {
    Connection.from(
      'mongodb://localhost,localhost:27018,localhost:27019/?replicaSet=test',
      (error, result) => {
        expect(error).to.not.exist;
        expect(result.options.replicaSet).to.be.equal('test');
        expect(result).to.have.property('hosts');
        expect(result.hosts).to.have.lengthOf(3);
        expect(result.hosts[0]).to.be.deep.equal({ host: 'localhost', port: 27017 });
        expect(result.hosts[1]).to.be.deep.equal({ host: 'localhost', port: 27018 });
        expect(result.hosts[2]).to.be.deep.equal({ host: 'localhost', port: 27019 });
        done();
      }
    );
  });

  it('replica set with read distribution', (done) => {
    Connection.from(
      'mongodb://example1.com,example2.com,example3.com/?replicaSet=test&readPreference=secondary',
      (error, result) => {
        expect(error).to.not.exist;
        expect(result.options.replicaSet).to.be.equal('test');
        expect(result.options.readPreference).to.be.equal('secondary');
        expect(result).to.have.property('hosts');
        expect(result.hosts).to.have.lengthOf(3);
        expect(result.hosts[0]).to.be.deep.equal({ host: 'example1.com', port: 27017 });
        expect(result.hosts[1]).to.be.deep.equal({ host: 'example2.com', port: 27017 });
        expect(result.hosts[2]).to.be.deep.equal({ host: 'example3.com', port: 27017 });
        done();
      }
    );
  });

  it('replica set with a high level of write concern', (done) => {
    Connection.from(
      'mongodb://example1.com,example2.com,example3.com/?replicaSet=test&w=2&wtimeoutMS=2000',
      (error, result) => {
        expect(error).to.not.exist;
        expect(result.options.replicaSet).to.be.equal('test');
        expect(result.options.w).to.be.equal(2);
        expect(result.options.wTimeoutMS).to.be.equal(2000);
        expect(result).to.have.property('hosts');
        expect(result.hosts).to.have.lengthOf(3);
        expect(result.hosts[0]).to.be.deep.equal({ host: 'example1.com', port: 27017 });
        expect(result.hosts[1]).to.be.deep.equal({ host: 'example2.com', port: 27017 });
        expect(result.hosts[2]).to.be.deep.equal({ host: 'example3.com', port: 27017 });
        done();
      }
    );
  });

  it('sharded cluster', (done) => {
    Connection.from(
      'mongodb://router1.example.com:27017,router2.example2.com:27017,router3.example3.com:27017/',
      (error, result) => {
        expect(error).to.not.exist;
        expect(result).to.have.property('hosts');
        expect(result.hosts).to.have.lengthOf(3);
        expect(result.hosts[0]).to.be.deep.equal({ host: 'router1.example.com', port: 27017 });
        expect(result.hosts[1]).to.be.deep.equal({ host: 'router2.example2.com', port: 27017 });
        expect(result.hosts[2]).to.be.deep.equal({ host: 'router3.example3.com', port: 27017 });
        done();
      }
    );
  });

  it('sharded cluster and admin database', (done) => {
    Connection.from(
      'mongodb://mongos0.example.com:27017,mongos1.example.com:27017,mongos2.example.com:27017/admin',
      (error, result) => {
        expect(error).to.not.exist;
        expect(result).to.have.property('hosts');
        expect(result.hosts).to.have.lengthOf(3);
        expect(result.hosts[0]).to.be.deep.equal({ host: 'mongos0.example.com', port: 27017 });
        expect(result.hosts[1]).to.be.deep.equal({ host: 'mongos1.example.com', port: 27017 });
        expect(result.hosts[2]).to.be.deep.equal({ host: 'mongos2.example.com', port: 27017 });
        expect(result).to.have.property('auth');
        expect(result.auth.db).to.be.equal('admin');
        done();
      }
    );
  });

  it('sharded cluster that enforces access control, include user credentials', (done) => {
    Connection.from(
      'mongodb://myDBReader:D1fficultP%40ssw0rd@mongos0.example.com:27017,mongos1.example.com:27017,mongos2.example.com:27017/admin',
      (error, result) => {
        expect(error).to.not.exist;
        expect(result).to.have.property('hosts');
        expect(result.hosts).to.have.lengthOf(3);
        expect(result.hosts[0]).to.be.deep.equal({ host: 'mongos0.example.com', port: 27017 });
        expect(result.hosts[1]).to.be.deep.equal({ host: 'mongos1.example.com', port: 27017 });
        expect(result.hosts[2]).to.be.deep.equal({ host: 'mongos2.example.com', port: 27017 });
        expect(result).to.have.property('auth');
        expect(result.auth.username).to.be.equal('myDBReader');
        expect(result.auth.password).to.be.equal('D1fficultP@ssw0rd');
        expect(result.auth.db).to.be.equal('admin');
        expect(result.ns).to.be.equal('admin');
        expect(result.authentication).to.be.equal('MONGODB');
        done();
      }
    );
  });
});
