'use strict';

// Load modules

const util = require('util');
const Wreck = require('@hapi/wreck');

// Custom variant of promises for setImmediate, see https://nodejs.org/api/timers.html#timers_setimmediate_callback_args
const setImmediatePromise = util.promisify(setImmediate);

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


  async getServiceNames () {
    const { payload } = await this._wreck.get('/v1/catalog/services');
    return Object.keys(payload);
  }


  async getServiceStatus (name) {
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

      return result;
    });

    return nodes;
  }


  async getService (name) {
    const hosts = await this.getServiceHosts(name);

    return internals.selectNext(hosts);
  }

  async getServiceHosts (name) {
    const cachedHosts = this.getCachedServiceHosts(name);

    if (cachedHosts) {
      await setImmediatePromise();
      return cachedHosts.slice();
    }

    const hosts = await this.refreshService(name);

    return hosts.slice();
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


  async refreshService (name) {
    const { payload } = await this._wreck.get(`/v1/health/service/${name}?passing&near=agent`);
    if (!payload || !payload.length) {
      throw new Error(`Service ${name} couldn't be found`);
    }

    const hosts = payload.map((host) => {
      return {
        address: host.Service.Address,
        port: host.Service.Port
      };
    });

    this._hosts[name] = hosts;

    return hosts;
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
