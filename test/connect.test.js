/* eslint no-console:0 */
var assert = require('assert');
var Instance = require('mongodb-instance-model');
var Connection = require('../');
var connect = Connection.connect;
// var createSSHTunnel = require('../lib/ssh-tunnel');
var mock = require('mock-require');
var sinon = require('sinon');

var shouldGetInstanceDetails = function(db, done) {
  assert(db);
  Instance.fetch(db, done);
};

var format = require('util').format;
var data = require('mongodb-connection-fixture');

describe('mongodb-connection#connect', function() {
  describe('local', function() {
    this.slow(2000);
    this.timeout(10000);
    before(require('mongodb-runner/mocha/before')());
    after(require('mongodb-runner/mocha/after')());
    it('should connect to `localhost:27017`', function(done) {
      var model = Connection.from('mongodb://localhost:27017');
      connect(model, function(err, _db) {
        if (err) {
          return done(err);
        }
        shouldGetInstanceDetails(_db, done);
      });
    });
  });

  it('should close ssh tunnel if connection fails', function(done) {
    var close = sinon.spy();
    mock('../lib/ssh-tunnel', function() {
      console.log('mock tunnel');
      return {close: close};
    });
    var MockConnection = mock.reRequire('../');
    var mockConnect = MockConnection.connect;
    var model = new MockConnection({
      hostname: 'localhost',
      port: '27017',
      ssh_tunnel: 'USER_PASSWORD',
      ssh_tunnel_hostname: 'my.ssh-server.com',
      ssh_tunnel_password: 'password',
      ssh_tunnel_username: 'my-user'
    });
    assert(model.isValid());
    // state.on('status', function() {
    //   console.log('status', arguments);
    // });
    // var tasks = connect.getTasks(model);
    // var tunnel = tasks.tunnel;
    var state = mockConnect(model, function(err) {
      if (err) {
        console.log('inside connect error');
      }
    });
    state.on('status', function(evt) {
      console.log('event: ', evt);
      if (evt.message === 'Closing SSH Tunnel' && evt.complete) {
        done();
      }
    });
  });

  describe('cloud #slow', function() {
    const regex = /🔒  integrations@2.6 Cluster: /; // eslint-disable-line no-regex-spaces
    data.MATRIX.map(function(d) {
      it(format('should connect to `%s`', d.name), function(done) {
        if (regex.test(d.name)) {
          console.log('Skipping test pending COMPASS-460');
          console.log(regex);
          this.skip();
          return;
        }
        this.slow(5000);
        this.timeout(10000);

        connect(d, function(err, _db) {
          if (err) {
            return done(err);
          }
          _db.close();
          done();
        });
      });
    });

    var find = function(_db, done) {
      _db.db('mongodb').collection('fanclub').find({}, {
        limit: 10
      }, function(err, docs) {
        if (err) {
          return done(err);
        }
        assert.equal(docs.length, 10);
        done();
      });
    };

    data.SSH_TUNNEL_MATRIX.map(function(d) {
      it('connects via the ssh_tunnel to ' + d.ssh_tunnel_hostname, function(done) {
        connect(d, function(err, _db) {
          if (err) {
            return done(err);
          }
          find(_db, done);
        });
      });
    });
  });
});
