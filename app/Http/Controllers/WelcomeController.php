<?php

namespace App\Http\Controllers;

use App\Meta;
use App\Models\Episode;
use App\Models\Page;
use Illuminate\Http\Request;
use Inertia\Inertia;

class WelcomeController extends Controller
{
    const VIDEOS_PER_PAGE = 10;

    /** Default OG image for all public pages except episode (episode uses YouTube thumbnail). */
    protected static function defaultOgImage(): string
    {
        return asset('assets/images/pod-cover.png');
    }

    /**
     * YouTube thumbnail URL from video URL, or null if not a YouTube URL.
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

    public function episode(string $slug)
    {
        $episode = Episode::where('slug', $slug)->first();

        if (!$episode) {
            abort(404);
        }

        $canonical = url()->current();
        Meta::addMeta('title', $episode->title);
        Meta::addMeta('description', $episode->short_description ?: $episode->long_description);
        Meta::addMeta('og:title', $episode->title);
        Meta::addMeta('og:description', $episode->short_description ?: $episode->long_description);
        Meta::addMeta('og:url', $canonical);
        Meta::setCanonical($canonical);
        Meta::addMeta('og:type', 'website');
        $ytThumb = $this->youtubeThumbnailUrl($episode->video_url);
        if ($ytThumb) {
            Meta::addMeta('og:image', $ytThumb);
        }

        return Inertia::render('Episode', [
            'episode' => $episode,
        ]);
    }

    public function index()
    {
        $this->applyPageMeta('home');

        $paginator = Episode::orderByDesc('created_at')->paginate(self::VIDEOS_PER_PAGE);

        return Inertia::render('Welcome', [
            'videos' => $paginator->items(),
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
        ]);
    }

    public function guestSubmission()
    {
        $this->applyPageMeta('guest-submission');

        return Inertia::render('GuestSubmission', [
            'videos' => $this->getVideosForPages(),
        ]);
    }
}
