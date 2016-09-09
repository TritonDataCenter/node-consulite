# consulite
Tiny consul Node.js module for client discovery with round-robin support

[![Npm Version](https://img.shields.io/npm/v/consulite.svg)](https://npmjs.com/package/consulite)
[![Node Version](https://img.shields.io/node/v/consulite.svg)](https://npmjs.com/package/consulite)
[![Build Status](https://secure.travis-ci.org/joyent/node-consulite.svg)](http://travis-ci.org/joyent/node-consulite)

## API

The consul instance to connect to can be configured either through the `config()`
function or through the following environment variables:
* `CONSUL_HOST`: defaults to 'consul'
* `CONSUL_PORT`: defaults to 8500


### config(config)

Configure consulite with any of the following settings
* `consul` - the base URL to use to connect to consul


### getService(name [, callback])

Get service address information from cache or from consul. When multiple service
instances are registered with consul the first instance that hasn't been executed
or the oldest executed service is returned.

* `name`: the service name registered with consul. If no services are found
then an error will be returned to the callback. If multiple services are found
then the service that hasn't been executed or hasn't been executed most recently
will be returned in the callback.

* `callback`: function with the signature `(err, service)` where `service` has
the following properties:
  - `address`: the host address where the service is located
  - `port`: the port that the service is exposed on

This function returns a `Promise` if no `callback` is provided.


### getCachedService(name)

Get the next service from the cache if it exists, otherwise return null;


### refreshService(name [, callback])

Makes a request to consul for the given service name and caches the results. Only
services that are healthy are cached.

* `name`: the service name to fetch from consul.
* `callback`: function with signature `(err, services)`

This function returns a `Promise` if no `callback` is provided.


## Example Usage

```js
const Consulite = require('consulite');
const Wreck = require('wreck');

Consulite.getService('users', (err, service) {
  if (err) {
    console.error(err);
    return;
  }

  Wreck.get(`http://${service.address}:${service.port}/users`, (err, res, payload) => {
    // handle error and do something with results
  });
});
```

If you want to set the consul address to use and don't want to depend on
environment variables you can use the `config()` function as demonstrated below:

```js
const Consulite = require('consulite');
const Wreck = require('wreck');

Consulite.config({ consul: 'http://myconsul.com' });

Consulite.getService('users', (err, service) {
  if (err) {
    console.error(err);
    return;
  }

  Wreck.get(`http://${service.address}:${service.port}/users`, (err, res, payload) => {
    // handle error and do something with results
  });
});
```
