<?php

namespace App\Http\Controllers;

use App\Jobs\SendProductEnquiryNotificationJob;
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

    public function show(string $slug)
    {
        $product = ProductQrList::query()->where('slug', $slug)->firstOrFail();

        $images = $product->product_images ?? [];
        $signedImages = array_values(array_map(
            fn ($u) => $this->temporaryUrlForStorageUrl((string) $u) ?? (string) $u,
            $images
        ));

        $signedVideo = $product->video_url
            ? ($this->temporaryUrlForStorageUrl($product->video_url) ?? $product->video_url)
            : null;

        return Inertia::render('ProductEnquiry/Show', [
            'slug' => $slug,
            'product' => [
                'id' => $product->id,
                'slug' => $product->slug,
                'product_name' => $product->product_name,
                'product_description' => $product->product_description,
                'signed_product_images' => $signedImages,
                'signed_video_url' => $signedVideo,
            ],
        ]);
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
