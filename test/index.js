'use strict';

// Load modules
const Http = require('http');
const util = require('util');
const setImmediatePromise = util.promisify(setImmediate);
const Code = require('@hapi/code');
const Lab = require('@hapi/lab');
const Wreck = require('@hapi/wreck');
const Consulite = require('../');

// Test shortcuts
const { expect } = Code;
const { describe, it } = exports.lab = Lab.script();
const wreck = Wreck.defaults({ events: true });


describe('config()', () => {
  it('sets the consul address then uses it for requests to consul', () => {
    const server = Http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([
        { Service: { Address: 'configured.com', Port: '1234' } },
        { Service: { Address: 'configured.com', Port: '1234' } }
      ]));
    });

    server.listen(0, async () => {
      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });

      const service = await consulite.getService('configured');
      expect(service.address).to.equal('configured.com');
    });
  });
});

describe('getServiceNames()', () => {
  it('returns all service names from consul', () => {
    const serviceResponse = {
      consul: [],
      containerpilot: ['op'],
      'cp-frontend': [
        'traefik.frontend.entryPoints=http,ws,wss',
        'traefik.backend=cp-frontend',
        'traefik.frontend.rule=PathPrefix:/'
      ],
      foo: [
        'traefik.backend=api',
        'traefik.frontend.rule=PathPrefixStrip:/api',
        'traefik.frontend.entryPoints=http'
      ],
      traefik: []
    };

    const server = Http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(serviceResponse));
    });

    server.on('error', (err) => {
      expect(err).to.not.exist();
    });

    server.listen(0, async () => {
      wreck.events.once('request', (uri, options) => {
        expect(uri.path).to.contain('/services');
        uri.hostname = 'localhost';
        uri.port = server.address().port;
      });

      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });
      const services = await consulite.getServiceNames();
      expect(services.length).to.equal(5);
      expect(services).to.contain('foo');
    });
  });

  it('returns all service names from consul with a promise', () => {
    const serviceResponse = {
      consul: [],
      containerpilot: ['op'],
      'cp-frontend': [
        'traefik.frontend.entryPoints=http,ws,wss',
        'traefik.backend=cp-frontend',
        'traefik.frontend.rule=PathPrefix:/'
      ],
      foo: [
        'traefik.backend=api',
        'traefik.frontend.rule=PathPrefixStrip:/api',
        'traefik.frontend.entryPoints=http'
      ],
      traefik: []
    };

    const server = Http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(serviceResponse));
    });

    server.on('error', (err) => {
      expect(err).to.not.exist();
    });

    server.listen(0, () => {
      wreck.events.once('request', (uri, options) => {
        expect(uri.path).to.contain('/services');
        uri.hostname = 'localhost';
        uri.port = server.address().port;
      });

      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });
      consulite.getServiceNames().then((services) => {
        expect(services.length).to.equal(5);
        expect(services).to.contain('foo');
      });
    });
  });
});

describe('getServiceStatus()', () => {
  it('returns all nodes for service with health status', () => {
    const serviceResponse = [
      {
        Node: {
          ID: '40e4a748-2192-161a-0510-9bf59fe950b5',
          Node: 'foobar',
          Address: '10.1.10.12'
        },
        Service: {
          ID: 'redis',
          Service: 'redis',
          Address: '10.1.10.12',
          Port: 8000
        },
        Checks: [
          {
            Node: 'foobar',
            CheckID: 'service:redis',
            Name: 'Service \'redis\' check',
            Status: 'passing',
            ServiceName: 'redis'
          },
          {
            Node: 'foobar',
            CheckID: 'serfHealth',
            Name: 'Serf Health Status',
            Status: 'failure',
            ServiceName: ''
          }
        ]
      }
    ];

    const server = Http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(serviceResponse));
    });

    server.on('error', (err) => {
      expect(err).to.not.exist();
    });

    server.listen(0, async () => {
      wreck.events.once('request', (uri, options) => {
        expect(uri.path).to.contain('redis');
        uri.hostname = 'localhost';
        uri.port = server.address().port;
      });

      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });
      const nodes = await consulite.getServiceStatus('redis');
      expect(nodes.length).to.equal(1);
      expect(nodes[0].status).to.equal('passing');
    });
  });
});

describe('getService()', () => {
  it('returns service host information from consul', () => {
    const server = Http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([{ Service: { Address: 'foo.com', Port: '1234' } }]));
    });

    server.on('error', (err) => {
      expect(err).to.not.exist();
    });

    server.listen(0, async () => {
      wreck.events.once('request', (uri, options) => {
        expect(uri.path).to.contain('/test');
        uri.hostname = 'localhost';
        uri.port = server.address().port;
      });

      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });
      const service = await consulite.getService('test');
      expect(service.address).to.equal('foo.com');
      expect(service.port).to.equal('1234');
    });
  });

  it('round robins the returned services from consul', () => {
    const server = Http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([
        { Service: { Address: 'foo.com', Port: '1234' } },
        { Service: { Address: 'bar.com', Port: '1234' } }
      ]));
    });

    server.listen(0, async () => {
      wreck.events.once('request', (uri, options) => {
        expect(uri.path).to.contain('/foo');
        uri.hostname = 'localhost';
        uri.port = server.address().port;
      });

      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });
      const service1 = await consulite.getService('foo');
      await setImmediatePromise();
      const service2 = consulite.getService('foo');
      expect(service1.address).to.not.equal(service2.address);

      await setImmediatePromise();
      const service3 = await consulite.getService('foo');
      expect(service3.address).to.not.equal(service2.address);
    });
  });

  it('returns an error when unable to make a connection to consult', async () => {
    process.env.CONSUL_PORT = '0';
    process.env.CONSUL_HOST = 'localhost';
    const consulite = new Consulite();
    await expect(consulite.getService('error')).to.reject();
    delete process.env.CONSUL_PORT;
    delete process.env.CONSUL_HOST;
  });

  it('returns error when unable to find services', () => {
    const server = Http.createServer((req, res) => {
      res.writeHead(200);
      res.end();
    });

    server.listen(0, async () => {
      wreck.events.once('request', (uri, options) => {
        expect(uri.path).to.contain('/notfound');
        uri.hostname = 'localhost';
        uri.port = server.address().port;
      });

      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });
      await expect(consulite.getService('notfound')).to.reject();
    });
  });
});

describe('getServiceHosts()', () => {
  it('returns service hosts from consul', () => {
    const server = Http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([
        { Service: { Address: 'foo1.com', Port: '1234' } },
        { Service: { Address: 'foo2.com', Port: '1234' } }
      ]));
    });

    server.on('error', (err) => {
      expect(err).to.not.exist();
    });

    server.listen(0, async () => {
      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });

      const hosts = await consulite.getServiceHosts('foobar');
      expect(hosts.length).to.equal(2);
      expect(hosts[0].address).to.equal('foo1.com');
      expect(hosts[1].address).to.equal('foo2.com');
    });
  });

  it('returns error when unable to find services', () => {
    const server = Http.createServer((req, res) => {
      res.writeHead(200);
      res.end();
    });

    server.listen(0, async () => {
      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });

      await expect(consulite.getServiceHosts('invalid')).to.reject();
    });
  });
});


describe('getCachedService()', () => {
  it('retrieves service from cache', () => {
    const server = Http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([
        { Service: { Address: 'cached.com', Port: '1234' } },
        { Service: { Address: 'cached.com', Port: '1234' } }
      ]));
    });

    server.listen(0, async () => {
      wreck.events.once('request', (uri, options) => {
        expect(uri.path).to.contain('/cached');
        expect(uri.protocol).to.equal('http:');
        uri.hostname = 'localhost';
        uri.port = server.address().port;
      });

      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });
      const services = await consulite.refreshService('cached');
      expect(services.length).to.equal(2);
      const cached = consulite.getCachedService('cached');
      expect(cached).to.equal(services[0]);
    });
  });

  it('returns empty array when the service isn\'t cached', () => {
    const consulite = new Consulite({ consul: 'http://localhost:8080' });
    const cached = consulite.getCachedService('notfound');
    expect(cached).to.equal(null);
  });

  it('round-robins the services for each execution', () => {
    const server = Http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([
        { Service: { Address: 'cached1.com', Port: '1234' } },
        { Service: { Address: 'cached2.com', Port: '1234' } },
        { Service: { Address: 'cached3.com', Port: '1234' } }
      ]));
    });

    server.listen(0, async () => {
      wreck.events.once('request', (uri, options) => {
        expect(uri.path).to.contain('/roundrobin');
        expect(uri.protocol).to.equal('http:');
        uri.hostname = 'localhost';
        uri.port = server.address().port;
      });

      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });
      const service = await consulite.getService('roundrobin');
      expect(service.address).to.equal('cached1.com');
      expect(consulite.getCachedService('roundrobin').address).to.equal('cached2.com');
      expect(consulite.getCachedService('roundrobin').address).to.equal('cached3.com');
      await setImmediatePromise();
      expect(consulite.getCachedService('roundrobin').address).to.equal('cached1.com');
      expect(consulite.getCachedService('roundrobin').address).to.equal('cached2.com');
      expect(consulite.getCachedService('roundrobin').address).to.equal('cached3.com');
      expect(consulite.getCachedService('roundrobin').address).to.equal('cached1.com');
      expect(consulite.getCachedService('roundrobin').address).to.equal('cached2.com');
      expect(consulite.getCachedService('roundrobin').address).to.equal('cached3.com');
    });
  });
});


describe('getCachedServiceHosts()', () => {
  it('retrieves service from cache', () => {
    const server = Http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([
        { Service: { Address: 'cached.com', Port: '1234' } },
        { Service: { Address: 'cached.com', Port: '1234' } }
      ]));
    });

    server.listen(0, async () => {
      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });

      const services = await consulite.refreshService('wat');
      expect(services.length).to.equal(2);
      const cached = consulite.getCachedServiceHosts('wat');
      expect(cached.length).to.equal(2);
      expect(cached).to.equal(services);
    });
  });

  it('returns null if not cached', () => {
    const consulite = new Consulite({ consul: 'http://localhost:8080' });
    expect(consulite.getCachedServiceHosts('no-good-service')).to.equal(null);
  });
});


describe('refreshServices()', () => {
  it('retrieves services from consul and caches them', () => {
    const server = Http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([
        { Service: { Address: 'refresh1.com', Port: '1234' } },
        { Service: { Address: 'refresh2.com', Port: '1234' } }
      ]));
    });

    server.listen(0, async () => {
      wreck.events.once('request', (uri, options) => {
        expect(uri.path).to.contain('/refresh');
        uri.hostname = 'localhost';
        uri.port = server.address().port;
      });

      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });
      const services = await consulite.refreshService('refresh');
      expect(services.length).to.equal(2);
    });
  });
});
