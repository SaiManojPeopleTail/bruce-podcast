<?php

namespace App\Http\Controllers;

use App\Jobs\SendProductEnquiryNotificationJob;
use App\Meta;
use App\Models\ProductEnquiry;
use App\Models\ProductQrList;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class ProductEnquiryController extends Controller
{
    protected function disk(): string
    {
        return 's3';
    }

    protected function urlToS3Path(string $url): string
    {
        $path = parse_url($url, PHP_URL_PATH) ?? '';

        return ltrim($path, '/');
    }

    /**
     * @see \App\Http\Controllers\ProductQrListController::temporaryUrlForStorageUrl()
     */
    protected function temporaryUrlForStorageUrl(?string $url): ?string
    {
        if ($url === null || $url === '') {
            return null;
        }

        try {
            $path = $this->urlToS3Path($url);
            if ($path === '') {
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

    private function stripHtml(string $html): string
    {
        return trim(preg_replace('/\s+/', ' ', strip_tags($html)));
    }

    private function truncate(string $text, int $max): string
    {
        if (mb_strlen($text) <= $max) {
            return $text;
        }
        $slice = mb_substr($text, 0, $max);
        $lastBreak = max(
            mb_strrpos($slice, '. '),
            mb_strrpos($slice, '! '),
            mb_strrpos($slice, '? ')
        );
        return $lastBreak > $max * 0.6
            ? mb_substr($slice, 0, (int) $lastBreak + 1)
            : rtrim($slice) . '…';
    }

    private function buildSeoMeta(ProductQrList $product, array $signedImages): void
    {
        $appName     = config('app.name', 'Bruce W. Cole');
        $plainDesc   = $this->stripHtml((string) ($product->product_description ?? ''));
        $metaDesc    = $plainDesc !== ''
            ? $this->truncate($plainDesc, 155)
            : "Learn about {$product->product_name} — connect with our AI concierge for instant answers.";

        $canonical   = rtrim(config('app.url'), '/') . '/company/' . $product->slug;
        $ogImage     = $signedImages[0] ?? null;

        $title = "{$product->product_name} - {$appName}";

        Meta::addMeta('title', $title);
        Meta::addMeta('description', $metaDesc);
        Meta::addMeta('og:type', 'website');
        Meta::addMeta('og:title', $title);
        Meta::addMeta('og:description', $metaDesc);
        Meta::addMeta('og:url', $canonical);
        Meta::addMeta('og:site_name', $appName);
        if ($ogImage) {
            Meta::addMeta('og:image', $ogImage);
        }
        Meta::addMeta('twitter:card', $ogImage ? 'summary_large_image' : 'summary');
        Meta::addMeta('twitter:title', $title);
        Meta::addMeta('twitter:description', $metaDesc);
        if ($ogImage) {
            Meta::addMeta('twitter:image', $ogImage);
        }
        Meta::addMeta('link:canonical', $canonical);

        // Organization + BreadcrumbList structured data
        $orgData = [
            '@type'  => 'Organization',
            '@id'    => $canonical . '#organization',
            'name'   => $product->product_name,
            'url'    => $canonical,
        ];
        if ($plainDesc !== '') {
            $orgData['description'] = $this->truncate($plainDesc, 300);
        }
        if ($ogImage) {
            $orgData['image'] = $ogImage;
        }

        $jsonLd = json_encode([
            '@context' => 'https://schema.org',
            '@graph'   => [
                $orgData,
                [
                    '@type'           => 'BreadcrumbList',
                    'itemListElement' => [
                        ['@type' => 'ListItem', 'position' => 1, 'name' => 'Home', 'item' => rtrim(config('app.url'), '/')],
                        ['@type' => 'ListItem', 'position' => 2, 'name' => $product->product_name, 'item' => $canonical],
                    ],
                ],
            ],
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        Meta::addMeta('json-ld:company-page', $jsonLd);
    }

    private function renderProduct(ProductQrList $product, bool $isPreview = false)
    {
        $images = $product->product_images ?? [];
        $signedImages = array_values(array_map(
            fn ($u) => $this->temporaryUrlForStorageUrl((string) $u) ?? (string) $u,
            $images
        ));
        $signedVideo = $product->video_url
            ? ($this->temporaryUrlForStorageUrl($product->video_url) ?? $product->video_url)
            : null;

        if (! $isPreview) {
            $this->buildSeoMeta($product, $signedImages);
        }

        $design = config('features.product_enquiry_design', 'v1') === 'v2'
            ? 'ProductEnquiry/ShowV2'
            : 'ProductEnquiry/Show';

        return Inertia::render($design, [
            'slug'       => $product->slug,
            'is_preview' => $isPreview,
            'product'    => [
                'id'                    => $product->id,
                'slug'                  => $product->slug,
                'product_name'          => $product->product_name,
                'product_description'   => $product->product_description,
                'signed_product_images' => $signedImages,
                'signed_video_url'      => $signedVideo,
                'retailers'             => $product->retailers ?? [],
                'elevenlabs_kb_id'      => $product->elevenlabs_kb_id,
                'kb_rag_status'         => $product->kb_rag_status,
                'kb_type'               => $product->kb_type,
                'first_message'         => $product->first_message,
                'voice_id'              => $product->voice_id,
                'social_posts'          => array_values(array_filter(
                    $product->social_posts ?? [],
                    fn ($p) => (bool) ($p['active'] ?? true)
                )),
            ],
        ]);
    }

    public function show(string $slug)
    {
        $product = ProductQrList::query()->where('slug', $slug)->where('is_active', true)->firstOrFail();

        return $this->renderProduct($product);
    }

    /**
     * Draft preview — active status ignored.
     * Not linked from anywhere public and excluded from robots.txt.
     */
    public function preview(string $slug)
    {
        $product = ProductQrList::query()->where('slug', $slug)->firstOrFail();

        return $this->renderProduct($product, isPreview: true);
    }

    public function store(Request $request, string $slug)
    {
        $product = ProductQrList::query()->where('slug', $slug)->firstOrFail();

        $request->merge([
            'email' => is_string($request->input('email')) ? trim($request->input('email')) : $request->input('email'),
            'store_name' => is_string($request->input('store_name')) ? trim($request->input('store_name')) : $request->input('store_name'),
            'message' => is_string($request->input('message')) ? trim($request->input('message')) : $request->input('message'),
        ]);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'store_name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:64'],
            'email' => ['required', 'string', 'max:255', 'email:rfc,strict,spoof'],
            'message' => ['nullable', 'string', 'max:10000'],
        ]);

        $notifyTo = trim((string) ($product->notification_email ?? ''));
        $notificationStatus = $notifyTo !== '' ? 'pending' : 'na';

        $enquiry = ProductEnquiry::query()->create([
            'product_qr_list_id' => $product->id,
            'name' => $validated['name'],
            'store_name' => $validated['store_name'],
            'phone' => $validated['phone'],
            'email' => $validated['email'],
            'message' => $validated['message'] ?? '',
            'notification_status' => $notificationStatus,
        ]);

        if ($notificationStatus === 'pending') {
            // Runs after the redirect response (no queue worker required). Uses the sync driver internally.
            SendProductEnquiryNotificationJob::dispatchAfterResponse($enquiry->id);
        }

        return redirect()->route('product-enquiry.index', $slug)
            ->with('success', 'Thank you! We have received your enquiry.');
    }
}
