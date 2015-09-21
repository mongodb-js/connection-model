var assert = require('assert');
var Connection = require('../');
var url = require('url');
var verifyConnection = require('./verify-connection');
var run = require('mongodb-runner');
var debug = require('debug')('mongodb-connection-model:auth.test');
var tmp = require('tmp');
var fs = require('fs');
var MongoClient = require('mongodb').MongoClient;

/**
 * Test that the connection URL and options are created
 * properly for all of the different authentication features
 * that a user may need.
 */
describe('Integration Tests', function() {
  describe('Standalone', function() {
    describe('SCRAM-SHA-1', function() {
      var opts = {
        action: 'start',
        name: 'standalone-scram-sha-1',
        port: 27000,
        auth_mechanism: "SCRAM_SHA_1",
        username: "adminUser",
        password: "adminPass"
      };
      var tmpobj = null;

      before(function(done) {
        tmpDir = tmp.dirSync({unsafeCleanup:true});
        opts.dbpath = tmpDir.name;
        debug("DB Dir: ", tmpDir.name);

        tmpKeyFile = tmp.fileSync();
        fs.writeFileSync(tmpKeyFile.name, 'testkeyfiledata');
        debug("KeyFile: ", tmpKeyFile.name);
        opts.keyFile = tmpKeyFile.name;

        run(opts, function(err) {
          if (err) return done(err);
          done();
        });
      });

      after(function(done) {
        opts.action = 'stop';
        run(opts, function(err) {
          if (err) return done(err);
          //tmpDir.removeCallback();
          //tmpKeyFile.removeCallback();
          done();
        });
      });

      it('should connect to a mongod with scram-sha-1 enabled', function(done) {
        var connection = new Connection({
          port: opts.port,
          mongodb_username: 'adminUser',
          mongodb_password: 'adminPass'
        });
        MongoClient.connect(connection.uri, connection.options, function(err, db) {
          assert.ifError(err);
          done();
        });
      });

     it('should not connect to a mongod with scram-sha-1 enabled and the wrong username/password', function(done) {
        var connection = new Connection({
          port: opts.port,
          mongodb_username: 'adminUser',
          mongodb_password: 'adminPassWrong'
        });
        MongoClient.connect(connection.uri, connection.options, function(err, db) {
          assert(err, 'No error on wrong credentials.');
          done();
        });
      });
    });
  });
});