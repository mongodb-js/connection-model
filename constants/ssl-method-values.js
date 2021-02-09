// Allowed values for the `sslMethod` field

/**
 * Do not use SSL for anything.
 */
const NONE = 'NONE';
/**
 * Use system CA.
 */
const SYSTEMCA = 'SYSTEMCA';
/**
 * Use SSL if available.
 */
const IFAVAILABLE = 'IFAVAILABLE';
/**
 * Use SSL but do not perform any validation of the certificate chain.
 */
const UNVALIDATED = 'UNVALIDATED';
/**
 * The driver should validate the server certificate and fail to connect if validation fails.
 */
const SERVER = 'SERVER';
/**
 * The driver must present a valid certificate and validate the server certificate.
 */
const ALL = 'ALL';

module.exports = [
  NONE,
  SYSTEMCA,
  IFAVAILABLE,
  UNVALIDATED,
  SERVER,
  ALL
];

module.exports.SSL_METHODS = {
  NONE,
  SYSTEMCA,
  IFAVAILABLE,
  UNVALIDATED,
  SERVER,
  ALL
};
