const ws = require('ws');
const jwt = require('jsonwebtoken');
const redis = require('redis');

process.on('uncaughtException', function (exception) {
    console.log(exception);
});

module.exports = function (config) {
    // core
    this.config = config;

    this.start = (callback) => {
        this.startWebsocketServer();
        this.startRedisClient();

        if (callback !== undefined) {
            callback();
        }
    };

    this.close = (callback) => {
        let p1 = this.closeWebsocketServer();
        let p2 = this.closeRedisClient();

        Promise.all([p1, p2]).then(() => {
            if (callback !== undefined) {
                callback();
            }
        });
    };

    this.broadcastData = (channel, data) => {
        try {
            if (typeof data.permissions.user_ids == 'object' && typeof data.permissions.group_ids == 'object' && typeof data.data == 'object') {
                let messagesSent = this.sendToWebsocketClients(channel, data.permissions, data.data);

                if (this.config.verbosity_level >= 4) {
                    this.log('| Broadcast message to ' + messagesSent + ' client(s) (' + JSON.stringify(data.permissions) + ') on channel ' + channel);
                }
            }
        } catch (error) {
            if (this.config.verbosity_level >= 2) {
                this.log('! Failed to broadcast messages on channel "' + channel + '"');
            }

            return false;
        }
    };

    this.verifyUserToken = (userToken) => {
        try {
            return jwt.verify(userToken, this.config.tokenKey, this.config.jwtVerifyOptions);
        } catch (error) {
            return false;
        }
    };

    this.verifyTokenExpirationTime = (token) => {
        return Math.floor(Date.now() / 1000) < token.exp + (this.config.jwtVerifyOptions.clockTolerance || 0);
    };

    this.tokenMatchesPermissions = (token, permissions) => {
        return (
            (permissions.user_ids.length == 0 || permissions.user_ids.includes(token.user_id)) &&
            (permissions.group_ids.length == 0 || this.tokenGroupIdsMatchPermissions(token.group_ids, permissions.group_ids))
        );
    };

    this.arraysShareItems = (array1, array2) => {
        var array2 = Object.keys(array2).map(key => array2[key]);

        return array1.some(arrayValue => array2.includes(arrayValue));
    };

    this.tokenGroupIdsMatchPermissions = (tokenGroupIds, permissions) => {
        for (let i in permissions) {
            if (permissions[i] !== null) {
                var groupSet = Object.keys(permissions[i]).map(key => permissions[i][key]);

                if (!this.arraysShareItems(tokenGroupIds, groupSet) && !groupSet.includes(-1) && !groupSet.includes('-1')) {
                    return false;
                }
            }
        }

        return true;
    };

    this.multidimensionalIncludes = (array, value) => {
        for (let i in array) {
            if (array[i].includes(value)) {
                return true;
            }
        }

        return false;
    };

    this.log = (...values) => {
        if (this.config.log_timestamp) {
            let timestamp = Math.floor(new Date().getTime() / 1000);
            var timestampString = '[' + timestamp + '] ';
        } else {
            var timestampString = '';
        }

        console.log(timestampString + values.join(','));
    };

    // WebSockets
    this.websocketClients = [];
    this.websocketServer = null;

    this.startWebsocketServer = () => {
        this.websocketServer = new ws.Server({ port: this.config.port, verifyClient: this.websocketVerifyClient });

        this.websocketServer.on('error', function (error) {
            this.log('WebSockets server error: ' + error);
        });
        
        this.websocketServer.on('listening', () => {
            if (this.config.verbosity_level >= 1) {
                this.log('WebSockets server running on port ' + this.config.port);
            }
        });

        this.websocketServer.on('connection', this.websocketOnConnection);
    };

    this.closeWebsocketServer = () => {
        return new Promise((resolve, reject) => {
            this.websocketServer.close(() => {
                if (this.config.verbosity_level >= 1) {
                    this.log('WebSockets server closed');
                }
                resolve();
            });
        });
    };

    this.websocketOnConnection = (websocket, request) => {
        if (
            request.headers['sec-websocket-protocol'] === undefined ||
            (token = this.verifyUserToken(request.headers['sec-websocket-protocol'])) == false
        ) {
            websocket.close();

            if (this.config.verbosity_level >= 2) {
                this.log('! Websocket connection request rejected for ' + request.headers['sec-websocket-key']);
            }
        } else {
            var clientId = this.addWebsocketClient(websocket, request, token);
            var client = this.websocketClients[clientId];

            websocket.on('close', () => {
                this.websocketCloseCleanup(clientId, client.websocketClosingByServer);
            });

            websocket.on('message', (message) => {
                try {
                    var messageData = JSON.parse(message);
                } catch (error) {
                    var messageData = null;
                }

                if (messageData && messageData.action !== undefined) {
                    switch (messageData.action) {
                        case 'refresh-token':
                            if ((token = this.verifyUserToken(messageData.data.token)) != false) {
                                this.setWebsocketClientToken(clientId, token);

                                if (this.config.verbosity_level >= 3) {
                                    this.log('* Token refreshed for ' + clientId);
                                }
                            } else {
                                if (this.config.verbosity_level >= 2) {
                                    this.log('! Token refresh request rejected for ' + clientId);
                                }
                            }
                            break;
                        case 'add-channels':
                            if (typeof messageData.data.channels == 'object') {
                                let channelsAdded = [];

                                for (let i in messageData.data.channels) {
                                    if (typeof messageData.data.channels[i] == 'string') {
                                        this.addWebsocketClientChannel(clientId, messageData.data.channels[i]);
                                        channelsAdded.push(messageData.data.channels[i]);
                                    }
                                }

                                if (this.config.verbosity_level >= 4) {
                                    this.log('# Adding channel(s) for ' + clientId + ': ' + channelsAdded.join(','));
                                }
                            }
                            break;
                        case 'remove-channels':
                            if (typeof messageData.data.channels == 'object') {
                                for (let i in messageData.data.channels) {
                                    if (typeof messageData.data.channels[i] == 'string') {
                                        this.removeWebsocketClientChannel(clientId, messageData.data.channels[i]);

                                        if (this.config.verbosity_level >= 4) {
                                            this.log('# Removing channel(s) for ' + clientId);
                                        }
                                    }
                                }
                            }
                            break;
                    }
                }
            });

            if (this.config.keepaliveInterval > 0) {
                client.keepaliveInterval = setInterval(this.sendKeepaliveMessage, this.config.keepaliveInterval * 1000, clientId);
            }
        }
    };

    this.websocketVerifyClient = (info) => {
        return this.config.allowedOrigins.includes(info.origin);
    };

    this.sendToWebsocketClients = (channel, permissions, data) => {
        let messagesSent = 0;

        var dataObject = {
            channel: channel,
            data: data,
        };

        for (let clientId of Object.keys(this.websocketClients)) {
            let client = this.websocketClients[clientId];

            if (client.websocket.readyState === ws.OPEN && this.verifyTokenExpirationTime(client.token)) {
                if (
                    this.websocketClients[clientId].channels.has(channel) &&
                    this.tokenMatchesPermissions(client.token, permissions)
                ) {
                    this.sendDataToWebsocketClient(clientId, dataObject);

                    messagesSent++;
                }
            } else {
                this.disconnectWebsocketClient(clientId);
            }
        }

        return messagesSent;
    };

    this.sendKeepaliveMessage = (clientId) => {
        if (this.config.verbosity_level >= 3) {
            this.log('~ Keepalive message sent to ' + clientId);
        }

        return this.sendDataToWebsocketClient({
            keepalive: '1',
        });
    };

    this.sendDataToWebsocketClient = (clientId, data) => {
        let client = this.websocketClients[clientId];

        if (client) {
            client.websocket.send(JSON.stringify(data));
        }
    };

    this.addWebsocketClient = (websocket, request, token) => {
        var client = {};

        var clientId = request.headers['sec-websocket-key'];

        client.websocket = websocket;
        client.websocketClosingByServer = false;
        client.channels = new Set();

        this.websocketClients[clientId] = client;

        this.setWebsocketClientToken(clientId, token);

        if (this.config.verbosity_level >= 3) {
            this.log('+ Websocket connected: ' + clientId + ' (MyBB UID: ' + this.getUserIdByClientId(clientId) + ') [' + Object.keys(this.websocketClients).length + ' active connections]');
        }

        return clientId;
    };

    this.setWebsocketClientToken = (clientId, token) => {
        token.group_ids = Object.keys(token.group_ids).map(key => token.group_ids[key]);

        this.websocketClients[clientId].token = token;
    };

    this.getUserIdByClientId = (clientId) => {
        return this.websocketClients[clientId].token.user_id || false;
    };

    this.addWebsocketClientChannel = (clientId, channel) => {
        this.websocketClients[clientId].channels.add(channel);
    };

    this.removeWebsocketClientChannel = (clientId, channel) => {
        this.websocketClients[clientId].channels.delete(channel);
    };

    this.disconnectWebsocketClient = (clientId) => {
        if (this.websocketClients[clientId] !== undefined) {
            this.websocketClients[clientId].websocketClosingByServer = true;

            this.websocketClients[clientId].websocket.close();
        }
    };

    this.websocketCloseCleanup = (clientId, closedByServer) => {
        var userId = this.getUserIdByClientId(clientId);

        clearInterval(this.websocketClients[clientId].keepaliveInterval);

        delete this.websocketClients[clientId];
        
        if (this.config.verbosity_level >= 3) {
            if (closedByServer == 'undefined') {
                closedByServer = false;
            }
    
            if (closedByServer) {
                var closedBy = 'server';
            } else {
                var closedBy = 'client';
            }

            if (userId) {
                var userIdInfo = ' (MyBB UID: ' + userId + ')';
            } else {
                var userIdInfo = '';
            }

            this.log('- Websocket disconnected by ' + closedBy + ': ' + clientId + userIdInfo + ' [' + Object.keys(this.websocketClients).length + ' active connections]');
        }
    };

    // Redis
    this.redisClient = null;

    this.startRedisClient = () => {
        this.redisClient = redis.createClient(this.config.redisPort, this.config.redisHostname);

        this.redisClient.on('error', (error) => {
            this.log('Redis client error: ' + error);
        });

        this.redisClient.on('pmessage', this.redisOnPmessage);

        this.redisClient.psubscribe('*');

        if (this.config.verbosity_level >= 1) {
            this.log('Redis client subscribed to channels on ' + this.config.redisHostname + ':' + this.config.redisPort);
        }
    };

    this.closeRedisClient = () => {
        return new Promise((resolve, reject) => {
            this.redisClient.quit(() => {
                if (this.config.verbosity_level >= 1) {
                    this.log('Redis client closed');
                }
                resolve();
            });
        });
    };

    this.redisOnPmessage = (pattern, channel, message) => {
        try {
            var data = JSON.parse(message);

            if (typeof data == 'object' && typeof channel == 'string') {
                this.broadcastData(channel, data);
            }
        } catch (error) {
            if (this.config.verbosity_level >= 2) {
                this.log('! Malformed message received on channel "' + channel + '"');
            }

            return false;
        }
    };
}
