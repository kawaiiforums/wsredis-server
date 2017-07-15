var config = {
    // WebSockets server
    "port": 8080,
    "tokenKey": "CHANGE_ME",
    "allowedOrigins": [
        "http://localhost"
    ],

    // Redis client
    "redisHostname": "localhost",
    "redisPort": 6379,

    // interal & debug
    "jwtVerifyOptions": {
        algorithms: ["HS256", "HS512"],
        maxAge: "10m",
        clockTolerance: 10,
    },
    "verbosity_level": 1,
};

module.exports = config;
