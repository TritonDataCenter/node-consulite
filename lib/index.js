'use strict';

// Load modules

const Wreck = require('wreck');
const OrPromise = require('or-promise');


// Declare internals

const internals = {
  hosts: {}
};


exports.config = function (config) {
  internals.consul = config.consul;
};


exports.getService = function (name, callback) {
  callback = callback || OrPromise();
  if (internals.hosts[name] && internals.hosts[name].length) {
    setImmediate(callback, null, internals.selectNext(internals.hosts[name]));
    return callback.promise;
  }

  exports.refreshService(name, (err) => {
    if (err) {
      return callback(err);
    }

    callback(null, internals.selectNext(internals.hosts[name]));
  });
  return callback.promise;
};


exports.getCachedService = function (name) {
  const services = internals.hosts[name];
  if (!services) {
    return null;
  }
  return internals.selectNext(services);
};


exports.refreshService = function (name, callback) {
  callback = callback || OrPromise();
  let consul = internals.consul;
  if (!consul) {
    const consulHost = process.env.CONSUL_HOST || 'consul';
    const consulPort = process.env.CONSUL_PORT || 8500;
    consul = `${consulHost}:${consulPort}`;
  }

  if (consul.indexOf('http') !== 0) {
    consul = 'http://' + consul;
  }

  const wreck = Wreck.defaults({ json: 'force' });

  wreck.get(`${consul}/v1/health/service/${name}?passing&near=agent`, (err, res, payload) => {
    if (err) {
      return callback(err);
    }

    if (!payload || !payload.length) {
      return callback(new Error(`Service ${name} couldn't be found`));
    }

    const hosts = payload.map((host) => {
      return {
        address: host.Service.Address,
        port: host.Service.Port
      };
    });

    internals.hosts[name] = hosts;

    callback(null, hosts);
  });

  return callback.promise;
};


// Round robin the services
internals.selectNext = function (services) {
  const now = Date.now();
  let oldest = { executed: now };
  for (let i = 0; i < services.length; ++i) {
    const service = services[i];
    if (!service.executed) {
      oldest = service;
      break;
    }

    if (service.executed < oldest.executed) {
      oldest = service;
    }
  }

  oldest.executed = now;
  return oldest;
};
