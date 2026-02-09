<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        @if(!\App\Meta::hasTitle())
        <title inertia>{{ config('app.name', 'Laravel') }}</title>
        @endif
        {!! \App\Meta::render() !!}

        <!-- Fonts -->
        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=figtree:400,500,600&display=swap" rel="stylesheet" />

        <!-- favicon -->
        <link rel="icon" href="assets/images/favicon-B.png" type="image/png">

        <!-- Scripts -->
        @routes
        @viteReactRefresh
        @vite(['resources/js/app.jsx', "resources/js/Pages/{$page['component']}.jsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @if(isset($page['component']) && $page['component'] === 'Welcome')
        <h1 class="sr-only">In Conversation With Bruce W. Cole</h1>
        @endif
        <script>
            (function() {
                if (localStorage.getItem('theme') === 'dark') {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            })();
        </script>
        @inertia
    </body>
</html>
