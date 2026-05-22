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

    'elevenlabs' => [
        'api_key'  => env('ELEVENLABS_API_KEY'),
        'agent_id' => env('ELEVENLABS_AGENT_ID', env('VITE_ELEVENLABS_AGENT_ID')),
    ],

    'gemini' => [
        'api_key' => env('GEMINI_API_KEY'),
        'model'   => env('GEMINI_MODEL_NAME', 'gemini-2.5-flash-lite'),
    ],

    'openai' => [
        'api_key' => env('OPENAI_API_KEY'),
        'model' => env('OPENAI_MODEL'),
        'web_search_tool' => env('OPENAI_WEB_SEARCH_TOOL', 'web_search'),
    ],

    'socialapis' => [
        'api_token' => env('SOCIALAPIS_API_TOKEN'),
    ],

    'scraper_agent' => [
        'url'                      => env('SCRAPER_AGENT_URL', 'http://127.0.0.1:7501'),
        'secret'                   => env('SCRAPER_AGENT_SECRET', ''),
        'max_posts'                => (int) env('SCRAPER_MAX_POSTS', 8),
        'parallel_threshold'       => (int) env('SCRAPER_PARALLEL_THRESHOLD', 3),
        'posts_per_worker'         => (int) env('SCRAPER_POSTS_PER_WORKER', 2),
        'max_concurrent_sessions'  => (int) env('SCRAPER_MAX_CONCURRENT_SESSIONS', 8),
    ],

    /*
    | Comma-separated admin emails for new merch order notifications (paid orders).
    | Example: MERCH_ORDERS_NOTIFY_EMAILS=ops@example.com,manager@example.com
    */
    'merch' => [
        'purchase_enabled'     => env('MERCH_PURCHASE', true),
        'orders_notify_emails' => array_values(array_filter(array_map(
            'trim',
            explode(',', (string) env('MERCH_ORDERS_NOTIFY_EMAILS', '')),
        ))),
    ],

];
