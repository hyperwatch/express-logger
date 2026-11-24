# Changelog

Releases are also on [GitHub](https://github.com/hyperwatch/express-logger/releases). Versions before 4.0.0 have no entry: see the git history.

## 4.0.0 (2026-11-24)

### Breaking changes

- Requires Node.js 24 or later. ([#200](https://github.com/hyperwatch/express-logger/pull/200))
- A log is sent once the response is sent, instead of when the request arrives, as Hyperwatch's own Express input does: with the final `response.status`, and a new `executionTime` (milliseconds). A request whose response is never sent (the client went away) is no longer logged.
- The HTTP transport uses Node.js's `fetch` instead of axios. Logs are still a `POST` of their JSON, given up after `timeout` milliseconds (1000 by default). ([#200](https://github.com/hyperwatch/express-logger/pull/200))

### Features

- Type declarations: the middleware, its options (`HttpOptions`, `SyslogOptions`, `WebSocketOptions`) and the log (`Log`). No `@types` package is needed, with Express or without. ([#200](https://github.com/hyperwatch/express-logger/pull/200))
- `createLog(req, res)` is exported: the log of a request, as Hyperwatch's own Express input creates it. ([#200](https://github.com/hyperwatch/express-logger/pull/200))

### Fixes

- A socket error of the syslog transport no longer crashes the application. ([#200](https://github.com/hyperwatch/express-logger/pull/200))
- When Hyperwatch can't be reached, the failure is written to stderr once per kind (a refused connection, a timeout, an HTTP status…) instead of once per request, until a log goes through again. Errors go to `console.error` instead of `console.log`. ([#200](https://github.com/hyperwatch/express-logger/pull/200))
- The syslog transport no longer changes the `options` object it is given; the WebSocket transport reconnects on the next request once its connection is closed. ([#200](https://github.com/hyperwatch/express-logger/pull/200))

### Dependencies & tooling

- `axios` is no longer a dependency; `ws` 8.23. Releases are made by GitHub Actions workflows, with npm provenance (`RELEASING.md`). ([#200](https://github.com/hyperwatch/express-logger/pull/200))
