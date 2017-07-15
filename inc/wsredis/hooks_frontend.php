<?php

namespace wsredis\hooks;

function global_end()
{
    global $mybb, $wsredisAttributes, $wsredisScript;

    $parameters = \wsredis\getWebsocketClientParameters();

    $attributesString = null;

    foreach ($parameters as $name => $value) {
        $attributesString .= ' data-' . $name . '="' . $value . '"';
    }

    $wsredisAttributes = $attributesString;

    $wsredisScript = '<script src="' . $mybb->asset_url . '/jscripts/wsredisClient.js" async defer' . $attributesString . '></script>';
}

function xmlhttp()
{
    global $mybb, $charset;

    if ($mybb->get_input('action') == 'wsredis_get_user_token') {
        header('Content-type: text/plain; charset=' . $charset);
        header('Cache-Control: no-store');

        echo json_encode([
            'userToken' => \wsredis\getEncodedUserToken($mybb->user),
            'userTokenTimestamp' => TIME_NOW,
        ]);

        exit;
    }
}
