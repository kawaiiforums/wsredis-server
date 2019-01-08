# <img src="https://i.postimg.cc/fL6KLftL/wsredis-banner.png" width="275" height="100" alt="wsredis" />
Provides a platform to broadcast and receive MyBB permission-tied WebSocket messages.

Uses [Redis](https://redis.io/) pub/sub channels to distribute messages to [Node.js](https://nodejs.org/) server instances that validate permissions and communicate with client-side service workers. The workers manage JWT tokens, handle channel subscriptions and broadcast received messages using the [Broadcast Channel API](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API).

The bridge is comprised of:
- the [`WebSocket & Redis bridge` MyBB plugin](https://github.com/kawaii/mybb-wsredis) that provides a server-side PHP API for broadcasting channel- and permission-aware message objects and a client-side API for communicating with the WebSocket server, including JWT access tokens handling,
- the `wsredisServer` Node.js application managing WebSocket connections, listening to Redis channels, verifying permissions and broadcasting message objects.

### Setup
Place the Node.js application files outside the WWW root and place the MyBB plugin files in the MyBB's main directory.

Install the MyBB plugin and configure connection settings for Redis, WebSocket server, the token key, allowed origin hosts and values as needed in the plugin's settings and the app's `.env` file (sample values are provided in `.env.example`).

Run `npm install` in the app's directory to install dependencies and run `npm start` to start the application.

### Security considerations
- The `Token key` and `WSREDIS_TOKEN_KEY` values containing the JWT key, in plugin's settings and Node.js app configuration respectively, should be updated with a securely generated random string specific to the MyBB-WebSocket environment and should not be (re)used for other purposes nor disclosed to third parties.

- The `Token expiration time` (plugin settings), `WSREDIS_JWT_MAX_AGE`,  `WSREDIS_JWT_CLOCK_TOLERANCE` (Node.js app) values describe how long the JWT authentication & authorization tokens should remain active. Lower values provide better security but increase server loads and frequency of AJAX token refreshes. The WebSocket and MyBB sessions are detached and therefore it is possible that users who were logged out, removed, or whose permissions were revoked will retain the set of permissions (user IDs and group memberships) included in the lastest JWT ticket until it expires.

- The `WSREDIS_ALLOWED_ORIGINS` in the Node.js app configuration contains possible comma-separated values for `Origin` headers in order for connection requests to be accepted. The array should only contain the address(es) the MyBB forum is available under.

- The `WSREDIS_JWT_ALGORITHMS` value contains comma-separated possible accepted hashing algorithms used to verify JWT signatures using the token key. It is not recommended to use algorithms that are weaker than defaults, less popular, custom or have not undergone an independent security audit.

### Log output
The `WSREDIS_VERBOSITY_LEVEL` option in the Node.js app configuration supports the following values for event logging (accumulative):
- `0`: errors,
- `1`: startup & shutdown messages,
- `2`: token mismatch events, malformed message notices,
- `3`: WebSocket connections, token updates, keepalive messages,
- `4`: channel subscription requests, broadcast messages summary.

The `WSREDIS_LOG_TIMESTAMP` option (`0` or `1`), if enabled, adds a corresponding Unix timestamp to each message.

### Proxy via nginx
In the event that you want/need to proxy your connection to the WSRedis server via nginx, example configuration has been provided below. We don't recommend setting the `proxy_send_timeout` or `proxy_read_timeout` to anything higher than 30 minutes to save on resources.
```
upstream wsredis {
    server localhost:8080;
}

server {
    listen 443 ssl http2;
    server_name wsredis.example.com;

    ssl_certificate /etc/letsencrypt/live/wsredis.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wsredis.example.com/privkey.pem;

    location / {
        proxy_pass http://wsredis;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_connect_timeout 30m;
        proxy_send_timeout 30m;
        proxy_read_timeout 30m;
    }
}
```
