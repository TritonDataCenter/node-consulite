'use strict';

// Load modules

const Wreck = require('wreck');


// Declare internals

const internals = {
  hosts: {}
};


exports.getService = function (name, callback) {
  if (internals.hosts[name] && internals.hosts[name].length) {
    return callback(null, internals.selectNext(internals.hosts[name]));
  }

  exports.refreshService(name, (err) => {
    if (err) {
      return callback(err);
    }

    callback(null, internals.selectNext(internals.hosts[name]));
  });
};


exports.refreshService = function (name, callback) {
  const wreck = Wreck.defaults({
    baseUrl: `http://${process.env.CONSUL_HOST || 'consul'}:${process.env.CONSUL_PORT || 8500}/v1/health/service/`,
    json: 'force'
  });

  wreck.get(`${name}?passing&near=agent`, (err, res, payload) => {
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

    callback();
  });
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
