<?php

use App\Http\Controllers\EpisodeController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\SitemapController;
use App\Http\Controllers\SiteSettingsController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\WelcomeController;
use Illuminate\Foundation\Application;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/robots.txt', [SitemapController::class, 'robots'])->name('robots');
Route::get('/sitemap.xml', [SitemapController::class, 'sitemap'])->name('sitemap');

Route::get('/', [WelcomeController::class, 'index'])->name('welcome');
Route::get('/api/videos/more', [WelcomeController::class, 'videosMore'])->name('api.videos.more');
Route::get('/meet-bruce', [WelcomeController::class, 'meetBruce'])->name('meet-bruce');
Route::redirect('/about', '/meet-bruce', 301);
Route::get('/brand-partnerships', [WelcomeController::class, 'brandPartnerships'])->name('brand-partnerships');
Route::get('/guest-submission', [WelcomeController::class, 'guestSubmission'])->name('guest-submission');
Route::get('/episode/{slug}', [WelcomeController::class, 'episode'])->name('episode');

Route::prefix('admin')->middleware(['auth', 'verified'])->group(function () {
    Route::get('/dashboard', function () {
        return Inertia::render('Dashboard');
    })->name('dashboard');

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::get('/episodes', [EpisodeController::class, 'index'])->name('episodes.index');
    Route::get('/episodes/create', [EpisodeController::class, 'create'])->name('episodes.create');
    Route::post('/episodes', [EpisodeController::class, 'store'])->name('episodes.store');
    Route::get('/episodes/{episode}/edit', [EpisodeController::class, 'edit'])->name('episodes.edit');
    Route::patch('/episodes/{episode}', [EpisodeController::class, 'update'])->name('episodes.update');
    Route::delete('/episodes/{episode}', [EpisodeController::class, 'destroy'])->name('episodes.destroy');

    Route::get('/users', [UserController::class, 'index'])->name('users.index');
    Route::get('/users/create', [UserController::class, 'create'])->name('users.create');
    Route::post('/users', [UserController::class, 'store'])->name('users.store');
    Route::delete('/users/{user}', [UserController::class, 'destroy'])->name('users.destroy');
    Route::patch('/users/{user}/password', [UserController::class, 'updatePassword'])->name('users.update-password');

    Route::get('/site-settings', [SiteSettingsController::class, 'index'])->name('site-settings.index');
    Route::get('/site-settings/pages/{page}/edit', [SiteSettingsController::class, 'edit'])->name('site-settings.pages.edit');
    Route::patch('/site-settings/pages/{page}', [SiteSettingsController::class, 'update'])->name('site-settings.pages.update');

    Route::get('/api/youtube-oembed', function (Request $request) {
        $url = $request->query('url');
        if (!$url || !preg_match('#^(https?://)?(www\.)?(youtube\.com/watch\?v=|youtu\.be/)#i', $url)) {
            return response()->json(['error' => 'Invalid YouTube URL'], 400);
        }
        $response = Http::get('https://www.youtube.com/oembed', ['url' => $url, 'format' => 'json']);
        if (!$response->successful()) {
            return response()->json(['error' => 'Video not found'], 404);
        }
        return response()->json($response->json());
    })->name('api.youtube-oembed');
});

require __DIR__.'/auth.php';
