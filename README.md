# Access Watch Express Logger

An Express.js middleware to log HTTP requests to Access Watch.

## Install

```
npm install --save access-watch-express-logger
```

## Usage

### Using the Syslog protocol

On Access Watch side, make sure you have a Syslog input that parse logs in the JSON standard format.

Then:

```
const express = require('express')
const accessWatchExpressLogger = require('access-watch-express-logger')

const app = express()

app.use(accessWatchExpressLogger('syslog', '0.0.0.0', 1516)
```

### Using the HTTP protocol

On Access Watch side, make sure you have an HTTP input that parse logs in the JSON standard format.

Then:

```
const express = require('express')
const accessWatchExpressLogger = require('access-watch-express-logger')

const app = express()

app.use(accessWatchExpressLogger('http', 'http://0.0.0.0:3000/input/log'))
```

### Using the Websocket protocol

On Access Watch side, make sure you have an HTTP input that parse logs in the JSON standard format.

```
const express = require('express')
const accessWatchExpressLogger = require('access-watch-express-logger')

const app = express()

app.use(accessWatchExpressLogger('websocket', 'ws://0.0.0.0:3000/input/log'))
```

## License

[MIT](LICENSE)
