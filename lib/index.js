'use strict';

// Load modules

const Wreck = require('wreck');
const OrPromise = require('or-promise');


// Declare internals

const internals = {};

function isSingleObject (args) {
  if (args.length !== 1) {
    return false;
  }

  const prototype = Object.prototype.toString.call(args[0]);
  return prototype === '[object Object]';
}

function getArgs (args, template) {
  if (isSingleObject(args)) {
    return args[0];
  }

  const result = {};
  Object.getOwnPropertyNames(template).forEach((p) => {
    const idx = template[p];
    if (args.length >= idx) {
      result[p] = args[idx];
    }
  });

  return result;
}

function getUri (path, queryObj) {
  const query = [];
  Object.getOwnPropertyNames(queryObj).forEach((p) => {
    if (queryObj[p] === undefined) { return; }
    if (p === 'nodeMeta') {
      Object.getOwnPropertyNames(queryObj.nodeMeta).forEach((p) => {
        query.push(`node-meta=${p}=${queryObj.nodeMeta[p]}`);
      });
    } else {
      query.push(`${p}=${queryObj[p]}`);
    }
  });
  return `${path}?${query.join('&')}`;
}


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


  getServiceNames () {
    const cfg = getArgs(arguments, {
      callback: 0
    });
    const callback = cfg.callback || OrPromise();

    const {dc, nodeMeta} = cfg;
    const uri = getUri('/v1/catalog/services', {dc, nodeMeta});

    this._wreck.get(uri, (err, res, payload) => {
      if (err) {
        return callback(err);
      }

      payload = payload || {};

      callback(null, Object.keys(payload));
    });

    return callback.promise;
  }


  getServiceStatus () {
    const cfg = getArgs(arguments, {
      callback: 1,
      name: 0
    });

    const {name, dc, tag, nodeMeta, near} = cfg;
    const callback = cfg.callback || OrPromise();
    const uri = getUri(`/v1/health/service/${name}`, {
      dc, tag, nodeMeta, near
    });

    this._wreck.get(uri, (err, res, payload) => {
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
  }


  getService () {
    const cfg = getArgs(arguments, {name: 0, callback: 1});
    const callback = cfg.callback || OrPromise();
    cfg.callback = (err, hosts) => {
      if (err) { return callback(err); }
      callback(null, internals.selectNext(hosts));
    };
    this.getServiceHosts(cfg);
    return callback.promise;
  }

  getServiceHosts () {
    const cfg = getArgs(arguments, {name: 0, callback: 1});
    const callback = cfg.callback || OrPromise();
    const hosts = this.getCachedServiceHosts(cfg.name);

    if (hosts) {
      setImmediate(callback, null, hosts.slice());
      return callback.promise;
    }

    this.refreshService(cfg.name, (err, hosts) => {
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


  refreshService () {
    const cfg = getArgs(arguments, {name: 0, callback: 1});
    const callback = cfg.callback || OrPromise();

    this._wreck.get(`/v1/health/service/${cfg.name}?passing&near=agent`, (err, res, payload) => {
      if (err) {
        return callback(err);
      }

      if (!payload || !payload.length) {
        return callback(new Error(`Service ${cfg.name} couldn't be found`));
      }

      const hosts = payload.map((host) => {
        return {
          address: host.Service.Address,
          port: host.Service.Port
        };
      });

      this._hosts[cfg.name] = hosts;

      callback(null, hosts);
    });

    return callback.promise;
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
