const ws = require('ws');
const jwt = require('jsonwebtoken');
const redis = require('redis');

module.exports = function (config) {
    // core
    this.config = config;

    this.start = () => {
        this.startWebsocketServer();
        this.startRedisClient();
    };

    this.broadcastData = (channel, data) => {
        if (typeof data.permissions.user_ids == 'object' && typeof data.permissions.group_ids == 'object' && typeof data.data == 'object') {
            this.sendToWebsocketClients(channel, data.permissions, data.data);
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
            (permissions.user_ids.length == 0 && permissions.group_ids.length == 0) ||
            permissions.user_ids.includes(token.user_id) ||
            this.tokenGroupIdsMatchPermissions(token.group_ids, permissions.group_ids)
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

                if (!this.arraysShareItems(tokenGroupIds, groupSet) && !groupSet.includes(-1)) {
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

    // WebSockets
    this.websocketClients = [];
    this.websocketServer = null;

    this.startWebsocketServer = () => {
        this.websocketServer = new ws.Server({ port: this.config.port, verifyClient: this.websocketVerifyClient });

        this.websocketServer.on('connection', this.websocketOnConnection);
    };

    this.websocketOnConnection = (websocket, request) => {
        if (
            request.headers['sec-websocket-protocol'] === undefined ||
            (token = this.verifyUserToken(request.headers['sec-websocket-protocol'])) == false
        ) {
            websocket.close();
        } else {
            var clientId = this.addWebsocketClient(websocket, request, token);

            if (this.config.verbosity_level >= 1) {
                console.log('+ Websocket connected: ' + clientId);
            }

            websocket.on('close', () => {
                delete this.websocketClients[clientId];

                if (this.config.verbosity_level >= 1) {
                    console.log('- Websocket disconnected (client-side): ' + clientId);
                }
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

                                if (this.config.verbosity_level >= 1) {
                                    console.log('* Refreshing token for ' + clientId);
                                }
                            }
                            break;
                        case 'add-channels':
                            if (typeof messageData.data.channels == 'object') {
                                for (let i in messageData.data.channels) {
                                    if (typeof messageData.data.channels[i] == 'string') {
                                        this.addWebsocketClientChannel(clientId, messageData.data.channels[i]);

                                        if (this.config.verbosity_level >= 2) {
                                            console.log('# Adding channel(s) for ' + clientId + ': ' + messageData.data.channels.join(','));
                                        }
                                    }
                                }
                            }
                            break;
                        case 'remove-channels':
                            if (typeof messageData.data.channels == 'object') {
                                for (let i in messageData.data.channels) {
                                    if (typeof messageData.data.channels[i] == 'string') {
                                        this.removeWebsocketClientChannel(clientId, messageData.data.channels[i]);

                                        if (this.config.verbosity_level >= 1) {
                                            console.log('# Removing channel(s) for ' + clientId);
                                        }
                                    }
                                }
                            }
                            break;
                    }
                }
            });
        }
    };

    this.websocketVerifyClient = (info) => {
        return this.config.allowedOrigins.includes(info.origin);
    };

    this.sendToWebsocketClients = (channel, permissions, data) => {
        for (let clientId of Object.keys(this.websocketClients)) {
            let client = this.websocketClients[clientId];

            if (client.websocket.readyState === ws.OPEN && this.verifyTokenExpirationTime(client.token)) {
                if (
                    this.websocketClients[clientId].channels.has(channel) &&
                    this.tokenMatchesPermissions(client.token, permissions)
                ) {
                    let messageData = {
                        channel: channel,
                        data: data,
                    };

                    client.websocket.send(JSON.stringify(messageData));
                }
            } else {
                this.disconnectWebsocketClient();
            }
        }
    };

    this.addWebsocketClient = (websocket, request, token) => {
        var client = {};

        var id = request.headers['sec-websocket-key'];

        client.websocket = websocket;
        client.channels = new Set();

        this.websocketClients[id] = client;

        this.setWebsocketClientToken(id, token);

        return id;
    };

    this.setWebsocketClientToken = (clientId, token) => {
        token.group_ids = Object.keys(token.group_ids).map(key => token.group_ids[key]);

        this.websocketClients[clientId].token = token;
    };

    this.addWebsocketClientChannel = (clientId, channel) => {
        this.websocketClients[clientId].channels.add(channel);
    };

    this.removeWebsocketClientChannel = (clientId, channel) => {
        this.websocketClients[clientId].channels.delete(channel);
    };

    this.disconnectWebsocketClient = (clientId) => {
        if (this.websocketClients[clientId] !== undefined) {
            this.websocketClients[clientId].websocket.close(() => {
                delete this.websocketClients[clientId];

                if (this.config.verbosity_level >= 1) {
                    console.log('- Websocket disconnected: ' + clientId);
                }
            });
        }
    };

    // Redis
    this.redisClient = null;

    this.startRedisClient = () => {
        this.redisClient = redis.createClient(this.config.redisPort, this.config.redisHostname);

        this.redisClient.on('error', function (error) {
            console.log('Redis client error: ' + error);
        });

        this.redisClient.on('pmessage', this.redisOnPmessage);

        this.redisClient.psubscribe('*');
    };

    this.redisOnPmessage = (pattern, channel, message) => {
        data = JSON.parse(message);

        if (typeof data == 'object' && typeof channel == 'string') {
            this.broadcastData(channel, data);
        }
    };
}
