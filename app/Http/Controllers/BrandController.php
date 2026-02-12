<?php

namespace App\Http\Controllers;

use App\Models\Brand;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class BrandController extends Controller
{
    protected function imageDisk(): string
    {
        return 's3';
    }

    protected function ensureS3Ready(): void
    {
        if (class_exists(\League\Flysystem\AwsS3V3\PortableVisibilityConverter::class)) {
            return;
        }

        throw ValidationException::withMessages([
            'image' => 'S3 adapter missing. Install league/flysystem-aws-s3-v3 before uploading brand images.',
        ]);
    }

    public function index(Request $request)
    {
        $query = Brand::query()
            ->withCount([
                'sponsorVideos as sponsor_videos_count' => function ($q) {
                    $q->withoutGlobalScope('published');
                },
            ])
            ->orderByDesc('created_at');

        if ($request->filled('search')) {
            $term = $request->search;
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', "%{$term}%")
                    ->orWhere('description', 'like', "%{$term}%");
            });
        }

        return Inertia::render('Brands/Index', [
            'brands' => $query->paginate(15)->withQueryString(),
            'filters' => $request->only('search'),
        ]);
    }

    public function create()
    {
        return Inertia::render('Brands/Create');
    }

    public function store(Request $request)
    {
        $this->ensureS3Ready();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'image' => ['required', 'image', 'max:8192'],
        ]);

        $path = $request->file('image')->store('brands', $this->imageDisk());

        Brand::create([
            'name' => $validated['name'],
            'description' => $validated['description'],
            'image_path' => $path,
        ]);

        return redirect()->route('brands.index')->with('success', 'Brand created.');
    }

    public function edit(Brand $brand)
    {
        return Inertia::render('Brands/Edit', [
            'brand' => $brand,
        ]);
    }

    public function update(Request $request, Brand $brand)
    {
        $this->ensureS3Ready();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'image' => ['nullable', 'image', 'max:8192'],
        ]);

        $nextImagePath = $brand->image_path;
        if ($request->hasFile('image')) {
            $nextImagePath = $request->file('image')->store('brands', $this->imageDisk());
            if ($brand->image_path) {
                Storage::disk($this->imageDisk())->delete($brand->image_path);
            }
        }

        $brand->update([
            'name' => $validated['name'],
            'description' => $validated['description'],
            'image_path' => $nextImagePath,
        ]);

        return redirect()->route('brands.index')->with('success', 'Brand updated.');
    }

    public function destroy(Brand $brand)
    {
        $apiKey = config('services.bunny.api_key');

        foreach ($brand->sponsorVideos()->withoutGlobalScope('published')->get() as $video) {
            if (!$video->bunny_video_id) {
                continue;
            }

            if (!$apiKey) {
                return redirect()->route('brands.index')->with('error', 'Bunny API key missing. Cannot delete remote videos.');
            }

            $libraryCandidates = array_values(array_unique(array_filter([
                trim((string) $video->bunny_library_id),
                trim((string) config('services.bunny.library_id')),
            ])));

            if (empty($libraryCandidates)) {
                return redirect()->route('brands.index')->with('error', 'Bunny library id missing. Cannot delete remote videos.');
            }

            $deletedFromBunny = false;
            $attempts = [];

            foreach ($libraryCandidates as $libraryId) {
                $response = Http::withHeaders([
                    'AccessKey' => $apiKey,
                ])->delete("https://video.bunnycdn.com/library/{$libraryId}/videos/{$video->bunny_video_id}");

                $attempts[] = [
                    'library_id' => $libraryId,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ];

                if ($response->successful()) {
                    $deletedFromBunny = true;
                    break;
                }
            }

            if (!$deletedFromBunny) {
                Log::warning('Bunny delete failed for brand sponsor video', [
                    'brand_id' => $brand->id,
                    'video_id' => $video->bunny_video_id,
                    'attempts' => $attempts,
                ]);
                return redirect()->route('brands.index')->with('error', 'Failed to delete one or more Bunny videos. Brand was not deleted.');
            }
        }

        if ($brand->image_path) {
            Storage::disk($this->imageDisk())->delete($brand->image_path);
        }

        $brand->delete();

        return redirect()->route('brands.index')->with('success', 'Brand deleted.');
    }
}
