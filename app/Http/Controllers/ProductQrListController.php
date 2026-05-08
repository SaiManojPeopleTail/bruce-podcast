<?php

namespace App\Http\Controllers;

use App\Models\ProductQrList;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class ProductQrListController extends Controller
{
    protected function disk(): string
    {
        return 's3';
    }

    protected function ensureS3Ready(): void
    {
        if (class_exists(\League\Flysystem\AwsS3V3\PortableVisibilityConverter::class)) {
            return;
        }

        throw ValidationException::withMessages([
            'images' => 'S3 adapter missing. Install league/flysystem-aws-s3-v3 before uploading files.',
        ]);
    }

    /**
     * Convert a full S3 URL back to its storage path (e.g. "ads/slug/file.jpg").
     */
    protected function urlToS3Path(string $url): string
    {
        $path = parse_url($url, PHP_URL_PATH) ?? '';

        return ltrim($path, '/');
    }

    /**
     * Silently delete a list of S3 URLs from storage.
     */
    protected function deleteS3Files(array $urls): void
    {
        foreach (array_filter($urls) as $url) {
            $path = $this->urlToS3Path($url);
            if ($path !== '') {
                Storage::disk($this->disk())->delete($path);
            }
        }
    }

    /**
     * Delete the whole product folder on S3: ads/{slug} (images + videos/).
     * Also removes legacy ads/videos/{slug} from older uploads.
     */
    protected function deleteProductAdsDirectoryOnS3(string $slug): void
    {
        if ($slug === '' || ! class_exists(\League\Flysystem\AwsS3V3\PortableVisibilityConverter::class)) {
            return;
        }

        $disk = Storage::disk($this->disk());

        try {
            $disk->deleteDirectory("ads/{$slug}");
        } catch (\Throwable $e) {
            // best-effort
        }

        try {
            $disk->deleteDirectory("ads/videos/{$slug}");
        } catch (\Throwable $e) {
            // legacy layout before ads/{slug}/videos
        }
    }

    /**
     * @param  list<string>  $imageUrls
     * @return list<string>
     */
    protected function migrateImageUrlsToNewSlug(string $oldSlug, string $newSlug, array $imageUrls): array
    {
        if ($oldSlug === $newSlug) {
            return $imageUrls;
        }

        $disk = Storage::disk($this->disk());
        $needle = "ads/{$oldSlug}/";
        $out = [];

        foreach ($imageUrls as $url) {
            $oldPath = $this->urlToS3Path($url);
            if ($oldPath === '' || ! str_contains($oldPath, $needle)) {
                $out[] = $url;

                continue;
            }
            $newPath = str_replace($needle, "ads/{$newSlug}/", $oldPath);
            if ($disk->exists($newPath)) {
                $out[] = $disk->url($newPath);
            } elseif ($disk->exists($oldPath)) {
                $disk->copy($oldPath, $newPath);
                $out[] = $disk->url($newPath);
            } else {
                $out[] = $url;
            }
        }

        return $out;
    }

    protected function migrateVideoUrlToNewSlug(string $oldSlug, string $newSlug, string $videoUrl): ?string
    {
        if ($oldSlug === $newSlug) {
            return $videoUrl;
        }

        $oldPath = $this->urlToS3Path($videoUrl);
        if ($oldPath === '') {
            return $videoUrl;
        }
        $needle = "ads/{$oldSlug}/";
        if (! str_contains($oldPath, $needle)) {
            return $videoUrl;
        }

        $newPath = str_replace($needle, "ads/{$newSlug}/", $oldPath);
        $disk = Storage::disk($this->disk());
        if ($disk->exists($newPath)) {
            return $disk->url($newPath);
        }
        if ($disk->exists($oldPath)) {
            $disk->copy($oldPath, $newPath);

            return $disk->url($newPath);
        }

        return $videoUrl;
    }

    /**
     * Signed temporary URL for a stored public URL (same pattern as {@see Personality::getVideoUrlAttribute}).
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

    public function index(Request $request)
    {
        $query = ProductQrList::query()->orderByDesc('created_at');

        if ($request->filled('search')) {
            $term = $request->search;
            $query->where(function ($q) use ($term) {
                $q->where('product_name', 'like', "%{$term}%")
                    ->orWhere('slug', 'like', "%{$term}%");
            });
        }

        return Inertia::render('ProductQrLists/Index', [
            'products' => $query->paginate(15)->withQueryString(),
            'filters' => $request->only('search'),
        ]);
    }

    public function create()
    {
        return Inertia::render('ProductQrLists/Create');
    }

    public function store(Request $request)
    {
        $this->ensureS3Ready();

        $request->merge([
            'notification_email' => is_string($request->input('notification_email'))
                ? trim($request->input('notification_email'))
                : $request->input('notification_email'),
        ]);

        $validated = $request->validate([
            'product_name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', 'unique:product_qr_lists,slug'],
            'notification_email' => ['nullable', 'string', 'max:255', 'email:rfc,strict,spoof'],
            'product_description' => ['nullable', 'string'],
            'images' => ['nullable', 'array', 'max:20'],
            'images.*' => ['file', 'mimetypes:image/jpeg,image/png,image/gif,image/webp,image/bmp,image/svg+xml,video/mp4,video/quicktime,video/x-msvideo,video/webm,video/x-matroska', 'max:204800'],
            'video' => ['nullable', 'file', 'mimetypes:video/mp4,video/quicktime,video/x-msvideo,video/webm,video/x-matroska', 'max:512000'],
            'generated_qr_code_base64' => ['nullable', 'string'],
        ]);

        $slug = $validated['slug'];

        $imageUrls = [];
        foreach ($request->file('images', []) as $image) {
            $path = $image->store("ads/{$slug}", $this->disk());
            $imageUrls[] = Storage::disk($this->disk())->url($path);
        }

        $videoUrl = null;
        if ($request->hasFile('video')) {
            $path = $request->file('video')->store("ads/{$slug}/videos", $this->disk());
            $videoUrl = Storage::disk($this->disk())->url($path);
        }

        ProductQrList::create([
            'product_name' => $validated['product_name'],
            'slug' => $slug,
            'notification_email' => filled($validated['notification_email'] ?? null)
                ? $validated['notification_email']
                : null,
            'product_description' => $validated['product_description'] ?? null,
            'product_images' => ! empty($imageUrls) ? $imageUrls : null,
            'video_url' => $videoUrl,
            'generated_qr_code_base64' => $validated['generated_qr_code_base64'] ?? null,
        ]);

        return redirect()->route('product-qr-lists.index')->with('success', 'Product QR created.');
    }

    public function edit(ProductQrList $productQrList)
    {
        $images = $productQrList->product_images ?? [];

        $product = $productQrList->toArray();
        $product['signed_product_images'] = array_values(array_map(
            fn ($u) => $this->temporaryUrlForStorageUrl((string) $u) ?? (string) $u,
            $images
        ));
        $product['signed_video_url'] = $productQrList->video_url
            ? ($this->temporaryUrlForStorageUrl($productQrList->video_url) ?? $productQrList->video_url)
            : null;

        return Inertia::render('ProductQrLists/Edit', [
            'product' => $product,
        ]);
    }

    public function update(Request $request, ProductQrList $productQrList)
    {
        $this->ensureS3Ready();

        $request->merge([
            'slug' => Str::slug((string) $request->input('slug', '')),
            'notification_email' => is_string($request->input('notification_email'))
                ? trim($request->input('notification_email'))
                : $request->input('notification_email'),
        ]);

        $validated = $request->validate([
            'product_name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', Rule::unique('product_qr_lists', 'slug')->ignore($productQrList->id)],
            'notification_email' => ['nullable', 'string', 'max:255', 'email:rfc,strict,spoof'],
            'product_description' => ['nullable', 'string'],
            'images' => ['nullable', 'array', 'max:20'],
            'images.*' => ['file', 'mimetypes:image/jpeg,image/png,image/gif,image/webp,image/bmp,image/svg+xml,video/mp4,video/quicktime,video/x-msvideo,video/webm,video/x-matroska', 'max:204800'],
            'existing_images' => ['nullable', 'array', 'max:20'],
            'existing_images.*' => ['nullable', 'string'],
            'video' => ['nullable', 'file', 'mimetypes:video/mp4,video/quicktime,video/x-msvideo,video/webm,video/x-matroska', 'max:512000'],
            'remove_video' => ['sometimes', 'boolean'],
            'generated_qr_code_base64' => ['nullable', 'string'],
        ]);

        $newSlug = $validated['slug'];
        if ($newSlug === '') {
            throw ValidationException::withMessages([
                'slug' => ['Enter a valid URL slug (letters, numbers, hyphens).'],
            ]);
        }

        $oldSlug = $productQrList->slug;

        $keptUrls = collect($request->input('existing_images', []))->filter()->values()->all();
        $oldUrls = $productQrList->product_images ?? [];
        $removedUrls = array_diff($oldUrls, $keptUrls);
        $this->deleteS3Files(array_values($removedUrls));

        $imageUrls = $keptUrls;
        $videoUrl = $productQrList->video_url;

        if ($request->hasFile('video')) {
            if ($videoUrl) {
                $this->deleteS3Files([$videoUrl]);
            }
            $videoUrl = null;
        } elseif ($request->boolean('remove_video')) {
            if ($videoUrl) {
                $this->deleteS3Files([$videoUrl]);
            }
            $videoUrl = null;
        }

        if ($oldSlug !== $newSlug) {
            $imageUrls = $this->migrateImageUrlsToNewSlug($oldSlug, $newSlug, $imageUrls);
            if ($videoUrl) {
                $videoUrl = $this->migrateVideoUrlToNewSlug($oldSlug, $newSlug, $videoUrl);
            }
        }

        foreach ($request->file('images', []) as $image) {
            if (count($imageUrls) >= 5) {
                break;
            }
            $path = $image->store("ads/{$newSlug}", $this->disk());
            $imageUrls[] = Storage::disk($this->disk())->url($path);
        }

        if ($request->hasFile('video')) {
            $path = $request->file('video')->store("ads/{$newSlug}/videos", $this->disk());
            $videoUrl = Storage::disk($this->disk())->url($path);
        }

        if ($oldSlug !== $newSlug) {
            $this->deleteProductAdsDirectoryOnS3($oldSlug);
        }

        $productQrList->update([
            'product_name' => $validated['product_name'],
            'slug' => $newSlug,
            'notification_email' => filled($validated['notification_email'] ?? null)
                ? $validated['notification_email']
                : null,
            'product_description' => $validated['product_description'] ?? null,
            'product_images' => ! empty($imageUrls) ? $imageUrls : null,
            'video_url' => $videoUrl,
            'generated_qr_code_base64' => $validated['generated_qr_code_base64'] ?? $productQrList->generated_qr_code_base64,
        ]);

        return redirect()->route('product-qr-lists.index')->with('success', 'Product QR updated.');
    }

    public function destroy(ProductQrList $productQrList)
    {
        $this->deleteProductAdsDirectoryOnS3($productQrList->slug);

        $productQrList->delete();

        return redirect()->route('product-qr-lists.index')->with('success', 'Product QR deleted.');
    }

    public function checkSlug(Request $request): JsonResponse
    {
        $raw = $request->query('slug', '');
        $slug = Str::slug($raw);

        if ($slug === '') {
            return response()->json(['available' => false, 'slug' => '']);
        }

        $ignoreId = $request->query('ignore_id');
        $base = $slug;
        $n = 0;

        while (
            ProductQrList::query()
                ->when($ignoreId, fn ($q) => $q->where('id', '!=', (int) $ignoreId))
                ->where('slug', $slug)
                ->exists()
        ) {
            $n++;
            $slug = $base.'-'.$n;
        }

        return response()->json([
            'available' => $slug === $base,
            'slug' => $slug,
        ]);
    }
}
