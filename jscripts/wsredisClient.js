function wsredisClient(uri, userToken, userTokenTimestamp, tokenExpirationTime)
{
    this.uri = uri;
    this.userToken = userToken;
    this.userTokenTimestamp = userTokenTimestamp;
    this.tokenExpirationTime = tokenExpirationTime * 1000;

    this.handle = null;
    this.tokenTimeout = null;
    this.channelHandlers = [];
    this.connecting = false;
    this.connectCallbacks = [];

    var self = this;

    // API
    this.addChannelsHandler = function (channels, callback)
    {
        var thisObject = this;

        thisObject.executeWhenOpen(function () {
            for (var i in channels) {
                var channelName = channels[i];

                thisObject.addChannels(channels);

                if (thisObject.channelHandlers[channelName] === undefined) {
                    thisObject.channelHandlers[channelName] = [];
                }

                thisObject.channelHandlers[channelName].push(callback);
            }
        });
    };

    this.executeWhenOpen = function (callback)
    {
        if (!this.isOpen()) {
            this.connect(false, callback);
        } else {
            callback();
        }
    },

    // WebSocket connection
    this.connect = function (channels, callback)
    {
        var thisObject = this;

        if (callback !== undefined) {
            thisObject.connectCallbacks.push(callback);
        }

        if (thisObject.connecting) {
            return;
        } else {
            thisObject.connecting = true;

            this.prepareUserToken(function () {
                thisObject.handle = new WebSocket(thisObject.uri, [ thisObject.userToken ]);

                thisObject.handle.addEventListener('open', function (event) {
                    console.log('wsredisClient: connection opened');

                    if (channels !== undefined) {
                        thisObject.addChannels(channels);
                    }

                    for (var i in thisObject.connectCallbacks) {
                        thisObject.connectCallbacks[i]();
                    }

                    thisObject.connectCallbacks = [];
                    thisObject.connecting = false;
                });

                thisObject.handle.addEventListener('close', function (event) {
                    console.log('wsredisClient: connection closed');
                });

                thisObject.handle.addEventListener('message', function (event) {
                    console.log('wsredisClient: message: ', event.data);

                    var message = JSON.parse(event.data);

                    if (message.channel !== undefined && message.data !== undefined && thisObject.channelHandlers[message.channel] !== undefined) {
                        for (var i in thisObject.channelHandlers[message.channel]) {
                            thisObject.channelHandlers[message.channel][i](message.data);
                        }
                    }
                });
            });

            this.tokenTimeout = setTimeout(function () { thisObject.refreshToken() }, this.tokenExpirationTime * 0.8);
        }
    };

    this.disconnect = function ()
    {
        this.handle.close();
        this.tokenTimeout = null;
    };

    this.isOpen = function ()
    {
        return this.handle != null && this.handle.readyState === WebSocket.OPEN;
    };

    // WebSocket communication
    this.send = function (action, data)
    {
        if (this.isOpen()) {
            var object = { action: action, data: data };
            this.handle.send(JSON.stringify(object));
        }
    };

    this.sendToken = function ()
    {
        this.send('refresh-token', {
            token: this.userToken,
        });
    };

    this.refreshToken = function ()
    {
        var thisObject = this;

        self.prepareUserToken(function () {
            self.sendToken();
        }, true);

        this.tokenTimeout = setTimeout(function () { thisObject.refreshToken() }, this.tokenExpirationTime * 0.8);
    };

    this.addChannels = function (channels)
    {
        this.send('add-channels', {
            channels: channels,
        });
    };

    this.addChannel = function (name)
    {
        return this.addChannels([name]);
    };

    this.removeChannels = function (channels)
    {
        this.send('remove-channels', {
            channels: channels,
        });
    };

    this.removeChannel = function (name)
    {
        return this.removeChannels([name]);
    };

    // AJAX communication
    this.fetchUserToken = function (callback)
    {
        var thisObject = this;

        $.getJSON(rootpath + '/xmlhttp.php?action=wsredis_get_user_token', function (response) {
            thisObject.userToken = response.userToken;
            thisObject.userTokenTimestamp = response.userTokenTimestamp;

            if (callback != undefined) {
                callback();
            }
        });
    };

    // core
    this.prepareUserToken = function (callback, forceFetch)
    {
        if (forceFetch === true || this.userTokenTimestamp < Math.floor(new Date().getTime() / 1000) - this.tokenExpirationTime) {
            this.fetchUserToken(callback);
        } else {
            callback();
        }
    };
}

// init
var wsredisAttributes = [];

$.each(document.currentScript.attributes, function() {
    if (this.specified && this.name.match('^data-')) {
        wsredisAttributes[this.name.replace('data-', '')] = this.value;
    }
});

wsredisMainClient = new wsredisClient(
    wsredisAttributes['wsredisWebsocketUri'.toLowerCase()],
    wsredisAttributes['wsredisEncodedUserToken'.toLowerCase()],
    wsredisAttributes['wsredisUserTokenTimestamp'.toLowerCase()],
    wsredisAttributes['wsredisTokenExpirationTime'.toLowerCase()],
);
