<?php

namespace wsredis\Redis;

function pub(string $channel, string $message)
{
    if (class_exists('Redis')) {
        $redisHandle = new \Redis();

        $redisHandle->pconnect(
            \wsredis\getRedisServerHostname(),
            \wsredis\getRedisServerPort()
        );

        $result = $redisHandle->publish($channel, $message);

        $redisHandle->close();

        return $result;
    }
}
