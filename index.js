// An Express middleware that sends a log of each request to a remote
// Hyperwatch, over HTTP, WebSocket or syslog, in the log format of
// Hyperwatch's own Express input (`createLog` of src/lib/util.js in
// @hyperwatch/hyperwatch).

/**
 * A request log, as Hyperwatch's Express input creates it
 * @typedef {object} Log
 * @property {object} request
 * @property {string} request.time ISO 8601, when the request was received
 * @property {string | undefined} request.address `req.ip`: the client
 *   address, as Express's `trust proxy` setting reads it
 * @property {string | undefined} request.method
 * @property {string | undefined} request.url `req.originalUrl`, or
 *   `req.url` outside Express
 * @property {import('http').IncomingHttpHeaders} request.headers
 * @property {object} response
 * @property {number} response.status Set again when the response is sent
 * @property {number} [executionTime] Milliseconds from the request to the
 *   end of the response
 */

/**
 * The request as the middleware reads it: an Express request, or a plain
 * Node.js one
 * @typedef {import('http').IncomingMessage & { ip?: string, originalUrl?: string }} Request
 */

/**
 * @typedef {(req: Request, res: import('http').ServerResponse, next: (err?: unknown) => void) => void} Middleware
 */

/**
 * @typedef {object} HttpOptions
 * @property {number} [timeout] Milliseconds before a request to Hyperwatch
 *   is given up (default: 1000)
 */

/**
 * The options of syslog-client's `createClient()`
 * @typedef {object} SyslogOptions
 * @property {string} [syslogHostname] Default: the host name
 * @property {number} [transport] 1 for TCP, 2 for UDP (default)
 * @property {number} [tcpTimeout] Milliseconds (default: 10000)
 * @property {number} [facility] Default: 16 (local0)
 * @property {number} [severity] Default: 6 (informational)
 * @property {boolean} [rfc3164] Default: true
 * @property {string} [appName] Default: the process title
 * @property {(this: Date) => string} [dateFormatter]
 */

/**
 * What the middleware uses of syslog-client
 * @typedef {object} SyslogClientModule
 * @property {(target: string, options: SyslogOptions & { port: number }) => SyslogClient} createClient
 * @typedef {import('events').EventEmitter & { log(message: string, callback: (err?: Error) => void): void }} SyslogClient
 */

/**
 * The options of ws's `WebSocket` constructor (headers, timeouts, TLS…)
 * @typedef {{ [option: string]: any }} WebSocketOptions
 */

/**
 * The log of a request, before its response is sent
 * @param {{ ip?: string, method?: string, originalUrl?: string, url?: string, headers: import('http').IncomingHttpHeaders }} req
 * @param {{ statusCode: number }} res
 * @returns {Log}
 */
function createLog(req, res) {
  return {
    request: {
      time: new Date().toISOString(),
      address: req.ip,
      method: req.method,
      url: req.originalUrl || req.url,
      headers: req.headers,
    },
    response: {
      status: res.statusCode,
    },
  };
}

/**
 * Reports a failure on stderr once per kind (a refused connection, a
 * timeout, an HTTP status…), not once per request while Hyperwatch is down;
 * after a success, a failure is reported again.
 * @param {string} transport
 */
function failureReporter(transport) {
  const reported = new Set();
  return {
    /** @param {any} err */
    report(err) {
      const cause = err && err.cause;
      const kind =
        (cause && (cause.code || cause.name)) ||
        (err && (err.code || err.name)) ||
        String(err);
      if (reported.has(kind)) {
        return;
      }
      reported.add(kind);
      const message = (err && err.message) || String(err);
      console.error(
        `@hyperwatch/express-logger: ${transport} transport: ${message}${
          cause && cause.message ? ` (${cause.message})` : ''
        }`
      );
    },
    clear() {
      reported.clear();
    },
  };
}

/** @typedef {ReturnType<typeof failureReporter>} Failures */

/**
 * @param {string} target
 * @param {number} port
 * @param {SyslogOptions} options
 * @param {Failures} failures
 * @returns {(log: Log) => void}
 */
function syslogLogger(target, port, options, failures) {
  // syslog-client ships no types
  const syslogClient = /** @type {SyslogClientModule} */ (
    // @ts-expect-error
    require('syslog-client')
  );

  const client = syslogClient.createClient(target, { ...options, port });
  // Without a listener, a socket error would crash the application
  client.on('error', (/** @type {Error} */ err) => failures.report(err));

  return (log) =>
    client.log(
      `access_watch: ${JSON.stringify(log)}`,
      (/** @type {Error | undefined} */ err) =>
        err ? failures.report(err) : failures.clear()
    );
}

/**
 * @param {string} url
 * @param {HttpOptions} options
 * @param {Failures} failures
 * @returns {(log: Log) => void}
 */
function httpLogger(url, { timeout = 1000 }, failures) {
  return (log) => {
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(log),
      signal: AbortSignal.timeout(timeout),
    })
      .then(async (response) => {
        // Hyperwatch answers "Ok": nothing to read
        await response.body?.cancel();
        if (response.ok) {
          failures.clear();
        } else {
          const err = new Error(`${url} answered ${response.status}`);
          err.name = `HTTP ${response.status}`;
          failures.report(err);
        }
      })
      .catch((err) => failures.report(err));
  };
}

/**
 * Connects at once, and again on the next log once the connection is
 * closed. Logs are dropped while it isn't open.
 * @param {string} address
 * @param {string | string[] | undefined} protocols
 * @param {WebSocketOptions | undefined} options
 * @param {Failures} failures
 * @returns {(log: Log) => void}
 */
function websocketLogger(address, protocols, options, failures) {
  const WebSocket = require('ws');

  /** @type {import('ws') | null} */
  let client = null;

  const connect = () => {
    const websocket = new WebSocket(address, protocols, options);
    websocket.on('open', () => failures.clear());
    websocket.on('error', (err) => failures.report(err));
    // After an error too
    websocket.on('close', () => {
      if (client === websocket) {
        client = null;
      }
    });
    return websocket;
  };

  client = connect();

  return (log) => {
    if (!client) {
      client = connect();
    }
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(log), (err) => {
        if (err) {
          failures.report(err);
        }
      });
    }
  };
}

/**
 * The middleware, sending the log of each request once its response is sent
 * @overload
 * @param {'http'} transport
 * @param {string} url Of a Hyperwatch HTTP input
 * @param {HttpOptions} [options]
 * @returns {Middleware}
 */
/**
 * @overload
 * @param {'websocket'} transport
 * @param {string} address Of a Hyperwatch WebSocket input
 * @param {string | string[]} [protocols]
 * @param {WebSocketOptions} [options]
 * @returns {Middleware}
 */
/**
 * @overload
 * @param {'syslog'} transport
 * @param {string} target Host of a Hyperwatch syslog input
 * @param {number} port
 * @param {SyslogOptions} [options]
 * @returns {Middleware}
 */
/**
 * @param {'http' | 'websocket' | 'syslog'} [transport]
 * @param {...any} options
 * @returns {Middleware}
 */
function expressLogger(transport = 'http', ...options) {
  const failures = failureReporter(transport);

  /** @type {(log: Log) => void} */
  let send;
  if (transport === 'http') {
    send = httpLogger(options[0], options[1] || {}, failures);
  } else if (transport === 'websocket') {
    send = websocketLogger(options[0], options[1], options[2], failures);
  } else if (transport === 'syslog') {
    send = syslogLogger(options[0], options[1], options[2] || {}, failures);
  } else {
    throw new Error(`'${transport}' is not a valid transport.`);
  }

  return (req, res, next) => {
    const startedAt = Date.now();
    const log = createLog(req, res);

    res.on('finish', () => {
      try {
        log.response.status = res.statusCode;
        log.executionTime = Date.now() - startedAt;
        send(log);
      } catch (err) {
        failures.report(err);
      }
    });

    next();
  };
}

expressLogger.createLog = createLog;

module.exports = expressLogger;
