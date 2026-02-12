<?php

use App\Http\Controllers\BrandController;
use App\Http\Controllers\BrandsViewController;
use App\Http\Controllers\ClipController;
use App\Http\Controllers\EpisodeController;
use App\Http\Controllers\EpisodesViewController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\SitemapController;
use App\Http\Controllers\SiteSettingsController;
use App\Http\Controllers\SponsorVideoController;
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
Route::get('/guest-submissions', [WelcomeController::class, 'guestSubmission'])->name('guest-submissions');
Route::redirect('/guest-submission', '/guest-submissions', 301);
Route::get('/episode/{slug}', [EpisodesViewController::class, 'episode'])->name('episode');
Route::get('/all-episodes', [EpisodesViewController::class, 'allIndex'])->name('all-episodes-list');
Route::get('/episodes', [EpisodesViewController::class, 'index'])->name('episodes-list');
Route::get('/episodes/clips', [EpisodesViewController::class, 'clipsIndex'])->name('episodes-clips-list');
Route::get('/episodes/clip/{slug}', [EpisodesViewController::class, 'clipShow'])->name('episode-clip-show');
Route::get('/sponsor-videos', [EpisodesViewController::class, 'sponsorVideosIndex'])->name('sponsor-videos-list');
Route::get('/sponsor-video/{slug}', [EpisodesViewController::class, 'sponsorVideoShow'])->name('sponsor-video-show');
// Route::get('/our-brands', [BrandsViewController::class, 'index'])->name('our-brands-list');
// Route::get('/our-brands/{brand}', [BrandsViewController::class, 'show'])->name('our-brands-show');

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
    Route::patch('/episodes/{episode}/toggle-status', [EpisodeController::class, 'toggleStatus'])->name('episodes.toggle-status');
    Route::delete('/episodes/{episode}', [EpisodeController::class, 'destroy'])->name('episodes.destroy');
    Route::post('/episodes/upload/bunny/init', [EpisodeController::class, 'bunnyUploadInit'])->name('episodes.bunny.init');
    Route::post('/episodes/upload/bunny/status', [EpisodeController::class, 'bunnyVideoStatus'])->name('episodes.bunny.status');
    Route::post('/episodes/upload/bunny/finalize', [EpisodeController::class, 'bunnyUploadFinalize'])->name('episodes.bunny.finalize');
    Route::post('/episodes/upload/bunny/thumbnail', [EpisodeController::class, 'bunnyThumbnailUpload'])->name('episodes.bunny.thumbnail');
    Route::get('/episodes/{episode}/videos', [ClipController::class, 'index'])->name('episodes.clips.index');
    Route::get('/episodes/{episode}/videos/create', [ClipController::class, 'create'])->name('episodes.clips.create');
    Route::post('/episodes/{episode}/videos', [ClipController::class, 'store'])->name('episodes.clips.store');
    Route::get('/episodes/{episode}/videos/{clip}/edit', [ClipController::class, 'edit'])->name('episodes.clips.edit');
    Route::patch('/episodes/{episode}/videos/{clip}', [ClipController::class, 'update'])->name('episodes.clips.update');
    Route::patch('/episodes/{episode}/videos/{clip}/toggle-status', [ClipController::class, 'toggleStatus'])->name('episodes.clips.toggle-status');
    Route::delete('/episodes/{episode}/videos/{clip}', [ClipController::class, 'destroy'])->name('episodes.clips.destroy');
    Route::post('/episodes/{episode}/videos/upload/bunny/init', [ClipController::class, 'bunnyUploadInit'])->name('episodes.clips.bunny.init');
    Route::post('/episodes/{episode}/videos/upload/bunny/status', [ClipController::class, 'bunnyVideoStatus'])->name('episodes.clips.bunny.status');
    Route::post('/episodes/{episode}/videos/upload/bunny/finalize', [ClipController::class, 'bunnyUploadFinalize'])->name('episodes.clips.bunny.finalize');
    Route::post('/episodes/{episode}/videos/upload/bunny/thumbnail', [ClipController::class, 'bunnyThumbnailUpload'])->name('episodes.clips.bunny.thumbnail');

    Route::get('/brands', [BrandController::class, 'index'])->name('brands.index');
    Route::get('/brands/create', [BrandController::class, 'create'])->name('brands.create');
    Route::post('/brands', [BrandController::class, 'store'])->name('brands.store');
    Route::get('/brands/{brand}/edit', [BrandController::class, 'edit'])->name('brands.edit');
    Route::patch('/brands/{brand}', [BrandController::class, 'update'])->name('brands.update');
    Route::delete('/brands/{brand}', [BrandController::class, 'destroy'])->name('brands.destroy');

    Route::get('/brands/{brand}/gallery', [SponsorVideoController::class, 'index'])->name('brands.videos.index');
    Route::get('/brands/{brand}/gallery/create', [SponsorVideoController::class, 'create'])->name('brands.videos.create');
    Route::post('/brands/{brand}/gallery', [SponsorVideoController::class, 'store'])->name('brands.videos.store');
    Route::get('/brands/{brand}/gallery/{video}/edit', [SponsorVideoController::class, 'edit'])->name('brands.videos.edit');
    Route::patch('/brands/{brand}/gallery/{video}', [SponsorVideoController::class, 'update'])->name('brands.videos.update');
    Route::patch('/brands/{brand}/gallery/{video}/toggle-status', [SponsorVideoController::class, 'toggleStatus'])->name('brands.videos.toggle-status');
    Route::delete('/brands/{brand}/gallery/{video}', [SponsorVideoController::class, 'destroy'])->name('brands.videos.destroy');
    Route::post('/brands/{brand}/gallery/upload/bunny/init', [SponsorVideoController::class, 'bunnyUploadInit'])->name('brands.videos.bunny.init');
    Route::post('/brands/{brand}/gallery/upload/bunny/status', [SponsorVideoController::class, 'bunnyVideoStatus'])->name('brands.videos.bunny.status');
    Route::post('/brands/{brand}/gallery/upload/bunny/finalize', [SponsorVideoController::class, 'bunnyUploadFinalize'])->name('brands.videos.bunny.finalize');
    Route::post('/brands/{brand}/gallery/upload/bunny/thumbnail', [SponsorVideoController::class, 'bunnyThumbnailUpload'])->name('brands.videos.bunny.thumbnail');

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
