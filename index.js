function logFormat(req, res) {
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

function syslogLogger(target, port, options = {}) {
  options.port = port;

  const syslogClient = require('syslog-client');

  const client = syslogClient.createClient(target, options);

  return (log) => client.log(`access_watch: ${JSON.stringify(log)}`);
}

function httpLogger(url, { timeout = 1000 } = {}) {
  const axios = require('axios');

  const client = axios.create({ timeout });

  return (log) => {
    client
      .post(url, log)
      .catch((err) => console.log(`httpLogger error: ${err.message}`));
  };
}

function websocketLogger(address, protocols, options) {
  const WebSocket = require('ws');

  let client;

  const resetWebsocketClient = () => {
    client = null;
  };

  const createWebsocketClient = (address, protocols, options) => {
    const websocketClient = new WebSocket(address, protocols, options);
    websocketClient.on('error', (err) => {
      console.log(`websocketLogger error: ${err.message}`);
      resetWebsocketClient();
    });
    return websocketClient;
  };

  client = createWebsocketClient(address, protocols, options);

  return (log) => {
    if (!client || client.readyState === WebSocket.CLOSED) {
      client = createWebsocketClient(address, protocols, options);
    }
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(log));
    }
  };
}

module.exports = (transport = 'http', ...options) => {
  let logger;

  if (transport === 'http') {
    logger = httpLogger(...options);
  } else if (transport === 'websocket') {
    logger = websocketLogger(...options);
  } else if (transport === 'syslog') {
    logger = syslogLogger(...options);
  } else {
    throw new Error(`'${transport}' is not a valid transport.`);
  }

  return (req, res, next) => {
    try {
      const log = logFormat(req, res);
      logger(log);
    } catch (err) {
      console.log(`Error while logging with '${transport}' transport`, err);
    }
    next();
  };
};
