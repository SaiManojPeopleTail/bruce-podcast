<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'bunny' => [
        'api_key' => env('BUNNY_API_KEY'),
        'library_id' => env('BUNNY_LIBRARY_ID'),
        'pull_zone' => env('BUNNY_PULL_ZONE'),
    ],

    'mailchimp' => [
        'api_key' => env('MAILCHIP_API_KEY', env('MAILCHIMP_API_KEY')),
        'audience_id' => env('MAILCHIP_AUDIENCE_ID', env('MAILCHIMP_AUDIENCE_ID')),
    ],

    'printify' => [
        'token' => env('PRINTIFY_API_TOKEN'),
        'shop_id' => env('PRINTIFY_SHOP_ID'),
        'base_url' => 'https://api.printify.com/v1',
    ],

    'stripe' => [
        'key' => env('STRIPE_PUBLISHABLE_KEY'),
        'secret' => env('STRIPE_SECRET_KEY'),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
    ],

    /*
    | Comma-separated admin emails for new merch order notifications (paid orders).
    | Example: MERCH_ORDERS_NOTIFY_EMAILS=ops@example.com,manager@example.com
    */
    'merch' => [
        'orders_notify_emails' => array_values(array_filter(array_map(
            'trim',
            explode(',', (string) env('MERCH_ORDERS_NOTIFY_EMAILS', '')),
        ))),
    ],

];
