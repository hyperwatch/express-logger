# Hyperwatch Express Logger

An Express.js middleware to log HTTP requests to Hyperwatch and compatible software.

## Install

```
npm install --save @hyperwatch/express-logger
```

## Usage

### Using the Syslog protocol

On Hyperwatch side, make sure you have a Syslog input that parse logs in the JSON standard format.

Then:

```
const express = require('express')
const hyperwatchExpressLogger = require('@hyperwatch/express-logger')

const app = express()

app.use(hyperwatchExpressLogger('syslog', '0.0.0.0', 1516)
```

### Using the HTTP protocol

On Hyperwatch side, make sure you have an HTTP input that parse logs in the JSON standard format.

Then:

```
const express = require('express')
const hyperwatchExpressLogger = require('@hyperwatch/express-logger')

const app = express()

app.use(hyperwatchExpressLogger('http', 'http://0.0.0.0:3000/input/log'))
```

### Using the Websocket protocol

On Hyperwatch side, make sure you have a WebSocket input that parse logs in the JSON standard format.

```
const express = require('express')
const hyperwatchExpressLogger = require('@hyperwatch/express-logger')

const app = express()

app.use(hyperwatchExpressLogger('websocket', 'ws://0.0.0.0:3000/input/log'))
```

## License

[Apache License, version 2](LICENSE)
