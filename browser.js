module.exports = require('./lib/extended-model');

/*
 * @todo (imlucas): Should `mongodb-js-client` monkey patch this?
 */
module.exports.connect = function(model, done) {
  done(new Error('Connect via browser not implemented'));
};
