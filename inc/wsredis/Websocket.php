<?php

namespace wsredis\Websocket;

function getUri(string $bburl): string
{
    if (strpos($bburl, 'https:') === 0) {
        $protocol = 'wss://';
    } else {
        $protocol = 'ws://';
    }

    $hostname = \wsredis\getWebsocketsServerHostname();
    $port = \wsredis\getWebsocketsServerPort();

    $uri = $protocol . $hostname . ':' . $port;

    return $uri;
}
