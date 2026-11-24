const assert = require('assert');
const dgram = require('dgram');
const { once } = require('events');
const http = require('http');

const {
  createLog: coreCreateLog,
} = require('@hyperwatch/hyperwatch/src/lib/util');
const express = require('express');
const { WebSocketServer } = require('ws');

const expressLogger = require('..');

const { createLog } = expressLogger;

// An Express app with the middleware, listening on a free port
async function startApp(middleware) {
  const app = express();
  app.use(middleware);
  app.get('/hello', (req, res) => res.send('Hello'));
  app.get('/missing', (req, res) => res.status(404).send('Not found'));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => server.close(),
  };
}

// The logs a receiver got, and a promise of the next one
function logQueue() {
  const logs = [];
  const waiting = [];
  return {
    push(log) {
      const resolve = waiting.shift();
      if (resolve) {
        resolve(log);
      } else {
        logs.push(log);
      }
    },
    next(timeout = 2000) {
      if (logs.length) {
        return Promise.resolve(logs.shift());
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('No log received')),
          timeout
        );
        waiting.push((log) => {
          clearTimeout(timer);
          resolve(log);
        });
      });
    },
  };
}

// A port nothing listens on
async function closedPort() {
  const server = http.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  server.close();
  await once(server, 'close');
  return port;
}

// Records console.error instead of printing it
function captureErrors() {
  const errors = [];
  const original = console.error;
  console.error = (...args) => errors.push(args.join(' '));
  return { errors, restore: () => (console.error = original) };
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assertLog(log, { url, status }) {
  assert.strictEqual(log.request.method, 'GET');
  assert.strictEqual(log.request.url, url);
  assert.strictEqual(log.request.address, '127.0.0.1');
  assert.strictEqual(typeof log.request.headers, 'object');
  assert.ok(log.request.headers['user-agent']);
  assert.ok(!Number.isNaN(Date.parse(log.request.time)));
  assert.strictEqual(log.response.status, status);
  assert.strictEqual(typeof log.executionTime, 'number');
  assert.ok(log.executionTime >= 0);
}

describe('express-logger', () => {
  let errors;

  beforeEach(() => {
    errors = captureErrors();
  });

  afterEach(() => {
    errors.restore();
  });

  it('throws on an unknown transport', () => {
    assert.throws(() => expressLogger('smtp'), /'smtp' is not a valid/);
  });

  describe('http', () => {
    let receiver;
    let logs;
    let respond;

    beforeEach(async () => {
      logs = logQueue();
      respond = (res) => res.end('Ok');
      receiver = http.createServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          assert.strictEqual(req.method, 'POST');
          assert.strictEqual(req.headers['content-type'], 'application/json');
          logs.push(JSON.parse(body));
          respond(res);
        });
      });
      receiver.listen(0, '127.0.0.1');
      await once(receiver, 'listening');
    });

    afterEach(() => {
      receiver.closeAllConnections();
      receiver.close();
    });

    const inputUrl = () =>
      `http://127.0.0.1:${receiver.address().port}/input/log`;

    it('sends the log of each request', async () => {
      const app = await startApp(expressLogger('http', inputUrl()));
      try {
        const response = await fetch(`${app.url}/hello?a=1`);
        assert.strictEqual(await response.text(), 'Hello');
        assertLog(await logs.next(), { url: '/hello?a=1', status: 200 });
        await fetch(`${app.url}/missing`);
        assertLog(await logs.next(), { url: '/missing', status: 404 });
        assert.deepStrictEqual(errors.errors, []);
      } finally {
        app.close();
      }
    });

    it('reports an error status once', async () => {
      respond = (res) => res.writeHead(500).end();
      const app = await startApp(expressLogger('http', inputUrl()));
      try {
        for (let i = 0; i < 3; i++) {
          await fetch(`${app.url}/hello`);
          await logs.next();
        }
        await delay(50);
        assert.strictEqual(errors.errors.length, 1);
        assert.match(errors.errors[0], /http transport: .* answered 500/);
      } finally {
        app.close();
      }
    });

    it('gives up after the timeout', async () => {
      respond = () => {};
      const app = await startApp(
        expressLogger('http', inputUrl(), { timeout: 50 })
      );
      try {
        await fetch(`${app.url}/hello`);
        await logs.next();
        await delay(150);
        assert.strictEqual(errors.errors.length, 1);
        assert.match(errors.errors[0], /http transport: /);
      } finally {
        app.close();
      }
    });

    it('answers when Hyperwatch is down, and reports it once', async () => {
      const port = await closedPort();
      const app = await startApp(
        expressLogger('http', `http://127.0.0.1:${port}/input/log`)
      );
      try {
        for (let i = 0; i < 3; i++) {
          const response = await fetch(`${app.url}/hello`);
          assert.strictEqual(response.status, 200);
          assert.strictEqual(await response.text(), 'Hello');
        }
        await delay(100);
        assert.strictEqual(errors.errors.length, 1);
        assert.match(errors.errors[0], /http transport: .*ECONNREFUSED/);
      } finally {
        app.close();
      }
    });
  });

  describe('websocket', () => {
    let receiver;
    let logs;

    beforeEach(async () => {
      logs = logQueue();
      receiver = new WebSocketServer({ port: 0, host: '127.0.0.1' });
      receiver.on('connection', (socket) =>
        socket.on('message', (data) => logs.push(JSON.parse(data.toString())))
      );
      await once(receiver, 'listening');
    });

    afterEach(async () => {
      for (const client of receiver.clients) {
        client.terminate();
      }
      receiver.close();
    });

    it('sends the log of each request', async () => {
      const connected = once(receiver, 'connection');
      const app = await startApp(
        expressLogger(
          'websocket',
          `ws://127.0.0.1:${receiver.address().port}/input/log`
        )
      );
      try {
        await connected;
        // The client's side of the connection opens after the server's
        await delay(20);
        await fetch(`${app.url}/hello`);
        assertLog(await logs.next(), { url: '/hello', status: 200 });
        await fetch(`${app.url}/missing`);
        assertLog(await logs.next(), { url: '/missing', status: 404 });
        assert.deepStrictEqual(errors.errors, []);
      } finally {
        app.close();
      }
    });

    it('reconnects once the connection is closed', async () => {
      const connected = once(receiver, 'connection');
      const app = await startApp(
        expressLogger(
          'websocket',
          `ws://127.0.0.1:${receiver.address().port}/input/log`
        )
      );
      try {
        const [socket] = await connected;
        const reconnected = once(receiver, 'connection');
        socket.close();
        await delay(50);
        // Dropped: the connection is closed, the next one starts
        await fetch(`${app.url}/hello`);
        await reconnected;
        await delay(20);
        await fetch(`${app.url}/missing`);
        assertLog(await logs.next(), { url: '/missing', status: 404 });
      } finally {
        app.close();
      }
    });

    it('answers when Hyperwatch is down, and reports it once', async () => {
      const port = await closedPort();
      const app = await startApp(
        expressLogger('websocket', `ws://127.0.0.1:${port}/input/log`)
      );
      try {
        for (let i = 0; i < 3; i++) {
          const response = await fetch(`${app.url}/hello`);
          assert.strictEqual(response.status, 200);
          await delay(30);
        }
        assert.strictEqual(errors.errors.length, 1);
        assert.match(errors.errors[0], /websocket transport: .*ECONNREFUSED/);
      } finally {
        app.close();
      }
    });
  });

  describe('syslog', () => {
    let receiver;
    let logs;

    beforeEach(async () => {
      logs = logQueue();
      receiver = dgram.createSocket('udp4');
      receiver.on('message', (message) => {
        const text = message.toString();
        const prefix = 'access_watch: ';
        logs.push(JSON.parse(text.slice(text.indexOf(prefix) + prefix.length)));
      });
      receiver.bind(0, '127.0.0.1');
      await once(receiver, 'listening');
    });

    afterEach(() => {
      receiver.close();
    });

    it('sends the log of each request over UDP', async () => {
      const app = await startApp(
        expressLogger('syslog', '127.0.0.1', receiver.address().port)
      );
      try {
        await fetch(`${app.url}/hello`);
        assertLog(await logs.next(), { url: '/hello', status: 200 });
        await fetch(`${app.url}/missing`);
        assertLog(await logs.next(), { url: '/missing', status: 404 });
        assert.deepStrictEqual(errors.errors, []);
      } finally {
        app.close();
      }
    });

    it('answers when Hyperwatch is down', async () => {
      const port = receiver.address().port;
      receiver.close();
      receiver = dgram.createSocket('udp4');
      const app = await startApp(expressLogger('syslog', '127.0.0.1', port));
      try {
        for (let i = 0; i < 3; i++) {
          const response = await fetch(`${app.url}/hello`);
          assert.strictEqual(response.status, 200);
        }
        assert.ok(errors.errors.length <= 1);
      } finally {
        app.close();
      }
    });

    it("doesn't mutate the options", () => {
      const options = { appName: 'test' };
      expressLogger('syslog', '127.0.0.1', receiver.address().port, options);
      assert.deepStrictEqual(options, { appName: 'test' });
    });
  });

  describe('createLog', () => {
    // The same request, as Express and Hyperwatch's Express input see it
    const req = {
      ip: '203.0.113.7',
      method: 'POST',
      originalUrl: '/mounted/path?q=1',
      url: '/path?q=1',
      headers: { host: 'example.com', 'user-agent': 'test' },
    };
    const res = { statusCode: 200 };

    it("gives the same log as Hyperwatch's Express input", () => {
      const ours = createLog(req, res);
      const core = coreCreateLog(req, res).toJS();
      // Created a few milliseconds apart
      assert.ok(
        Math.abs(
          Date.parse(ours.request.time) - Date.parse(core.request.time)
        ) < 1000
      );
      ours.request.time = core.request.time;
      assert.deepStrictEqual(ours, core);
    });

    it('falls back to req.url outside Express', () => {
      const log = createLog({ ...req, originalUrl: undefined }, res);
      assert.strictEqual(log.request.url, '/path?q=1');
    });
  });
});
