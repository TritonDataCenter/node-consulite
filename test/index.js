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


describe('getService()', () => {
  it('returns service host information from consul', (done) => {
    const server = Http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([{ Service: { Address: 'foo.com', Port: '1234' } }]));
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
