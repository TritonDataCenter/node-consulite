'use strict';

// Load modules

const Wreck = require('@hapi/wreck');
const OrPromise = require('or-promise');


// Declare internals

const internals = {};


module.exports = class Consulite {
  constructor (options) {
    options = options || {};

    let consul = options.consul;
    if (!consul) {
      const consulHost = process.env.CONSUL_HOST || 'consul';
      const consulPort = process.env.CONSUL_PORT || 8500;
      consul = `${consulHost}:${consulPort}`;
    }

    if (consul.indexOf('http') !== 0) {
      consul = 'http://' + consul;
    }

    this._wreck = Wreck.defaults({ baseUrl: consul, json: 'force' });
    this._hosts = {};
  }


  async getServiceNames (callback) {
    try {
      const { payload } = await this._wreck.get('/v1/catalog/services');
      return Object.keys(payload);
    } catch (ex) {
      return ex;
    }
  }


  async getServiceStatus (name, callback) {
    try {
      const { payload } = await this._wreck.get(`/v1/health/service/${name}`);
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

        return nodes;
      });
    } catch (ex) {
      return ex;
    }
  }


  getService (name, callback) {
    callback = callback || OrPromise();
    this.getServiceHosts(name, (err, hosts) => {
      if (err) {
        return callback(err);
      }
      callback(null, internals.selectNext(hosts));
    });

    return callback.promise;
  }

  getServiceHosts (name, callback) {
    callback = callback || OrPromise();
    const hosts = this.getCachedServiceHosts(name);

    if (hosts) {
      setImmediate(callback, null, hosts.slice());
      return callback.promise;
    }

    this.refreshService(name, (err, hosts) => {
      if (err) {
        return callback(err);
      }

      callback(null, hosts.slice());
    });
    return callback.promise;
  }


  getCachedService (name) {
    const services = this._hosts[name];
    if (!services) {
      return null;
    }

    return internals.selectNext(services);
  }


  getCachedServiceHosts (name) {
    const services = this._hosts[name];
    if (!services) {
      return null;
    }

    return services.slice();
  }


  async refreshService (name, callback) {
    try {
      const { payload } = await this._wreck.get(`/v1/health/service/${name}?passing&near=agent`);
      if (!payload || !payload.length) {
        throw `Service ${name} couldn't be found`;
      }

      const hosts = payload.map((host) => {
        return {
          address: host.Service.Address,
          port: host.Service.Port
        };
      });

      this._hosts[name] = hosts;

      return hosts;
    } catch (ex) {
      return ex;
    }
  }
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
