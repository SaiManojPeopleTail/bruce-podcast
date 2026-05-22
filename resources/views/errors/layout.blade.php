<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('code') — {{ config('app.name') }}</title>
    <link rel="icon" href="/assets/images/favicon-B.png" type="image/png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body {
            height: 100%;
            background: linear-gradient(160deg, #111827 0%, #0d1520 55%, #111827 100%);
            color: #fff;
            font-family: 'Barlow Condensed', sans-serif;
            -webkit-font-smoothing: antialiased;
        }

        /* Noise texture overlay */
        body::before {
            content: '';
            position: fixed;
            inset: 0;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
            pointer-events: none;
            z-index: 0;
        }

        .page {
            position: relative;
            z-index: 1;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem 1.5rem;
            text-align: center;
        }

        /* Radial gold bloom behind the number */
        .bloom {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -52%);
            width: min(700px, 90vw);
            height: min(700px, 90vw);
            border-radius: 50%;
            background: radial-gradient(circle, rgba(181,145,0,.13) 0%, transparent 70%);
            pointer-events: none;
        }

        .wordmark {
            letter-spacing: .35em;
            font-size: clamp(10px, 1.1vw, 13px);
            font-weight: 700;
            color: #b59100;
            text-transform: uppercase;
            margin-bottom: 2.5rem;
            opacity: .8;
        }

        .error-code {
            font-family: 'Anton', sans-serif;
            font-size: clamp(120px, 22vw, 260px);
            line-height: .88;
            letter-spacing: -.02em;

            /* Gold gradient fill */
            background: linear-gradient(160deg, #ffe566 0%, #b59100 45%, #7a5f00 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;

            /* Subtle gold glow */
            filter: drop-shadow(0 0 60px rgba(181,145,0,.30));

            position: relative;
            z-index: 2;
            user-select: none;
        }

        .divider {
            width: 56px;
            height: 3px;
            background: linear-gradient(90deg, transparent, #b59100, transparent);
            margin: 2rem auto;
            border-radius: 2px;
        }

        .headline {
            font-family: 'Anton', sans-serif;
            font-size: clamp(26px, 4vw, 48px);
            letter-spacing: .03em;
            color: #fff;
            line-height: 1.1;
            margin-bottom: 1rem;
        }

        .message {
            font-size: clamp(15px, 2vw, 20px);
            font-weight: 300;
            color: rgba(255,255,255,.55);
            max-width: 480px;
            line-height: 1.55;
            margin-bottom: .5rem;
        }

        .punchline {
            font-size: clamp(13px, 1.4vw, 15px);
            color: #b59100;
            opacity: .8;
            margin-bottom: 2.5rem;
            font-style: italic;
        }

        .btn-home {
            display: inline-flex;
            align-items: center;
            gap: .55rem;
            background: transparent;
            color: #ffde59;
            border: 1.5px solid rgba(255,222,89,.35);
            border-radius: 999px;
            padding: .7rem 2rem;
            font-family: 'Barlow Condensed', sans-serif;
            font-size: 15px;
            font-weight: 600;
            letter-spacing: .1em;
            text-transform: uppercase;
            text-decoration: none;
            transition: background .2s, border-color .2s, color .2s, box-shadow .2s;
        }
        .btn-home:hover {
            background: rgba(255,222,89,.10);
            border-color: rgba(255,222,89,.7);
            color: #fff;
            box-shadow: 0 0 24px rgba(181,145,0,.25);
        }
        .btn-home svg { flex-shrink: 0; }

        footer {
            position: absolute;
            bottom: 1.75rem;
            left: 0; right: 0;
            text-align: center;
            font-size: 12px;
            color: rgba(255,255,255,.2);
            letter-spacing: .06em;
        }
        footer a { color: rgba(181,145,0,.5); text-decoration: none; }
        footer a:hover { color: #b59100; }
    </style>
</head>
<body>
    <div class="page">
        <div class="bloom"></div>

        <p class="wordmark">Bruce W. Cole &nbsp;·&nbsp; Podcast</p>

        <div class="error-code">@yield('code')</div>

        <div class="divider"></div>

        <h1 class="headline">@yield('headline')</h1>
        <p class="message">@yield('message')</p>
        <p class="punchline">@yield('punchline')</p>

        <a class="btn-home" href="/">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            Back to home
        </a>
    </div>

    <footer>
        &copy; {{ date('Y') }} <a href="/">{{ config('app.name') }}</a>. All rights reserved.
    </footer>
</body>
</html>
