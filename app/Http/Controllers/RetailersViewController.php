<?php

namespace App\Http\Controllers;

use App\Meta;
use App\Models\Page;
use App\Models\RetailerProfile;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;

class RetailersViewController extends Controller
{
    protected const PER_PAGE = 12;

    protected static function defaultOgImage(): string
    {
        return asset('assets/images/pod-cover.png');
    }

    protected function applyRetailerProfilesListMeta(): void
    {
        $url = url()->current();
        Meta::addMeta('og:url', $url);
        Meta::setCanonical($url);
        Meta::addMeta('og:type', 'website');

        $home = Page::findBySlug('home');
        $page = Page::findBySlug('retailer-profiles');

        $title = $page?->meta_title ?: $home?->meta_title ?: 'Retailer Profiles';
        $description = $page?->meta_description ?: $home?->meta_description
            ?: 'Browse retailer profiles featured on In Conversation with Bruce W. Cole.';
        $keywords = $page?->meta_keywords ?: $home?->meta_keywords ?: 'natural health retailers, bruce w. cole, podcast retailers';
        $ogImage = $page?->og_image ?: $home?->og_image;

        Meta::addMeta('title', $title);
        Meta::addMeta('og:title', $title);
        Meta::addMeta('description', $description);
        Meta::addMeta('og:description', $description);
        Meta::addMeta('keywords', $keywords);
        if ($ogImage) {
            Meta::addMeta('og:image', $ogImage);
        } else {
            Meta::addMeta('og:image', static::defaultOgImage());
        }
    }

    public function index(Request $request)
    {
        $search = trim((string) $request->query('search', ''));
        $sort = $request->query('sort', 'name_asc');

        $query = RetailerProfile::query()->where('is_active', true);

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', '%'.$search.'%')
                    ->orWhere('handle', 'like', '%'.$search.'%')
                    ->orWhere('description', 'like', '%'.$search.'%');
            });
        }

        if ($sort === 'name_desc') {
            $query->orderBy('name', 'desc');
        } else {
            $query->orderBy('name', 'asc');
        }

        $this->applyRetailerProfilesListMeta();

        $paginator = $query->paginate(self::PER_PAGE)->withQueryString();

        return Inertia::render('RetailerProfiles/Public/Index', [
            'retailers' => collect($paginator->items())->map(function (RetailerProfile $r) {
                $plain = trim(preg_replace('/\s+/', ' ', strip_tags((string) ($r->description ?? ''))));

                return [
                    'id' => $r->id,
                    'name' => $r->name,
                    'handle' => $r->handle,
                    'description_preview' => $plain !== '' ? Str::limit($plain, 220) : '',
                ];
            })->all(),
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

    public function show(Request $request, string $handle)
    {
        $retailer = RetailerProfile::query()
            ->where('handle', $handle)
            ->where('is_active', true)
            ->firstOrFail();

        $canonical = url()->current();
        $plainDescription = trim(preg_replace('/\s+/', ' ', strip_tags((string) ($retailer->description ?? ''))));
        $metaDescription = $plainDescription !== ''
            ? Str::limit($plainDescription, 160)
            : 'Retailer profile: '.$retailer->name;

        Meta::addMeta('title', $retailer->name.' – Retailer Profiles');
        Meta::addMeta('description', $metaDescription);
        Meta::addMeta('og:title', $retailer->name);
        Meta::addMeta('og:description', $metaDescription);
        Meta::addMeta('og:url', $canonical);
        Meta::setCanonical($canonical);
        Meta::addMeta('og:type', 'website');
        Meta::addMeta('og:image', static::defaultOgImage());

        return Inertia::render('RetailerProfiles/Public/Show', [
            'retailer' => [
                'id' => $retailer->id,
                'name' => $retailer->name,
                'handle' => $retailer->handle,
                'description' => $retailer->description ?? '',
                'address_line_1' => $retailer->address_line_1 ?? '',
                'address_line_2' => $retailer->address_line_2 ?? '',
                'city' => $retailer->city ?? '',
                'state' => $retailer->state ?? '',
                'zip' => $retailer->zip ?? '',
                'country' => $retailer->country ?? '',
            ],
        ]);
    }
}
