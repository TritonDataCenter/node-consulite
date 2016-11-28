'use strict';

// Load modules
const Http = require('http');
const Code = require('code');
const Lab = require('lab');
const Consulite = require('../');


// Test shortcuts
const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;
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
      Consulite.config({ consul: `http://localhost:${server.address().port}` });

      Consulite.getService('configured', (err, service) => {
        expect(err).to.not.exist();
        expect(service.address).to.equal('configured.com');
        Consulite.config({});
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

      Consulite.getService('test', (err, service) => {
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

      Consulite.getService('promise').then((service) => {
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

      Consulite.getService('foo', (err, service1) => {
        expect(err).to.not.exist();
        setImmediate(() => {
          Consulite.getService('foo', (err, service2) => {
            expect(err).to.not.exist();
            expect(service1.address).to.not.equal(service2.address);

            setImmediate(() => {
              Consulite.getService('foo', (err, service3) => {
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

    Consulite.getService('error', (err, service) => {
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

      Consulite.getService('notfound', (err, service) => {
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

      Consulite.refreshService('cached', (err, services) => {
        expect(err).to.not.exist();
        expect(services.length).to.equal(2);
        const cached = Consulite.getCachedService('cached');
        expect(cached).to.equal(services[0]);
        done();
      });
    });
  });

  it('returns empty array when the service isn\'t cached', (done) => {
    const cached = Consulite.getCachedService('notfound');
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

      Consulite.config({ consul: `http://localhost:${server.address().port}` });
      Consulite.getService('roundrobin', (err, service) => {
        expect(err).to.not.exist();
        expect(service.address).to.equal('cached1.com');
        expect(Consulite.getCachedService('roundrobin').address).to.equal('cached2.com');
        expect(Consulite.getCachedService('roundrobin').address).to.equal('cached3.com');
        setImmediate(() => {
          expect(Consulite.getCachedService('roundrobin').address).to.equal('cached1.com');
          expect(Consulite.getCachedService('roundrobin').address).to.equal('cached2.com');
          expect(Consulite.getCachedService('roundrobin').address).to.equal('cached3.com');
          expect(Consulite.getCachedService('roundrobin').address).to.equal('cached1.com');
          expect(Consulite.getCachedService('roundrobin').address).to.equal('cached2.com');
          expect(Consulite.getCachedService('roundrobin').address).to.equal('cached3.com');
          done();
        });
      });
    });
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

      Consulite.refreshService('refresh', (err, services) => {
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

      Consulite.refreshService('refresh-promise').then((services) => {
        expect(services.length).to.equal(2);
        done();
      });
    });
  });
});
