<?php

namespace App\Http\Controllers;

use App\Meta;
use App\Models\Brand;
use App\Models\Clip;
use App\Models\Episode;
use App\Models\Page;
use App\Models\SponsorVideo;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Inertia\Inertia;

class EpisodesViewController extends Controller
{
    protected const PER_PAGE = 12;

    protected static function defaultOgImage(): string
    {
        return asset('assets/images/pod-cover.png');
    }

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
     * Load meta from pages table for list views (episodes, sponsor-videos).
     * Falls back to home page and then to defaults when a field is empty.
     */
    protected function applyListPageMeta(string $slug, array $defaults): void
    {
        $url = url()->current();
        Meta::addMeta('og:url', $url);
        Meta::setCanonical($url);
        Meta::addMeta('og:type', 'website');

        $home = Page::findBySlug('home');
        $page = Page::findBySlug($slug);

        $title = $page?->meta_title ?: $home?->meta_title ?: ($defaults['title'] ?? null);
        $description = $page?->meta_description ?: $home?->meta_description ?: ($defaults['description'] ?? null);
        $keywords = $page?->meta_keywords ?: $home?->meta_keywords ?: ($defaults['keywords'] ?? null);
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

    protected function applyEpisodesListMeta(): void
    {
        $this->applyListPageMeta('episodes', [
            'title' => 'All Episodes',
            'description' => 'All Episodes',
            'keywords' => 'bruce w. cole, episodes, all episodes',
        ]);
    }

    protected function applyAllVideosListMeta(): void
    {
        $this->applyListPageMeta('all-episodes', [
            'title' => 'All Episodes',
            'description' => 'All episodes, clips, and sponsor videos.',
            'keywords' => 'bruce w. cole, all episodes, episodes, clips, sponsor videos',
        ]);
    }

    protected function applySponsorVideosListMeta(): void
    {
        $this->applyListPageMeta('sponsor-videos', [
            'title' => 'Sponsor Videos',
            'description' => 'Sponsor Videos',
            'keywords' => 'bruce w. cole, sponsor videos',
        ]);
    }

    protected function applyClipsListMeta(): void
    {
        $this->applyListPageMeta('clips', [
            'title' => 'Clips',
            'description' => 'Clips',
            'keywords' => 'bruce w. cole, clips',
        ]);
    }

    protected function queryEpisodes(Request $request)
    {
        $query = Episode::query();
        $search = $request->query('search');
        if ($search && is_string($search)) {
            $term = trim($search);
            if ($term !== '') {
                $query->where(function ($q) use ($term) {
                    $q->where('title', 'like', '%' . $term . '%')
                        ->orWhere('slug', 'like', '%' . $term . '%')
                        ->orWhere('short_description', 'like', '%' . $term . '%');
                });
            }
        }
        $sort = $request->query('sort', 'latest');
        match ($sort) {
            'oldest' => $query->orderBy('created_at', 'asc'),
            'title_asc' => $query->orderBy('title', 'asc'),
            'title_desc' => $query->orderBy('title', 'desc'),
            default => $query->orderByDesc('created_at'),
        };
        return $query;
    }

    protected function querySponsorVideos(Request $request)
    {
        $query = SponsorVideo::query();
        $search = $request->query('search');
        if ($search && is_string($search)) {
            $term = trim($search);
            if ($term !== '') {
                $query->where(function ($q) use ($term) {
                    $q->where('title', 'like', '%' . $term . '%')
                        ->orWhere('slug', 'like', '%' . $term . '%')
                        ->orWhere('short_description', 'like', '%' . $term . '%');
                });
            }
        }
        $brandId = $request->query('brand');
        if ($brandId !== null && $brandId !== '') {
            $brandId = (int) $brandId;
            if ($brandId > 0) {
                $query->where('brand_id', $brandId);
            }
        }
        $sort = $request->query('sort', 'latest');
        match ($sort) {
            'oldest' => $query->orderBy('created_at', 'asc'),
            'title_asc' => $query->orderBy('title', 'asc'),
            'title_desc' => $query->orderBy('title', 'desc'),
            default => $query->orderByDesc('created_at'),
        };
        return $query;
    }

    protected function queryClips(Request $request)
    {
        $query = Clip::query();
        $search = $request->query('search');
        if ($search && is_string($search)) {
            $term = trim($search);
            if ($term !== '') {
                $query->where(function ($q) use ($term) {
                    $q->where('title', 'like', '%' . $term . '%')
                        ->orWhere('slug', 'like', '%' . $term . '%')
                        ->orWhere('short_description', 'like', '%' . $term . '%');
                });
            }
        }
        $sort = $request->query('sort', 'latest');
        match ($sort) {
            'oldest' => $query->orderBy('created_at', 'asc'),
            'title_asc' => $query->orderBy('title', 'asc'),
            'title_desc' => $query->orderBy('title', 'desc'),
            default => $query->orderByDesc('created_at'),
        };
        return $query;
    }

    protected function mapEpisodeListItem(Episode $episode): array
    {
        return array_merge($episode->toArray(), [
            'content_type' => 'episode',
        ]);
    }

    protected function mapClipListItem(Clip $clip): array
    {
        return array_merge($clip->toArray(), [
            'content_type' => 'clip',
        ]);
    }

    protected function mapSponsorVideoListItem(SponsorVideo $video): array
    {
        return array_merge($video->toArray(), [
            'content_type' => 'sponsor-video',
        ]);
    }

    protected function paginateCollection(Request $request, \Illuminate\Support\Collection $items): LengthAwarePaginator
    {
        $page = max(1, (int) $request->query('page', 1));
        $total = $items->count();
        $slice = $items->forPage($page, self::PER_PAGE)->values();

        return (new LengthAwarePaginator(
            $slice,
            $total,
            self::PER_PAGE,
            $page,
            ['path' => url()->current(), 'query' => $request->query()]
        ))->appends($request->query());
    }

    public function allIndex(Request $request)
    {
        $this->applyAllVideosListMeta();

        $episodes = $this->queryEpisodes($request)->get()->map(fn (Episode $episode) => $this->mapEpisodeListItem($episode));
        $clips = $this->queryClips($request)->get()->map(fn (Clip $clip) => $this->mapClipListItem($clip));
        $sponsorVideos = $this->querySponsorVideos($request)->get()->map(fn (SponsorVideo $video) => $this->mapSponsorVideoListItem($video));

        $all = $episodes->concat($clips)->concat($sponsorVideos);
        $sort = $request->query('sort', 'latest');

        if ($sort === 'oldest') {
            $all = $all->sortBy('created_at');
        } elseif ($sort === 'title_asc') {
            $all = $all->sortBy(fn ($item) => strtolower((string) ($item['title'] ?? '')));
        } elseif ($sort === 'title_desc') {
            $all = $all->sortByDesc(fn ($item) => strtolower((string) ($item['title'] ?? '')));
        } else {
            $all = $all->sortByDesc('created_at');
        }

        $paginator = $this->paginateCollection($request, $all->values());

        return Inertia::render('Episodes', [
            'tab' => 'all',
            'allVideos' => $paginator->items(),
            'episodes' => [],
            'clips' => [],
            'sponsorVideos' => [],
            'brands' => [],
            'filters' => [
                'search' => $request->query('search', ''),
                'sort' => $request->query('sort', 'latest'),
                'brand' => '',
            ],
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
                'links' => $paginator->linkCollection()->toArray(),
            ],
        ]);
    }

    public function index(Request $request)
    {
        $this->applyEpisodesListMeta();
        $paginator = $this->queryEpisodes($request)->paginate(self::PER_PAGE)->withQueryString();
        return Inertia::render('Episodes', [
            'tab' => 'episodes',
            'allVideos' => [],
            'episodes' => $paginator->items(),
            'clips' => [],
            'sponsorVideos' => [],
            'brands' => [],
            'filters' => [
                'search' => $request->query('search', ''),
                'sort' => $request->query('sort', 'latest'),
                'brand' => '',
            ],
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
                'links' => $paginator->linkCollection()->toArray(),
            ],
        ]);
    }

    public function sponsorVideosIndex(Request $request)
    {
        $this->applySponsorVideosListMeta();
        $paginator = $this->querySponsorVideos($request)->paginate(self::PER_PAGE)->withQueryString();
        $brands = Brand::orderBy('name')->get(['id', 'name'])->map(fn (Brand $b) => ['id' => $b->id, 'name' => $b->name])->values()->all();
        return Inertia::render('Episodes', [
            'tab' => 'sponsor-videos',
            'allVideos' => [],
            'episodes' => [],
            'clips' => [],
            'sponsorVideos' => $paginator->items(),
            'brands' => $brands,
            'filters' => [
                'search' => $request->query('search', ''),
                'sort' => $request->query('sort', 'latest'),
                'brand' => $request->query('brand', ''),
            ],
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
                'links' => $paginator->linkCollection()->toArray(),
            ],
        ]);
    }

    public function clipsIndex(Request $request)
    {
        $this->applyClipsListMeta();
        $paginator = $this->queryClips($request)->paginate(self::PER_PAGE)->withQueryString();
        return Inertia::render('Episodes', [
            'tab' => 'clips',
            'allVideos' => [],
            'episodes' => [],
            'clips' => $paginator->items(),
            'sponsorVideos' => [],
            'brands' => [],
            'filters' => [
                'search' => $request->query('search', ''),
                'sort' => $request->query('sort', 'latest'),
                'brand' => '',
            ],
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
                'links' => $paginator->linkCollection()->toArray(),
            ],
        ]);
    }

    public function sponsorVideoShow(string $slug)
    {
        $video = SponsorVideo::where('slug', $slug)->first();
        if (!$video) {
            abort(404);
        }
        $canonical = url()->current();
        Meta::addMeta('title', $video->title);
        Meta::addMeta('description', $video->short_description ?: $video->long_description);
        Meta::addMeta('og:title', $video->title);
        Meta::addMeta('og:description', $video->short_description ?: $video->long_description);
        Meta::addMeta('og:url', $canonical);
        Meta::setCanonical($canonical);
        Meta::addMeta('og:type', 'website');
        if ($video->thumbnail_url) {
            Meta::addMeta('og:image', $video->thumbnail_url);
        } else {
            Meta::addMeta('og:image', static::defaultOgImage());
        }
        return Inertia::render('SponsorVideo', [
            'video' => $video,
        ]);
    }

    public function clipShow(string $slug)
    {
        $video = Clip::where('slug', $slug)->first();
        if (!$video) {
            abort(404);
        }
        $canonical = url()->current();
        Meta::addMeta('title', $video->title);
        Meta::addMeta('description', $video->short_description ?: $video->long_description);
        Meta::addMeta('og:title', $video->title);
        Meta::addMeta('og:description', $video->short_description ?: $video->long_description);
        Meta::addMeta('og:url', $canonical);
        Meta::setCanonical($canonical);
        Meta::addMeta('og:type', 'website');
        if ($video->thumbnail_url) {
            Meta::addMeta('og:image', $video->thumbnail_url);
        } else {
            Meta::addMeta('og:image', static::defaultOgImage());
        }
        return Inertia::render('Clip', [
            'video' => $video,
        ]);
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
        if ($episode->thumbnail_url) {
            Meta::addMeta('og:image', $episode->thumbnail_url);
        } else {
            $ytThumb = $this->youtubeThumbnailUrl($episode->video_url);
            if ($ytThumb) {
                Meta::addMeta('og:image', $ytThumb);
            } else {
                Meta::addMeta('og:image', static::defaultOgImage());
            }
        }

        return Inertia::render('Episode', [
            'episode' => $episode,
        ]);
    }
}
