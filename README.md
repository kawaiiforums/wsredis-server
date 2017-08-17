# wsredis
Websocket/Redis bridge for MyBB 1.8, used for sidebar and alerts.

The bridge is comprised of:
- the `WebSockets & Redis bridge` MyBB plugin that provides a server-side PHP API for broadcasting channel- and permission-aware message objects and client-side API for communicating with the WebSockets server, including JWT access tokens handling,
- the `wsredis-server` Node.js application managing WebSockets connections, listening to Redis channels, verifying permissions and broadcasting message objects.

### Dependencies
- PHP >= 7.0
- https://github.com/phpredis/phpredis

### Setup
Place the `wsredis-server` directory, containing the Node.js application, outside the WWW root and place the remaining directories in the MyBB's main directory.

Install the MyBB plugin and configure connection settings for Redis, WebSockets server, the token key, allowed origin hosts and values as needed in the plugin's settings and the app's _config.js_ file.

Run `npm install` in the `wsredis-server` directory to install the Node.js app dependencies and run `npm start` to start the application.

### Security considerations
- The `Token key` and `config.tokenKey` values containing the JWT key, in plugin's settings and Node.js app configuration respectively, should be updated with a securely generated random string specific to the MyBB-WebSockets environment and should not be (re)used for other purposes nor disclosed to third parties.

- The `Token expiration time` (plugin settings), `config.jwtVerifyOptions.maxAge`,  `config.jwtVerifyOptions.clockTolerance` (Node.js app) values describe how long the JWT authentication & authorization tokens should remain active. Lower values provide better security but increase server loads and frequency of AJAX token refreshes. The WebSockets and MyBB sessions are detached and therefore it is possible that users who were logged out, removed, or whose permissions were revoked will retain the set of permissions (user IDs and group memberships) included in the lastest JWT ticket until it expires.

- The `config.allowedOrigins` in the Node.js app configuration contains possible values for `Origin` headers in order for connection requests to be accepted. The array should only contain the address(es) the MyBB forum is available under.

- The `config.jwtVerifyOptions.algorithms` value contains possible accepted hashing algorithms used to verify JWT signatures using the token key. It is not recommended to use algorithms that are weaker than defaults, less popular, custom or have not undergone an independent security audit.

### Verbosity levels
The `config.verbosity_level` option in the Node.js app configuration supports the following values:
- `0`: errors only,
- `1`: startup & shutdown messages,
- `2`: startup & shutdown messages, WebSockets connections, token updates,
- `3`: startup & shutdown messages, WebSockets connections, token updates, channel subscription requests.
