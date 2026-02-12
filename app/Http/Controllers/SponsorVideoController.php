<?php

namespace App\Http\Controllers;

use App\Models\Brand;
use App\Models\SponsorVideo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class SponsorVideoController extends Controller
{
    public function index(Request $request, Brand $brand)
    {
        $query = $brand->sponsorVideos()->withoutGlobalScope('published');

        if ($request->filled('search')) {
            $term = $request->search;
            $query->where(function ($q) use ($term) {
                $q->where('title', 'like', "%{$term}%")
                    ->orWhere('slug', 'like', "%{$term}%")
                    ->orWhere('short_description', 'like', "%{$term}%");
            });
        }

        return Inertia::render('SponsorVideos/Index', [
            'brand' => $brand,
            'videos' => $query->orderByDesc('created_at')->paginate(15)->withQueryString(),
            'filters' => $request->only('search'),
        ]);
    }

    public function create(Brand $brand)
    {
        return Inertia::render('SponsorVideos/Create', [
            'brand' => $brand,
        ]);
    }

    public function store(Request $request, Brand $brand)
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', 'unique:sponsor_videos,slug', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'short_description' => ['required', 'string'],
            'long_description' => ['nullable', 'string'],
            'bunny_video_id' => ['nullable', 'string', 'max:100'],
            'bunny_library_id' => ['nullable', 'string', 'max:50'],
            'status' => ['sometimes', 'boolean'],
            'created_at' => ['required', 'date'],
        ]);

        $validated['status'] = (bool) ($validated['status'] ?? false);
        $validated['brand_id'] = $brand->id;

        $video = SponsorVideo::create($validated);

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Sponsor video created.',
                'video' => $video,
            ], 201);
        }

        return redirect()->route('brands.videos.index', $brand)->with('success', 'Sponsor video created.');
    }

    public function edit(Brand $brand, SponsorVideo $video)
    {
        $this->ensureOwnership($brand, $video);

        return Inertia::render('SponsorVideos/Edit', [
            'brand' => $brand,
            'video' => $video,
        ]);
    }

    public function update(Request $request, Brand $brand, SponsorVideo $video)
    {
        $this->ensureOwnership($brand, $video);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', 'unique:sponsor_videos,slug,' . $video->id],
            'short_description' => ['required', 'string'],
            'long_description' => ['nullable', 'string'],
            'bunny_video_id' => ['sometimes', 'nullable', 'string', 'max:100'],
            'bunny_library_id' => ['sometimes', 'nullable', 'string', 'max:50'],
            'status' => ['sometimes', 'boolean'],
            'created_at' => ['required', 'date'],
        ]);

        if (!$request->has('bunny_video_id')) {
            unset($validated['bunny_video_id']);
        }

        if (!$request->has('bunny_library_id')) {
            unset($validated['bunny_library_id']);
        }

        $video->update($validated);

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Sponsor video updated.',
                'video' => $video->fresh(),
            ]);
        }

        return redirect()->route('brands.videos.index', $brand)->with('success', 'Sponsor video updated.');
    }

    public function destroy(Brand $brand, SponsorVideo $video)
    {
        $this->ensureOwnership($brand, $video);

        $apiKey = config('services.bunny.api_key');

        if ($video->bunny_video_id) {
            if (!$apiKey) {
                return redirect()->route('brands.videos.index', $brand)->with('error', 'Bunny API key missing. Cannot delete remote video.');
            }

            $libraryCandidates = array_values(array_unique(array_filter([
                trim((string) $video->bunny_library_id),
                trim((string) config('services.bunny.library_id')),
            ])));

            if (empty($libraryCandidates)) {
                return redirect()->route('brands.videos.index', $brand)->with('error', 'Bunny library id missing. Cannot delete remote video.');
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
                Log::warning('Bunny delete failed for sponsor video', [
                    'brand_id' => $brand->id,
                    'video_id' => $video->bunny_video_id,
                    'attempts' => $attempts,
                ]);
                return redirect()->route('brands.videos.index', $brand)->with('error', 'Failed to delete video from Bunny. Local record was not deleted.');
            }
        }

        $video->delete();

        return redirect()->route('brands.videos.index', $brand)->with('success', 'Sponsor video deleted.');
    }

    public function toggleStatus(Brand $brand, SponsorVideo $video)
    {
        $this->ensureOwnership($brand, $video);

        $video->update([
            'status' => !$video->status,
        ]);

        return redirect()->route('brands.videos.index', $brand)->with('success', 'Sponsor video status updated.');
    }

    public function bunnyUploadInit(Request $request, Brand $brand)
    {
        $request->validate([
            'title' => ['required', 'string', 'max:255'],
        ]);

        $apiKey = config('services.bunny.api_key');
        $libraryId = config('services.bunny.library_id');

        if (!$apiKey || !$libraryId) {
            return response()->json([
                'error' => 'Bunny configuration missing. Set BUNNY_API_KEY and BUNNY_LIBRARY_ID.',
            ], 422);
        }

        $response = Http::withHeaders([
            'AccessKey' => $apiKey,
            'Content-Type' => 'application/json',
        ])->post("https://video.bunnycdn.com/library/{$libraryId}/videos", [
            'title' => $request->title,
        ]);

        if (!$response->successful()) {
            Log::warning('Bunny init failed for sponsor video', [
                'brand_id' => $brand->id,
                'library_id' => $libraryId,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            return response()->json([
                'error' => 'Failed to create Bunny video.',
                'bunny_status' => $response->status(),
                'bunny_response' => $response->json() ?: $response->body(),
            ], 502);
        }

        $videoId = $response->json('guid') ?? $response->json('videoId') ?? $response->json('id');

        if (!$videoId) {
            return response()->json(['error' => 'Bunny did not return a video id.'], 502);
        }

        $expires = now()->addHours(6)->timestamp;
        $signature = hash('sha256', $libraryId . $apiKey . $expires . $videoId);

        return response()->json([
            'video_id' => $videoId,
            'library_id' => (string) $libraryId,
            'expires' => $expires,
            'signature' => $signature,
            'upload_endpoint' => 'https://video.bunnycdn.com/tusupload',
        ]);
    }

    public function bunnyVideoStatus(Request $request, Brand $brand)
    {
        $validated = $request->validate([
            'video_id' => ['required', 'string'],
            'library_id' => ['required', 'string'],
        ]);

        $apiKey = config('services.bunny.api_key');
        $libraryId = config('services.bunny.library_id');

        if (!$apiKey || !$libraryId) {
            return response()->json([
                'error' => 'Bunny configuration missing. Set BUNNY_API_KEY and BUNNY_LIBRARY_ID.',
            ], 422);
        }

        if ((string) $libraryId !== (string) $validated['library_id']) {
            return response()->json(['error' => 'Library mismatch.'], 422);
        }

        $response = Http::withHeaders([
            'AccessKey' => $apiKey,
        ])->get("https://video.bunnycdn.com/library/{$libraryId}/videos/{$validated['video_id']}");

        if (!$response->successful()) {
            return response()->json([
                'error' => 'Unable to read Bunny video status.',
                'bunny_status' => $response->status(),
                'bunny_response' => $response->json() ?: $response->body(),
            ], 502);
        }

        $bunnyVideo = $response->json();
        $status = (int) ($bunnyVideo['status'] ?? 0);
        $encodeProgress = (int) ($bunnyVideo['encodeProgress'] ?? 0);

        $state = 'processing';
        if ($status === 4 || $encodeProgress >= 100) {
            $state = 'ready';
        } elseif ($status === 5) {
            $state = 'failed';
        } elseif ($status <= 1) {
            $state = 'queued';
        }

        return response()->json([
            'state' => $state,
            'status' => $status,
            'encode_progress' => $encodeProgress,
            'video' => $bunnyVideo,
        ]);
    }

    public function bunnyUploadFinalize(Request $request, Brand $brand)
    {
        $validated = $request->validate([
            'video_id' => ['required', 'string'],
            'library_id' => ['required', 'string'],
        ]);

        $apiKey = config('services.bunny.api_key');
        $libraryId = config('services.bunny.library_id');

        if (!$apiKey || !$libraryId) {
            return response()->json([
                'error' => 'Bunny configuration missing. Set BUNNY_API_KEY and BUNNY_LIBRARY_ID.',
            ], 422);
        }

        if ((string) $libraryId !== (string) $validated['library_id']) {
            return response()->json(['error' => 'Library mismatch.'], 422);
        }

        $response = Http::withHeaders([
            'AccessKey' => $apiKey,
        ])->get("https://video.bunnycdn.com/library/{$libraryId}/videos/{$validated['video_id']}");

        if (!$response->successful()) {
            Log::warning('Bunny finalize failed for sponsor video', [
                'brand_id' => $brand->id,
                'library_id' => $libraryId,
                'video_id' => $validated['video_id'],
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            return response()->json([
                'error' => 'Unable to verify Bunny upload.',
                'bunny_status' => $response->status(),
                'bunny_response' => $response->json() ?: $response->body(),
            ], 502);
        }

        return response()->json([
            'video_id' => $validated['video_id'],
            'library_id' => (string) $libraryId,
            'embed_url' => "https://iframe.mediadelivery.net/embed/{$libraryId}/{$validated['video_id']}",
        ]);
    }

    public function bunnyThumbnailUpload(Request $request, Brand $brand)
    {
        $validated = $request->validate([
            'video_id' => ['required', 'string'],
            'library_id' => ['required', 'string'],
            'thumbnail' => ['required', 'image', 'max:8192'],
        ]);

        $apiKey = config('services.bunny.api_key');
        $libraryId = config('services.bunny.library_id');
        $pullZone = config('services.bunny.pull_zone');

        if (!$apiKey || !$libraryId) {
            return response()->json([
                'error' => 'Bunny configuration missing. Set BUNNY_API_KEY and BUNNY_LIBRARY_ID.',
            ], 422);
        }

        if ((string) $libraryId !== (string) $validated['library_id']) {
            return response()->json(['error' => 'Library mismatch.'], 422);
        }

        $thumbFile = $request->file('thumbnail');
        $thumbContent = file_get_contents($thumbFile->getRealPath());

        $setResponse = Http::withHeaders([
            'AccessKey' => $apiKey,
            'Content-Type' => 'application/octet-stream',
        ])->withBody($thumbContent, 'application/octet-stream')
            ->post("https://video.bunnycdn.com/library/{$libraryId}/videos/{$validated['video_id']}/thumbnail");

        if (!$setResponse->successful()) {
            Log::warning('Bunny thumbnail set failed for sponsor video', [
                'brand_id' => $brand->id,
                'library_id' => $libraryId,
                'video_id' => $validated['video_id'],
                'status' => $setResponse->status(),
                'body' => $setResponse->body(),
            ]);
            return response()->json([
                'error' => 'Failed to set Bunny thumbnail.',
                'bunny_status' => $setResponse->status(),
                'bunny_response' => $setResponse->json() ?: $setResponse->body(),
            ], 502);
        }

        $getResponse = Http::withHeaders([
            'AccessKey' => $apiKey,
        ])->get("https://video.bunnycdn.com/library/{$libraryId}/videos/{$validated['video_id']}");

        if (!$getResponse->successful()) {
            Log::warning('Bunny thumbnail fetch failed for sponsor video', [
                'brand_id' => $brand->id,
                'library_id' => $libraryId,
                'video_id' => $validated['video_id'],
                'status' => $getResponse->status(),
                'body' => $getResponse->body(),
            ]);
            return response()->json([
                'error' => 'Unable to fetch Bunny thumbnail info.',
                'bunny_status' => $getResponse->status(),
                'bunny_response' => $getResponse->json() ?: $getResponse->body(),
            ], 502);
        }

        $thumbFileName = $getResponse->json('thumbnailFileName');
        $thumbUrl = null;

        if ($pullZone && $thumbFileName) {
            $cdnHost = trim((string) $pullZone);
            $cdnHost = preg_replace('#^https?://#', '', $cdnHost);
            $cdnHost = trim($cdnHost, '/');
            if (!str_contains($cdnHost, '.')) {
                $cdnHost .= '.b-cdn.net';
            }
            $thumbUrl = "https://{$cdnHost}/{$validated['video_id']}/{$thumbFileName}";
        }

        return response()->json([
            'thumbnail_file_name' => $thumbFileName,
            'thumbnail_url' => $thumbUrl,
        ]);
    }

    protected function ensureOwnership(Brand $brand, SponsorVideo $video): void
    {
        abort_unless($video->brand_id === $brand->id, 404);
    }
}
