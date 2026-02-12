<?php

namespace App\Http\Controllers;

use App\Meta;
use App\Models\Brand;
use App\Models\Page;
use Illuminate\Http\Request;
use Inertia\Inertia;

class BrandsViewController extends Controller
{
    protected const PER_PAGE = 12;

    protected static function defaultOgImage(): string
    {
        return asset('assets/images/pod-cover.png');
    }

    /**
     * Load meta from pages table for our-brands list. Falls back to home then defaults.
     */
    protected function applyOurBrandsListMeta(): void
    {
        $url = url()->current();
        Meta::addMeta('og:url', $url);
        Meta::setCanonical($url);
        Meta::addMeta('og:type', 'website');

        $home = Page::findBySlug('home');
        $page = Page::findBySlug('our-brands');

        $title = $page?->meta_title ?: $home?->meta_title ?: 'Our Brands';
        $description = $page?->meta_description ?: $home?->meta_description ?: 'Explore our partner brands and their sponsor videos.';
        $keywords = $page?->meta_keywords ?: $home?->meta_keywords ?: 'bruce w. cole, our brands, partner brands';
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

    public function index(Request $request)
    {
        $search = trim((string) $request->query('search', ''));
        $sort = $request->query('sort', 'title_asc');

        $query = Brand::query()->withCount('sponsorVideos');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', '%' . $search . '%')
                    ->orWhere('description', 'like', '%' . $search . '%');
            });
        }

        if ($sort === 'title_desc') {
            $query->orderBy('name', 'desc');
        } else {
            $query->orderBy('name', 'asc');
        }

        $this->applyOurBrandsListMeta();

        $paginator = $query->paginate(self::PER_PAGE)->withQueryString();

        return Inertia::render('OurBrands/Index', [
            'brands' => $paginator->items(),
            'filters' => [
                'search' => $search,
                'sort' => $sort,
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

    public function show(Request $request, Brand $brand)
    {
        $canonical = url()->current();
        Meta::addMeta('title', $brand->name);
        Meta::addMeta('description', $brand->description ?: 'Partner brand – ' . $brand->name);
        Meta::addMeta('og:title', $brand->name);
        Meta::addMeta('og:description', $brand->description ?: 'Partner brand – ' . $brand->name);
        Meta::addMeta('og:url', $canonical);
        Meta::setCanonical($canonical);
        Meta::addMeta('og:type', 'website');
        if ($brand->image_url) {
            Meta::addMeta('og:image', $brand->image_url);
        } else {
            Meta::addMeta('og:image', static::defaultOgImage());
        }

        $search = trim((string) $request->query('search', ''));
        $sort = (string) $request->query('sort', 'latest');

        $query = $brand->sponsorVideos();

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', '%' . $search . '%')
                    ->orWhere('slug', 'like', '%' . $search . '%')
                    ->orWhere('short_description', 'like', '%' . $search . '%');
            });
        }

        match ($sort) {
            'oldest' => $query->orderBy('created_at', 'asc'),
            'title_asc' => $query->orderBy('title', 'asc'),
            'title_desc' => $query->orderBy('title', 'desc'),
            default => $query->orderByDesc('created_at'),
        };

        $videos = $query->paginate(self::PER_PAGE)->withQueryString();

        return Inertia::render('OurBrands/Show', [
            'brand' => $brand,
            'videos' => $videos,
            'filters' => [
                'search' => $search,
                'sort' => $sort,
            ],
        ]);
    }
}
