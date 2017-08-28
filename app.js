var dotenv = require('dotenv').config();
var config = require('./config');
var wsredisServer = require('./wsredisServer');

var server = new wsredisServer(config);

server.start();

function exitHandler(options, err) {
    server.close(() => {
        if (options.exit) {
            process.exit();
        }
    });
}

process.on('exit', exitHandler.bind(null, { cleanup: true }));
process.on('SIGINT', exitHandler.bind(null, { exit: true }));
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));
