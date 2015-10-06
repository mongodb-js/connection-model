# mongodb-connection-model [![][travis_img]][travis_url] [![][npm_img]][npm_url]

> MongoDB connection model.


## Installation

```
npm install --save mongodb-connection-model
```

## Usage

```javascript
var Connection = require('mongodb-connection-model');
```

### Metadata

- `hostname` (optional, String) ... Hostname of a MongoDB Instance [Default: `localhost`].
- `port` (optional, Number) ... TCP port of a MongoDB Instance [Default: `27017`].
- `name` (optional, String) ... User specified name [Default: `My MongoDB`].

### Authentication

- `authentication` (optional, String) ... The desired authetication strategy [Default: `NONE`]
  - `NONE` Use no authentication.
  - `MONGODB` Allow the driver to autodetect and select SCRAM-SHA-1 or MONGODB-CR depending on server capabilities.
  - `KERBEROS`
  - `X509`
  - `LDAP`

#### 1. No Authentication

```javascript
var model = new Connection({
  authentication: 'NONE'
});
console.log(model.driver_url);
>>> 'mongodb://localhost:27017?slaveOk=true'

console.log(new Connection().driver_url);
>>> 'mongodb://localhost:27017?slaveOk=true'
```

#### 2. MongoDB Authentication

- `mongodb_username` (**required**, String)
- `mongodb_password` (**required**, String)
- `mongodb_database_name` (optional, String) [Default: `admin`]

```javascript
var model = new Connection({
  authentication: 'MONGODB',
  mongodb_username: 'arlo',
  mongodb_password: 'B@sil'
});
console.log(model.driver_url);
>>> 'mongodb://arlo:B%40sil@localhost:27017?slaveOk=true&authSource=admin'
```

#### 3. Kerberos Authentication

![][enterprise_img]

- `kerberos_principal` (**required**, String) ... The format of a typical Kerberos V5 principal is `primary/instance@REALM`.
- `kerberos_password` (optional, String) ... [Default: `undefined`].
- `kerberos_service_name` (optional, String) ... [Default: `mongodb`].

[node.js driver Kerberos reference](http://bit.ly/mongodb-node-driver-kerberos)

```javascript
var model = new Connection({
  authentication: 'KERBEROS',
  kerberos_principal: 'arlo@MONGODB.PARTS'
});
console.log(model.driver_url);
>>> 'mongodb://arlo%2540MONGODB.PARTS@localhost:27017/kerberos?slaveOk=true&gssapiServiceName=mongodb&authMechanism=GSSAPI'
```

#### Kerberos Windows Variant

- `/#{instance}`

```javascript
var model = new Connection({
  authentication: 'KERBEROS',
  kerberos_principal: 'arlo/admin@MONGODB.PARTS',
  kerberos_password: 'B@sil',
  kerberos_service_name: 'mongodb'
});
console.log(model.driver_url);
>>> 'mongodb://arlo%252Fadmin%2540MONGODB.PARTS:B%40sil@localhost:27017/kerberos?slaveOk=true&gssapiServiceName=mongodb&authMechanism=GSSAPI'
```

#### 4. X509 Authentication

![][enterprise_img] ![][coming_soon_img]

[node.js driver X509 reference](http://bit.ly/mongodb-node-driver-x509)

#### 5. LDAP Authentication

![][enterprise_img] ![][coming_soon_img]

[node.js driver LDAP reference](http://bit.ly/mongodb-node-driver-ldap)

### `ssl`

> **Note**: Not to be confused with `authentication=X509`.

#### 1. No SSL

#### 2. No validation of certificate chain

#### 3. Driver should validate Server certificate

#### 4. Driver should validate Server certificate and present valid Certificate

## Testing

```
npm test
```

## License

Apache 2.0

## Questions

[![][gitter_img]][gitter_url]

[travis_img]: https://img.shields.io/travis/mongodb-js/mongodb-connection-model.svg?style=flat-square
[travis_url]: https://travis-ci.org/mongodb-js/mongodb-connection-model
[npm_img]: https://img.shields.io/npm/v/mongodb-connection-model.svg?style=flat-square
[npm_url]: https://www.npmjs.org/package/mongodb-connection-model
[gitter_img]: https://badges.gitter.im/Join%20Chat.svg
[gitter_url]: http://gitter.im/mongodb-js/mongodb-js
[enterprise_img]: https://img.shields.io/badge/MongoDB-Enterprise-blue.svg?style=flat-square
[coming_soon_img]: https://img.shields.io/badge/-Coming%20Soon-ff69b4.svg?style=flat-square
