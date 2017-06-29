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


exports.getServiceNames = function (callback) {
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

  wreck.get(`${consul}/v1/catalog/services`, (err, res, payload) => {
    if (err) {
      return callback(err);
    }

    payload = payload || {};

    callback(null, Object.keys(payload));
  });

  return callback.promise;
};

exports.getServiceStatus = function (name, callback) {
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

  wreck.get(`${consul}/v1/health/service/${name}`, (err, res, payload) => {
    if (err) {
      return callback(err);
    }

    const nodes = (payload || []).map((node) => {
      const result = {
        node: node.Node.Node,             // I didn't create this structure
        address: node.Service.Address,
        port: node.Service.Port,
        status: ''
      };

      (node.Checks || []).some((check) => {
        if (check.ServiceName === name) {
          result.status = check.Status;
          return true;
        }

        return false;
      });

      return result;
    });

    callback(null, nodes);
  });

  return callback.promise;
};

exports.getService = function (name, callback) {
  callback = callback || OrPromise();
  exports.getServiceHosts(name, (err, hosts) => {
    if (err) {
      return callback(err);
    }
    callback(null, internals.selectNext(hosts));
  });

  return callback.promise;
};


exports.getServiceHosts = function (name, callback) {
  callback = callback || OrPromise();
  const hosts = exports.getCachedServiceHosts(name);

  if (hosts) {
    setImmediate(callback, null, hosts.slice());
    return callback.promise;
  }

  exports.refreshService(name, (err, hosts) => {
    if (err) {
      return callback(err);
    }

    callback(null, hosts.slice());
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


exports.getCachedServiceHosts = function (name) {
  const services = internals.hosts[name];
  if (!services) {
    return null;
  }

  return services.slice();
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
  let i = 0;
  for (; i < services.length; ++i) {
    const service = services[i];
    if (!service.executed) {
      service.executed = true;
      return service;
    }
  }

  for (i = 0; i < services.length; ++i) {
    delete services[i].executed;
  }

  services[0].executed = true;
  return services[0];
};
