<?php

namespace App\Providers;

use App\Models\Episode;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        // Admin routes use {episode} binding: resolve without published scope so future-dated episodes are editable.
        Route::bind('episode', fn ($value) => Episode::withoutGlobalScope('published')->findOrFail($value));
    }
}
