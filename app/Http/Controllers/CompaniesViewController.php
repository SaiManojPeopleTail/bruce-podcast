<?php

namespace App\Http\Controllers;

use App\Meta;
use App\Models\ProductQrList;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class CompaniesViewController extends Controller
{
    protected const PER_PAGE = 12;

    protected function disk(): string
    {
        return 's3';
    }

    protected function urlToS3Path(string $url): string
    {
        $path = parse_url($url, PHP_URL_PATH) ?? '';

        return ltrim($path, '/');
    }

    protected function temporaryUrlForStorageUrl(?string $url): ?string
    {
        if ($url === null || $url === '') {
            return null;
        }

        try {
            $path = $this->urlToS3Path($url);
            if ($path === '' || ! str_starts_with($path, 'ads/')) {
                return $url;
            }

            if (class_exists(\League\Flysystem\AwsS3V3\PortableVisibilityConverter::class)) {
                return Storage::disk($this->disk())->temporaryUrl($path, now()->addMinutes(30));
            }

            return Storage::disk('public')->url($path);
        } catch (\Throwable $e) {
            return $url;
        }
    }

    protected function stripHtml(?string $html): string
    {
        return trim(preg_replace('/\s+/', ' ', strip_tags((string) $html)));
    }

    protected function applyCompaniesListMeta(): void
    {
        $appName = config('app.name', 'Bruce W. Cole');
        $url = url()->current();
        $title = "Companies - {$appName}";
        $description = 'Browse featured companies and connect with their AI concierge.';

        Meta::addMeta('title', $title);
        Meta::addMeta('description', $description);
        Meta::addMeta('og:type', 'website');
        Meta::addMeta('og:title', $title);
        Meta::addMeta('og:description', $description);
        Meta::addMeta('og:url', $url);
        Meta::addMeta('link:canonical', $url);
        Meta::addMeta('og:image', asset('assets/images/pod-cover.png'));
    }

    protected function queryCompanies(Request $request)
    {
        $query = ProductQrList::query()->where('is_active', true);

        $search = $request->query('search');
        if ($search && is_string($search)) {
            $term = trim($search);
            if ($term !== '') {
                $query->where(function ($q) use ($term) {
                    $q->where('product_name', 'like', '%' . $term . '%')
                        ->orWhere('slug', 'like', '%' . $term . '%')
                        ->orWhere('product_description', 'like', '%' . $term . '%');
                });
            }
        }

        $sort = $request->query('sort', 'latest');
        match ($sort) {
            'oldest' => $query->orderBy('updated_at', 'asc'),
            'title_asc' => $query->orderBy('product_name', 'asc'),
            'title_desc' => $query->orderBy('product_name', 'desc'),
            default => $query->orderByDesc('updated_at'),
        };

        return $query;
    }

    protected function mapCompanyListItem(ProductQrList $company): array
    {
        $images = $company->product_images ?? [];
        $firstImage = is_array($images) ? ($images[0] ?? null) : null;
        $thumbnail = $firstImage
            ? ($this->temporaryUrlForStorageUrl((string) $firstImage) ?? (string) $firstImage)
            : null;

        $plain = $this->stripHtml($company->product_description);

        return [
            'id' => $company->id,
            'slug' => $company->slug,
            'title' => $company->product_name,
            'short_description' => $plain,
            'thumbnail_url' => $thumbnail,
            'url' => url('/company/' . $company->slug),
            'updated_at' => $company->updated_at?->toIso8601String(),
        ];
    }

    public function index(Request $request)
    {
        $this->applyCompaniesListMeta();

        $paginator = $this->queryCompanies($request)
            ->paginate(self::PER_PAGE)
            ->withQueryString();

        $companies = collect($paginator->items())
            ->map(fn (ProductQrList $company) => $this->mapCompanyListItem($company))
            ->values()
            ->all();

        return Inertia::render('Companies/Index', [
            'companies' => $companies,
            'filters' => [
                'search' => $request->query('search', ''),
                'sort' => $request->query('sort', 'latest'),
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
}
