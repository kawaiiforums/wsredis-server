<?php
/*
* by Tomasz 'Devilshakerz' Mlynski [devilshakerz.com]; Copyright (C) 2017
*/

// common modules
require_once MYBB_ROOT . 'inc/plugins/wsredis/core.php';
require_once MYBB_ROOT . 'inc/plugins/wsredis/Redis.php';
require_once MYBB_ROOT . 'inc/plugins/wsredis/Websocket.php';
require_once MYBB_ROOT . 'inc/plugins/wsredis/hooks_frontend.php';

// hooks
$plugins->add_hook('global_end', 'wsredis\hooks\global_end');
$plugins->add_hook('xmlhttp', 'wsredis\hooks\xmlhttp');

// init
$wsredisTokenRequested = false;

// MyBB plugin system
function wsredis_info()
{
    global $lang;

    return [
        'name'          => 'WebSockets & Redis bridge',
        'description'   => 'Tools and settings connecting MyBB and WebSockets & Redis server.',
        'version'       => '1',
        'author'        => 'Tomasz \'Devilshakerz\' Mlynski',
        'authorsite'    => 'https://devilshakerz.com',
        'website'       => 'https://devilshakerz.com',
        'compatibility' => '18*',
    ];
}

function wsredis_install()
{
    global $db;

    // settings
    $settings = [
        [
            'name'        => 'wsredis_redis_server_hostname',
            'title'       => 'Redis server hostname',
            'description' => '',
            'optionscode' => 'text',
            'value'       => 'localhost',
        ],
        [
            'name'        => 'wsredis_redis_server_port',
            'title'       => 'Redis server port',
            'description' => '',
            'optionscode' => 'numeric',
            'value'       => '6379',
        ],
        [
            'name'        => 'wsredis_websockets_server_hostname',
            'title'       => 'WebSockets server hostname',
            'description' => '',
            'optionscode' => 'text',
            'value'       => 'localhost',
        ],
        [
            'name'        => 'wsredis_websockets_server_port',
            'title'       => 'WebSockets server port',
            'description' => '',
            'optionscode' => 'numeric',
            'value'       => '80',
        ],
        [
            'name'        => 'wsredis_token_key',
            'title'       => 'Token key',
            'description' => 'Key used for signing WebSocket authentication tokens.',
            'optionscode' => 'text',
            'value'       => 'CHANGE_ME',
        ],
        [
            'name'        => 'wsredis_token_expiration_time',
            'title'       => 'Token expiration time',
            'description' => 'Time in seconds during which the WebSockets token is active.',
            'optionscode' => 'numeric',
            'value'       => '600',
        ],
    ];

    $settingGroupId = $db->insert_query('settinggroups', [
        'name'        => 'wsredis',
        'title'       => 'WebSockets & Redis bridge',
        'description' => 'Settings for WebSockets & Redis bridge.',
    ]);

    $i = 1;

    foreach ($settings as &$row) {
        $row['gid']         = $settingGroupId;
        $row['title']       = $db->escape_string($row['title']);
        $row['description'] = $db->escape_string($row['description']);
        $row['disporder']   = $i++;
    }

    $db->insert_query_multiple('settings', $settings);

    rebuild_settings();
}

function wsredis_uninstall()
{
    global $db;

    // settings
    $settingGroupId = $db->fetch_field(
        $db->simple_select('settinggroups', 'gid', "name='wsredis'"),
        'gid'
    );

    $db->delete_query('settinggroups', 'gid=' . (int)$settingGroupId);
    $db->delete_query('settings', 'gid=' . (int)$settingGroupId);

    rebuild_settings();
}

function wsredis_is_installed()
{
    global $db;

    return $db->num_rows(
        $db->simple_select('settinggroups', 'gid', "name='wsredis'")
    ) == 1;
}
