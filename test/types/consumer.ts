// Uses the middleware the way a TypeScript user does. `npm run types:test`
// (scripts/test-types.js) installs the packed package in a temporary project
// and type-checks this file with it, strict.
import http = require('http');

import express = require('express');
import expressLogger = require('@hyperwatch/express-logger');
import type {
  HyperwatchRequest,
  Log,
  Middleware,
} from '@hyperwatch/express-logger';

const app = express();

app.use(expressLogger('http', 'http://127.0.0.1:3000/input/log'));
app.use(
  expressLogger('http', 'http://127.0.0.1:3000/input/log', { timeout: 500 })
);
app.use(expressLogger('websocket', 'ws://127.0.0.1:3000/input/log'));
app.use(
  expressLogger('websocket', 'ws://127.0.0.1:3000/input/log', [], {
    headers: { authorization: 'Bearer x' },
  })
);
app.use(expressLogger('syslog', '127.0.0.1', 1516));
app.use(expressLogger('syslog', '127.0.0.1', 1516, { appName: 'app' }));

// Outside Express, on a plain Node.js server
const middleware: Middleware = expressLogger('syslog', '127.0.0.1', 1516);
http.createServer((req, res) => middleware(req, res, () => res.end()));

const log: Log = expressLogger.createLog(
  { ip: '127.0.0.1', method: 'GET', url: '/', headers: {} },
  { statusCode: 200 }
);
const status: number = log.response.status;
const time: string = log.request.time;
console.log(status, time, log.executionTime);

// The route, read from Express, or set by the application
const path: string | undefined = log.route?.path;
const name: string | undefined = log.route?.name;
console.log(path, name);
app.get('/v1/:slug.json', (req, res) => {
  const { hyperwatch } = req as typeof req & { hyperwatch: HyperwatchRequest };
  hyperwatch.route = { name: 'collective.json' };
  hyperwatch.route = null;
  // @ts-expect-error a route is a map, not its path
  hyperwatch.route = '/v1/:slug.json';
  res.send('ok');
});

// @ts-expect-error an unknown transport
expressLogger('smtp', 'x');
// @ts-expect-error the syslog transport needs a port
expressLogger('syslog', '127.0.0.1');
// @ts-expect-error the timeout is a number of milliseconds
expressLogger('http', 'http://127.0.0.1:3000/input/log', { timeout: '1s' });
