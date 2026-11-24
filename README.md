# Hyperwatch Express Logger

An Express.js middleware that sends a log of each request to a remote [Hyperwatch](https://github.com/hyperwatch/hyperwatch), over HTTP, WebSocket or syslog, without embedding Hyperwatch in the application. To run Hyperwatch inside the application instead, use its own Express input (`docs/express-embedding.md` in Hyperwatch).

The logs have the format of Hyperwatch's Express input: `request` (`time`, `address`, `method`, `url`, `headers`), `response.status`, `executionTime` (milliseconds) and [`route`](#route). `request.address` is `req.ip`: behind a proxy, set Express's [`trust proxy`](https://expressjs.com/en/guide/behind-proxies.html).

Requires Node.js 24 or later.

## Install

```bash
npm install @hyperwatch/express-logger
```

## Usage

A log is sent once the response is sent. When Hyperwatch can't be reached, the application answers as usual: the log is dropped, and the failure is written to stderr once per kind (a refused connection, a timeout, an HTTP status…), until a log goes through again.

### HTTP

On the Hyperwatch side, an HTTP input that parses logs in the JSON standard format. Then:

```js
const express = require('express');
const hyperwatchExpressLogger = require('@hyperwatch/express-logger');

const app = express();

app.use(hyperwatchExpressLogger('http', 'http://127.0.0.1:3000/input/log'));
```

Each log is a `POST` of its JSON. A request to Hyperwatch is given up after 1 second, or `timeout` milliseconds:

```js
app.use(
  hyperwatchExpressLogger('http', 'http://127.0.0.1:3000/input/log', {
    timeout: 500,
  })
);
```

### WebSocket

On the Hyperwatch side, a WebSocket input that parses logs in the JSON standard format. Then:

```js
app.use(hyperwatchExpressLogger('websocket', 'ws://127.0.0.1:3000/input/log'));
```

The connection opens when the middleware is created, and again on the next request once it is closed. Logs are dropped while it isn't open. The optional third and fourth arguments are the `protocols` and `options` of [ws](https://github.com/websockets/ws)'s `WebSocket`.

### Syslog

On the Hyperwatch side, a syslog input that parses logs in the JSON standard format. Then:

```js
app.use(hyperwatchExpressLogger('syslog', '127.0.0.1', 1516));
```

Over UDP by default. The optional fourth argument is the options of [syslog-client](https://github.com/paulgrove/node-syslog-client)'s `createClient()` (`transport`, `facility`, `appName`…).

## Route

When an Express route handled the request, the log has its `route`, as Hyperwatch's own Express input sets it (`docs/log.md` in Hyperwatch): `path` is the route as declared in the application (OpenTelemetry's `http.route`), `req.baseUrl` followed by the route's path.

```json
"route": { "path": "/v1/:collectiveSlug.json" }
```

| Declared as                               | `route.path`                  |
| ----------------------------------------- | ----------------------------- |
| `app.get('/v1/:collectiveSlug.json', …)`  | `/v1/:collectiveSlug.json`    |
| `router.get('/users/:id', …)` in `/api`   | `/api/users/:id`              |
| `app.get(/^\/(?<slug>[^/]+)\.json$/i, …)` | `/^\/(?<slug>[^/]+)\.json$/i` |
| `app.get(['/a/:id', '/b/:id'], …)`        | `/a/:id,/b/:id`               |

There is no `route` when no route matched (a 404, a static file). `req.baseUrl` is the requested path, not the pattern a router is mounted with: under `app.use('/:slug', router)`, the path has the slug of each request.

The application can set `req.hyperwatch.route` before the response ends: its `path` and `name` win over what Express gives, and `null` means no route. Express has no named routes: `name` only comes from there.

```js
app.get(/^\/(?<slug>[^/]+)\.json$/i, (req, res) => {
  req.hyperwatch.route = { path: '/:slug.json', name: 'collective.json' };
  // …
});
```

Express never clears the route a request went through: a route calling `next()` (the item wasn't found) or `next(err)` keeps it in the log of the 404 or the error that follows. Set it to `null` in your 404 and error handlers:

```js
app.use((req, res) => {
  req.hyperwatch.route = null;
  res.status(404).send('Not found');
});
```

## TypeScript

The package ships its type declarations: the middleware (`Middleware`), the options (`HttpOptions`, `SyslogOptions`, `WebSocketOptions`), the log (`Log`, with its `Route`) and what the application sets on a request (`HyperwatchRequest`).

```ts
import hyperwatchExpressLogger = require('@hyperwatch/express-logger');
import type { Log } from '@hyperwatch/express-logger';
```

## License

[Apache License, version 2](LICENSE)
