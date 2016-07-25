/* eslint no-console:0 */
var assert = require('assert');
var Connection = require('../');
var connect = Connection.connect;
var Instance = require('mongodb-instance-model');

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

  describe('cloud #slow', function() {
    data.MATRIX.map(function(d) {
      it(format('should connect to `%s`', d.name), function(done) {
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
      _db.db('mongodb').collection('fanclub').find({}, {limit: 10}, function(err, docs) {
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
