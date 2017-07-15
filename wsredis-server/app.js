var config = require('./config');
var wsredisServer = require('./wsredisServer');

var server = new wsredisServer(config);

server.start();
