<?php

namespace wsredis;

use \Firebase\JWT\JWT;

// active operations
function push(string $channel, array $data, array $permissions)
{
    $permissions['user_ids'] = $permissions['user_ids'] ?? [];
    $permissions['group_ids'] = $permissions['group_ids'] ?? [];

    $message = [
        'permissions' => $permissions,
        'data' => $data,
    ];

    $encodedMessage = json_encode($message);

    return \wsredis\Redis\pub($channel, $encodedMessage);
}

// passive operations
function getEncodedUserToken(array $userData): string
{
    static $encodedUserToken = null;

    if (!$cachedValue) {
        require_once MYBB_ROOT . 'inc/3rdparty/php-jwt/JWT.php';
        require_once MYBB_ROOT . 'inc/3rdparty/php-jwt/BeforeValidException.php';
        require_once MYBB_ROOT . 'inc/3rdparty/php-jwt/ExpiredException.php';
        require_once MYBB_ROOT . 'inc/3rdparty/php-jwt/SignatureInvalidException.php';

        $key = getTokenKey();
        $expirationTimeInSeconds = getTokenExpirationTime();

        $groupIds = array_map('intval', explode(',', $userData['additionalgroups']));
        $groupIds[] = (int)$userData['usergroup'];

        $groupIds = array_unique(array_filter($groupIds));

        $userToken = [
            'iat' => \TIME_NOW,
            'exp' => \TIME_NOW + $expirationTimeInSeconds,
            'user_id' => (int)$userData['uid'],
            'group_ids' => $groupIds,
        ];

        $encodedUserToken = JWT::encode($userToken, $key);
    }

    return $encodedUserToken;
}

// data
function getRedisServerHostname(): string
{
    return getSettingValue('redis_server_hostname');
}

function getRedisServerPort(): int
{
    return (int)getSettingValue('redis_server_port');
}

function getWebsocketsServerHostname(): string
{
    return getSettingValue('websockets_server_hostname');
}

function getWebsocketsServerPort(): int
{
    return (int)getSettingValue('websockets_server_port');
}

function getTokenKey(): string
{
    return getSettingValue('token_key');
}

function getTokenExpirationTime(): int
{
    return (int)getSettingValue('token_expiration_time');
}

function getWebsocketClientParameters(): array
{
    global $mybb;

    static $parameters = null;

    if (!$parameters) {
        $parameters['wsredisWebsocketUri'] = \wsredis\Websocket\getUri($mybb->settings['bburl']);
        $parameters['wsredisEncodedUserToken'] = \wsredis\getEncodedUserToken($mybb->user);
        $parameters['wsredisUserTokenTimestamp'] = TIME_NOW;
        $parameters['wsredisTokenExpirationTime'] = \wsredis\getTokenExpirationTime();
    }

    return $parameters;
}

// common
function getSettingValue(string $name): string
{
    global $mybb;
    return $mybb->settings['wsredis_' . $name];
}
