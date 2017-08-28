var config = {
    // WebSockets server
    "port": process.env.WSREDIS_PORT,
    "tokenKey": process.env.WSREDIS_TOKEN_KEY,
    "allowedOrigins": process.env.WSREDIS_ALLOWED_ORIGINS.split(','),

    // Redis client
    "redisHostname": process.env.WSREDIS_REDIS_HOSTNAME,
    "redisPort": process.env.WSREDIS_REDIS_PORT,

    // interal & debug
    "jwtVerifyOptions": {
        algorithms: process.env.WSREDIS_JWT_ALGORITHMS.split(','),
        maxAge: process.env.WSREDIS_JWT_MAX_AGE,
        clockTolerance: process.env.WSREDIS_JWT_CLOCK_TOLERANCE,
    },
    "verbosity_level": process.env.WSREDIS_VERBOSITY_LEVEL,
};

module.exports = config;
