'use strict';

// Load modules
const Http = require('http');
const Lab = require('lab');
const Consulite = require('../');


// Test shortcuts
const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = lab.expect;
const wreck = process[Symbol.for('wreck')];


describe('config()', () => {
  it('sets the consul address then uses it for requests to consul', (done) => {
    const server = Http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([
        { Service: { Address: 'configured.com', Port: '1234' } },
        { Service: { Address: 'configured.com', Port: '1234' } }
      ]));
    });

    server.listen(0, () => {
      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });

      consulite.getService('configured', (err, service) => {
        expect(err).to.not.exist();
        expect(service.address).to.equal('configured.com');
        done();
      });
    });
  });
});

describe('getServiceNames()', () => {
  it('returns all service names from consul', (done) => {
    const serviceResponse = {
      consul: [],
      containerpilot: [ 'op' ],
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
      wreck.once('request', (uri, options) => {
        expect(uri.path).to.contain('/services');
        uri.hostname = 'localhost';
        uri.port = server.address().port;
      });

      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });
      consulite.getServiceNames((err, services) => {
        expect(err).to.not.exist();
        expect(services.length).to.equal(5);
        expect(services).to.contain('foo');
        done();
      });
    });
  });

  it('accepts a config object', (done) => {
    const serviceResponse = {
      consul: [],
      containerpilot: [ 'op' ],
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
      wreck.once('request', (uri, options) => {
        expect(uri.path).to.contain('/services');
        uri.hostname = 'localhost';
        uri.port = server.address().port;
      });

      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });
      consulite.getServiceNames({callback: (err, services) => {
        expect(err).to.not.exist();
        expect(services.length).to.equal(5);
        expect(services).to.contain('foo');
        done();
      }});
    });
  });

  it('accepts node-attrs', (done) => {
    const server = Http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    });

    server.on('error', (err) => {
      expect(err).to.not.exist();
    });

    server.listen(0, () => {
      wreck.once('request', (uri, options) => {
        expect(uri.path).to.contain('/services');
        expect(uri.query).to.contain('node-meta=size=big');
        expect(uri.query).to.contain('node-meta=colour=brown');
        uri.hostname = 'localhost';
        uri.port = server.address().port;
      });

      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });
      consulite.getServiceNames({nodeMeta: {
        size: 'big',
        colour: 'brown'
      }}).then((services) => {
        expect(services.length).to.equal(0);
        done();
      });
    });
  });


  it('accepts a datacenter', (done) => {
    const server = Http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    });

    server.on('error', (err) => {
      expect(err).to.not.exist();
    });

    server.listen(0, () => {
      wreck.once('request', (uri, options) => {
        expect(uri.path).to.contain('/services');
        expect(uri.query).to.contain('dc=my-dc');
        uri.hostname = 'localhost';
        uri.port = server.address().port;
      });

      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });
      consulite.getServiceNames({dc: 'my-dc'}).then((services) => {
        expect(services.length).to.equal(0);
        done();
      });
    });
  });

  it('returns all service names from consul with a promise', (done) => {
    const serviceResponse = {
      consul: [],
      containerpilot: [ 'op' ],
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
      wreck.once('request', (uri, options) => {
        expect(uri.path).to.contain('/services');
        uri.hostname = 'localhost';
        uri.port = server.address().port;
      });

      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });
      consulite.getServiceNames().then((services) => {
        expect(services.length).to.equal(5);
        expect(services).to.contain('foo');
        done();
      });
    });
  });
});

describe('getServiceStatus()', () => {
  it('returns all nodes for service with health status', (done) => {
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

    server.listen(0, () => {
      wreck.once('request', (uri, options) => {
        expect(uri.path).to.contain('redis');
        uri.hostname = 'localhost';
        uri.port = server.address().port;
      });

      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });
      consulite.getServiceStatus('redis', (err, nodes) => {
        expect(err).to.not.exist();
        expect(nodes.length).to.equal(1);
        expect(nodes[0].status).to.equal('passing');
        done();
      });
    });
  });

  it('supports nodeMeta, tag, near, and datacenter', (done) => {
    const server = Http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
    });

    server.on('error', (err) => {
      expect(err).to.not.exist();
    });

    server.listen(0, () => {
      wreck.once('request', (uri, options) => {
        expect(uri.path).to.contain('redis');
        expect(uri.query).to.contain('node-meta=size=big');
        expect(uri.query).to.contain('tag=master');
        expect(uri.query).to.contain('dc=eu-west-1');
        expect(uri.query).to.contain('near=somenode');

        uri.hostname = 'localhost';
        uri.port = server.address().port;
      });

      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });
      consulite.getServiceStatus({
        name: 'redis',
        dc: 'eu-west-1',
        tag: 'master',
        near: 'somenode',
        nodeMeta: {
          size: 'big'
        }
      }).then((nodes) => {
        expect(nodes.length).to.equal(0);
        done();
      });
    });
  });
});

describe('getService()', () => {
  it('returns service host information from consul', (done) => {
    const server = Http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([{ Service: { Address: 'foo.com', Port: '1234' } }]));
    });

    server.on('error', (err) => {
      expect(err).to.not.exist();
    });

    server.listen(0, () => {
      wreck.once('request', (uri, options) => {
        expect(uri.path).to.contain('/test');
        uri.hostname = 'localhost';
        uri.port = server.address().port;
      });

      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });
      consulite.getService('test', (err, service) => {
        expect(err).to.not.exist();
        expect(service.address).to.equal('foo.com');
        expect(service.port).to.equal('1234');
        done();
      });
    });
  });

  it('returns a promise when no callback is provided', (done) => {
    const server = Http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([{ Service: { Address: 'promise.com', Port: '1234' } }]));
    });

    server.on('error', (err) => {
      expect(err).to.not.exist();
    });

    server.listen(0, () => {
      wreck.once('request', (uri, options) => {
        expect(uri.path).to.contain('/promise');
        uri.hostname = 'localhost';
        uri.port = server.address().port;
      });

      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });
      consulite.getService('promise').then((service) => {
        expect(service.address).to.equal('promise.com');
        expect(service.port).to.equal('1234');
        done();
      });
    });
  });

  it('round robins the returned services from consul', (done) => {
    const server = Http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([
        { Service: { Address: 'foo.com', Port: '1234' } },
        { Service: { Address: 'bar.com', Port: '1234' } }
      ]));
    });

    server.listen(0, () => {
      wreck.once('request', (uri, options) => {
        expect(uri.path).to.contain('/foo');
        uri.hostname = 'localhost';
        uri.port = server.address().port;
      });

      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });
      consulite.getService('foo', (err, service1) => {
        expect(err).to.not.exist();
        setImmediate(() => {
          consulite.getService('foo', (err, service2) => {
            expect(err).to.not.exist();
            expect(service1.address).to.not.equal(service2.address);

            setImmediate(() => {
              consulite.getService('foo', (err, service3) => {
                expect(err).to.not.exist();
                expect(service3.address).to.not.equal(service2.address);
                done();
              });
            });
          });
        });
      });
    });
  });

  it('returns an error when unable to make a connection to consult', (done) => {
    process.env.CONSUL_PORT = '0';
    process.env.CONSUL_HOST = 'localhost';
    const consulite = new Consulite();
    consulite.getService('error', (err, service) => {
      expect(err).to.exist();
      delete process.env.CONSUL_PORT;
      delete process.env.CONSUL_HOST;
      done();
    });
  });

  it('returns error when unable to find services', (done) => {
    const server = Http.createServer((req, res) => {
      res.writeHead(200);
      res.end();
    });

    server.listen(0, () => {
      wreck.once('request', (uri, options) => {
        expect(uri.path).to.contain('/notfound');
        uri.hostname = 'localhost';
        uri.port = server.address().port;
      });

      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });
      consulite.getService('notfound', (err, service) => {
        expect(err).to.exist();
        done();
      });
    });
  });
});

describe('getServiceHosts()', () => {
  it('returns service hosts from consul', (done) => {
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

    server.listen(0, () => {
      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });

      consulite.getServiceHosts('foobar', (err, hosts) => {
        expect(err).to.not.exist();
        expect(hosts.length).to.equal(2);
        expect(hosts[0].address).to.equal('foo1.com');
        expect(hosts[1].address).to.equal('foo2.com');
        done();
      });
    });
  });

  it('returns a promise when no callback is provided', (done) => {
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

    server.listen(0, () => {
      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });

      consulite.getServiceHosts('foobar').then((hosts) => {
        expect(hosts.length).to.equal(2);
        expect(hosts[0].address).to.equal('foo1.com');
        expect(hosts[1].address).to.equal('foo2.com');
        done();
      });
    });
  });

  it('returns error when unable to find services', (done) => {
    const server = Http.createServer((req, res) => {
      res.writeHead(200);
      res.end();
    });

    server.listen(0, () => {
      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });

      consulite.getServiceHosts('invalid', (err) => {
        expect(err).to.exist();
        done();
      });
    });
  });
});


describe('getCachedService()', () => {
  it('retrieves service from cache', (done) => {
    const server = Http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([
        { Service: { Address: 'cached.com', Port: '1234' } },
        { Service: { Address: 'cached.com', Port: '1234' } }
      ]));
    });

    server.listen(0, () => {
      wreck.once('request', (uri, options) => {
        expect(uri.path).to.contain('/cached');
        expect(uri.protocol).to.equal('http:');
        uri.hostname = 'localhost';
        uri.port = server.address().port;
      });

      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });
      consulite.refreshService('cached', (err, services) => {
        expect(err).to.not.exist();
        expect(services.length).to.equal(2);
        const cached = consulite.getCachedService('cached');
        expect(cached).to.equal(services[0]);
        done();
      });
    });
  });

  it('returns empty array when the service isn\'t cached', (done) => {
    const consulite = new Consulite({ consul: 'http://localhost:8080' });
    const cached = consulite.getCachedService('notfound');
    expect(cached).to.equal(null);
    done();
  });

  it('round-robins the services for each execution', (done) => {
    const server = Http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([
        { Service: { Address: 'cached1.com', Port: '1234' } },
        { Service: { Address: 'cached2.com', Port: '1234' } },
        { Service: { Address: 'cached3.com', Port: '1234' } }
      ]));
    });

    server.listen(0, () => {
      wreck.once('request', (uri, options) => {
        expect(uri.path).to.contain('/roundrobin');
        expect(uri.protocol).to.equal('http:');
        uri.hostname = 'localhost';
        uri.port = server.address().port;
      });

      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });
      consulite.getService('roundrobin', (err, service) => {
        expect(err).to.not.exist();
        expect(service.address).to.equal('cached1.com');
        expect(consulite.getCachedService('roundrobin').address).to.equal('cached2.com');
        expect(consulite.getCachedService('roundrobin').address).to.equal('cached3.com');
        setImmediate(() => {
          expect(consulite.getCachedService('roundrobin').address).to.equal('cached1.com');
          expect(consulite.getCachedService('roundrobin').address).to.equal('cached2.com');
          expect(consulite.getCachedService('roundrobin').address).to.equal('cached3.com');
          expect(consulite.getCachedService('roundrobin').address).to.equal('cached1.com');
          expect(consulite.getCachedService('roundrobin').address).to.equal('cached2.com');
          expect(consulite.getCachedService('roundrobin').address).to.equal('cached3.com');
          done();
        });
      });
    });
  });
});


describe('getCachedServiceHosts()', () => {
  it('retrieves service from cache', (done) => {
    const server = Http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([
        { Service: { Address: 'cached.com', Port: '1234' } },
        { Service: { Address: 'cached.com', Port: '1234' } }
      ]));
    });

    server.listen(0, () => {
      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });

      consulite.refreshService('wat', (err, services) => {
        expect(err).to.not.exist();
        expect(services.length).to.equal(2);
        const cached = consulite.getCachedServiceHosts('wat');
        expect(cached.length).to.equal(2);
        expect(cached).to.equal(services);
        done();
      });
    });
  });

  it('returns null if not cached', (done) => {
    const consulite = new Consulite({ consul: 'http://localhost:8080' });
    expect(consulite.getCachedServiceHosts('no-good-service')).to.equal(null);
    done();
  });
});


describe('refreshServices()', () => {
  it('retrieves services from consul and caches them', (done) => {
    const server = Http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([
        { Service: { Address: 'refresh1.com', Port: '1234' } },
        { Service: { Address: 'refresh2.com', Port: '1234' } }
      ]));
    });

    server.listen(0, () => {
      wreck.once('request', (uri, options) => {
        expect(uri.path).to.contain('/refresh');
        uri.hostname = 'localhost';
        uri.port = server.address().port;
      });

      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });
      consulite.refreshService('refresh', (err, services) => {
        expect(err).to.not.exist();
        expect(services.length).to.equal(2);
        done();
      });
    });
  });

  it('returns a promise when no callback is provided', (done) => {
    const server = Http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([
        { Service: { Address: 'refresh-promise1.com', Port: '1234' } },
        { Service: { Address: 'refresh-promise2.com', Port: '1234' } }
      ]));
    });

    server.listen(0, () => {
      wreck.once('request', (uri, options) => {
        expect(uri.path).to.contain('/refresh-promise');
        uri.hostname = 'localhost';
        uri.port = server.address().port;
      });

      const consulite = new Consulite({ consul: `http://localhost:${server.address().port}` });
      consulite.refreshService('refresh-promise').then((services) => {
        expect(services.length).to.equal(2);
        done();
      });
    });
  });
});
