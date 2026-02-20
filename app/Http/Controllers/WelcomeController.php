<?php

namespace App\Http\Controllers;

use App\Meta;
use App\Models\Brand;
use App\Models\Episode;
use App\Models\Page;
use App\Models\Personality;
use Illuminate\Http\Request;
use Inertia\Inertia;

class WelcomeController extends Controller
{
    const VIDEOS_PER_PAGE = 10;

    /** Default OG image for all public pages except episode (episode uses the episode thumbnail when available). */
    protected static function defaultOgImage(): string
    {
        return asset('assets/images/pod-cover.png');
    }

    /**
     * YouTube thumbnail URL from video URL, or null if not a YouTube URL.
     * Kept for legacy episodes that still reference YouTube.
     */
    protected function youtubeThumbnailUrl(?string $videoUrl): ?string
    {
        if (!$videoUrl) {
            return null;
        }
        if (preg_match('#(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]{11})#', $videoUrl, $m)) {
            return 'https://img.youtube.com/vi/' . $m[1] . '/maxresdefault.jpg';
        }
        return null;
    }

    /**
     * Load meta from pages table: current page with fallback to home (/) when a field is empty.
     * Episode page does not use this; it uses episode title and description.
     */
    protected function applyPageMeta(string $slug): void
    {
        $url = url()->current();
        Meta::addMeta('og:url', $url);
        Meta::setCanonical($url);
        Meta::addMeta('og:type', 'website');

        $home = Page::findBySlug('home');
        $page = Page::findBySlug($slug);
        if (!$page && !$home) {
            return;
        }

        $title = $page?->meta_title ?: $home?->meta_title;
        $description = $page?->meta_description ?: $home?->meta_description;
        $keywords = $page?->meta_keywords ?: $home?->meta_keywords;
        $ogImage = $page?->og_image ?: $home?->og_image;

        if ($title) {
            Meta::addMeta('title', $title);
            Meta::addMeta('og:title', $title);
        }
        if ($description) {
            Meta::addMeta('description', $description);
            Meta::addMeta('og:description', $description);
        }
        if ($keywords) {
            Meta::addMeta('keywords', $keywords);
        }
        if ($ogImage) {
            Meta::addMeta('og:image', $ogImage);
        } else {
            Meta::addMeta('og:image', static::defaultOgImage());
        }
    }

    /**
     * Episodes for lists (Welcome, About, Brand Partnerships) – from database.
     */
    protected function getVideosForPages()
    {
        return Episode::orderByDesc('created_at')->get();
    }


    public function index()
    {
        $this->applyPageMeta('home');

        $paginator = Episode::orderByDesc('created_at')->paginate(self::VIDEOS_PER_PAGE);

        return Inertia::render('Welcome', [
            'videos' => $paginator->items(),
            'current_time_and_date' => now()->format('Y-m-d H:i:s'),
            'nextPage' => $paginator->hasMorePages() ? $paginator->currentPage() + 1 : null,
            'hasMore' => $paginator->hasMorePages(),
        ]);
    }

    /**
     * Load more videos (JSON) for homepage "Load more" button.
     */
    public function videosMore(Request $request)
    {
        $page = max(1, (int) $request->query('page', 2));
        $paginator = Episode::orderByDesc('created_at')->paginate(self::VIDEOS_PER_PAGE, ['*'], 'page', $page);

        return response()->json([
            'videos' => $paginator->items(),
            'next_page' => $paginator->hasMorePages() ? $paginator->currentPage() + 1 : null,
            'has_more' => $paginator->hasMorePages(),
        ]);
    }

    public function meetBruce()
    {
        $this->applyPageMeta('about');

        return Inertia::render('About', [
            'videos' => $this->getVideosForPages(),
        ]);
    }

    public function brandPartnerships()
    {
        $this->applyPageMeta('brand-partnerships');

        return Inertia::render('BrandPartnerships', [
            'videos' => $this->getVideosForPages(),
            'brands' => Brand::query()
                ->with(['sponsorVideos' => function ($q) {
                    $q->orderByDesc('created_at');
                }])
                ->orderByDesc('created_at')
                ->get(),
            'personalities' => Personality::query()
                ->where('status', true)
                ->orderBy('name')
                ->get(['id', 'name', 'video_path', 'status', 'created_at', 'updated_at']),
        ]);
    }

    public function guestSubmission()
    {
        $this->applyPageMeta('guest-submissions');

        return Inertia::render('GuestSubmission', [
            'videos' => $this->getVideosForPages(),
        ]);
    }
}
