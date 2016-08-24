# consulite
Tiny consul Node.js module for client discovery


## API

Consulite uses the following environment variables to determine the consul
instance to connect to.
* `CONSUL_HOST`: defaults to 'consul'
* `CONSUL_PORT`: defaults to 8500


### getService(name, callback)

* `name`: the service name registered with consul. If no services are found
then an error will be returned to the callback. If multiple services are found
then the service that hasn't been executed or hasn't been executed most recently
will be returned in the callback.

* `callback`: function with the signature `(err, service)` where `service` has
the following properties:
  - `address`: the host address where the service is located
  - `port`: the port that the service is exposed on



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
