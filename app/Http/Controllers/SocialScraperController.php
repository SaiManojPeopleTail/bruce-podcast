<?php

namespace App\Http\Controllers;

use App\Models\SocialScrape;
use App\Models\SocialScrapePost;
use App\Services\GeminiSocialScraper;
use App\Services\ScraperAgentClient;
use App\Support\SocialScrapeUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SocialScraperController extends Controller
{
    /**
     * Render the dedicated Social Scraper admin page.
     */
    public function page(): InertiaResponse
    {
        return Inertia::render('SocialScraper/Index');
    }

    /**
     * Streams scraping events from Gemini back to the client as Server-Sent Events.
     * One HTTP request per scrape attempt; the worker is held open until the
     * stream finishes or the client disconnects.
     */
    public function scrape(Request $request, GeminiSocialScraper $scraper): StreamedResponse
    {
        $validated = $request->validate([
            'url' => ['required', 'string', 'max:2048', 'url'],
        ]);

        return response()->stream(function () use ($validated, $scraper) {
            @set_time_limit(0);
            @ini_set('output_buffering', '0');
            @ini_set('zlib.output_compression', '0');
            while (ob_get_level() > 0) {
                @ob_end_flush();
            }
            ignore_user_abort(false);

            $emit = function (string $event, array $data): void {
                if (connection_aborted()) {
                    return;
                }
                echo "event: {$event}\n";
                echo 'data: ' . json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n\n";
                // Pad so intermediate proxies flush early chunks (helps in dev / nginx).
                echo str_repeat(' ', 256) . "\n\n";
                @flush();
            };

            $emit('open', ['url' => $validated['url']]);

            try {
                $scraper->streamScrape($validated['url'], $emit);
                $emit('done', []);
            } catch (\Throwable $e) {
                report($e);
                $emit('error', ['message' => $e->getMessage()]);
            }
        }, 200, [
            'Content-Type'      => 'text/event-stream',
            'Cache-Control'     => 'no-cache, no-store, no-transform',
            'Connection'        => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * Start a single Agent session (parallel work uses multiple tabs in one browser).
     */
    public function agent(Request $request, ScraperAgentClient $client): JsonResponse
    {
        $validated = $request->validate([
            'url'           => ['required', 'string', 'max:2048', 'url'],
            'credentialsId' => ['nullable', 'integer'],
        ]);

        $credentialsSignedUrl = null;

        if (! empty($validated['credentialsId'])) {
            $credentialsSignedUrl = url()->temporarySignedRoute(
                'social-scrape.credentials',
                now()->addMinutes(5),
                ['credentialId' => (int) $validated['credentialsId']],
            );
        }

        $agentBaseUrl = rtrim(config('services.scraper_agent.url'), '/');

        try {
            $session = $client->startSession(
                $validated['url'],
                $credentialsSignedUrl,
                null,
                [
                    'maxPosts'          => max(1, (int) config('services.scraper_agent.max_posts', 8)),
                    'parallelThreshold' => max(1, (int) config('services.scraper_agent.parallel_threshold', 3)),
                    'postsPerWorker'    => max(1, (int) config('services.scraper_agent.posts_per_worker', 2)),
                    'maxParallelTabs'   => max(1, (int) config('services.scraper_agent.max_concurrent_sessions', 8)),
                ],
            );

            return response()->json([
                'sessionId'    => $session['sessionId'],
                'liveWsUrl'    => $session['liveWsUrl'],
                'eventsWsUrl'  => $session['eventsWsUrl'],
                'cancelToken'  => $this->mintCancelToken($session['sessionId']),
                'agentBaseUrl' => $agentBaseUrl,
            ]);
        } catch (\Throwable $e) {
            return response()->json(
                ['error' => 'Scraper agent unavailable: ' . $e->getMessage()],
                503,
            );
        }
    }

    /**
     * Cancel one or more running agent sessions.
     */
    public function cancelAgent(Request $request, ScraperAgentClient $client): JsonResponse
    {
        $validated = $request->validate([
            'cancelToken'  => ['nullable', 'string'],
            'cancelTokens' => ['nullable', 'array'],
            'cancelTokens.*' => ['string'],
        ]);

        $tokens = $validated['cancelTokens'] ?? [];
        if (! empty($validated['cancelToken'])) {
            $tokens[] = $validated['cancelToken'];
        }

        if ($tokens === []) {
            return response()->json(['error' => 'No cancel token provided'], 422);
        }

        foreach ($tokens as $token) {
            try {
                $payload = json_decode(Crypt::decryptString($token), true);
            } catch (\Throwable) {
                continue;
            }

            if (! isset($payload['exp']) || $payload['exp'] < now()->timestamp) {
                continue;
            }

            if (! empty($payload['sessionId'])) {
                $client->cancelSession($payload['sessionId']);
            }
        }

        return response()->json(['ok' => true]);
    }

    /**
     * One-shot signed endpoint the sidecar calls to retrieve plaintext credentials.
     */
    public function credentials(Request $request, int $credentialId): JsonResponse
    {
        if (! $request->hasValidSignature()) {
            abort(403);
        }

        $cred = \App\Models\SocialCredential::findOrFail($credentialId);

        return response()->json([
            'id'       => (string) $cred->id,
            'platform' => $cred->platform,
            'username' => $cred->username,
            'password' => $cred->password,
        ]);
    }

    /**
     * Load a previously saved scrape for a profile/source URL.
     */
    public function saved(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'url' => ['required', 'string', 'max:2048'],
        ]);

        $normalized = SocialScrapeUrl::normalize($validated['url']);
        $scrape     = SocialScrape::query()
            ->with('posts')
            ->where('source_url_hash', SocialScrapeUrl::hash($normalized))
            ->first();

        if (! $scrape) {
            return response()->json([
                'saved'    => false,
                'platform' => SocialScrapeUrl::detectPlatform($normalized),
            ]);
        }

        return response()->json([
            'saved'    => true,
            'scrape'   => $this->formatScrape($scrape),
            'posts'    => $scrape->posts->map(fn (SocialScrapePost $p) => $this->formatPost($p))->values(),
        ]);
    }

    /**
     * Persist scrape results (upsert by source URL).
     */
    public function save(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'url'   => ['required', 'string', 'max:2048'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'posts' => ['required', 'array'],
            'posts.*.type'        => ['nullable', 'string', 'max:16'],
            'posts.*.media_url'   => ['nullable', 'string', 'max:2048'],
            'posts.*.description' => ['nullable', 'string', 'max:65000'],
            'posts.*.post_url'    => ['nullable', 'string', 'max:2048'],
            'posts.*.posted_at'   => ['nullable', 'string', 'max:64'],
            'posts.*.is_active'   => ['nullable', 'boolean'],
        ]);

        $normalized = SocialScrapeUrl::normalize($validated['url']);
        $urlHash    = SocialScrapeUrl::hash($normalized);
        $platform   = SocialScrapeUrl::detectPlatform($normalized);

        $scrape = DB::transaction(function () use ($validated, $normalized, $urlHash, $platform, $request) {
            $scrape = SocialScrape::query()->updateOrCreate(
                ['source_url_hash' => $urlHash],
                [
                    'platform'   => $platform,
                    'source_url' => $normalized,
                    'notes'      => $validated['notes'] ?? null,
                    'saved_by'   => $request->user()?->id,
                ],
            );

            $keptHashes = [];

            foreach ($validated['posts'] as $index => $row) {
                $postUrl  = isset($row['post_url']) ? trim((string) $row['post_url']) : null;
                $postHash = SocialScrapeUrl::postHash($postUrl) ?? hash('sha256', "row-{$scrape->id}-{$index}");

                $keptHashes[] = $postHash;

                $scrape->posts()->updateOrCreate(
                    ['post_url_hash' => $postHash],
                    [
                        'type'        => in_array($row['type'] ?? 'image', ['image', 'video', 'text', 'mixed'], true)
                            ? $row['type']
                            : 'image',
                        'media_url'   => $row['media_url'] ?? null,
                        'description' => $row['description'] ?? '',
                        'post_url'    => $postUrl,
                        'posted_at'   => ! empty($row['posted_at']) ? $row['posted_at'] : null,
                        'is_active'   => array_key_exists('is_active', $row)
                            ? (bool) $row['is_active']
                            : true,
                        'sort_order'  => $index,
                    ],
                );
            }

            if ($keptHashes !== []) {
                $scrape->posts()->whereNotIn('post_url_hash', $keptHashes)->delete();
            } else {
                $scrape->posts()->delete();
            }

            return $scrape->fresh(['posts']);
        });

        return response()->json([
            'ok'     => true,
            'scrape' => $this->formatScrape($scrape),
            'posts'  => $scrape->posts->map(fn (SocialScrapePost $p) => $this->formatPost($p))->values(),
        ]);
    }

    /**
     * Toggle a saved post's active status.
     */
    public function togglePost(Request $request, SocialScrapePost $socialScrapePost): JsonResponse
    {
        $validated = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);

        $socialScrapePost->update(['is_active' => $validated['is_active']]);

        return response()->json([
            'ok'   => true,
            'post' => $this->formatPost($socialScrapePost->fresh()),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function formatScrape(SocialScrape $scrape): array
    {
        return [
            'id'          => $scrape->id,
            'platform'    => $scrape->platform,
            'source_url'  => $scrape->source_url,
            'notes'       => $scrape->notes,
            'saved_at'    => $scrape->updated_at?->toIso8601String(),
            'posts_count' => $scrape->posts->count(),
            'active_count' => $scrape->posts->where('is_active', true)->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function formatPost(SocialScrapePost $post): array
    {
        return [
            'id'          => $post->id,
            'type'        => $post->type,
            'media_url'   => $post->media_url,
            'description' => $post->description,
            'post_url'    => $post->post_url,
            'posted_at'   => $post->posted_at?->toIso8601String() ?? $post->posted_at,
            'is_active'   => $post->is_active,
        ];
    }

    private function mintCancelToken(string $sessionId): string
    {
        return Crypt::encryptString(json_encode([
            'sessionId' => $sessionId,
            'exp'       => now()->addHour()->timestamp,
        ]));
    }
}
