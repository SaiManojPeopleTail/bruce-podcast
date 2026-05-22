<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * HTTP client for the local Node scraper-agent sidecar.
 * Communicates with http://127.0.0.1:7501 (or SCRAPER_AGENT_URL).
 */
class ScraperAgentClient
{
    private string $base;
    private string $secret;

    public function __construct()
    {
        $this->base   = rtrim((string) config('services.scraper_agent.url', 'http://127.0.0.1:7501'), '/');
        $this->secret = (string) config('services.scraper_agent.secret', '');
    }

    /**
     * Start a new agent session (one browser; parallel = multiple tabs).
     *
     * @param  array{
     *   maxPosts?: int,
     *   parallelThreshold?: int,
     *   postsPerWorker?: int,
     *   maxParallelTabs?: int,
     * }  $options
     * @return array{ sessionId: string, liveWsUrl: string, eventsWsUrl: string }
     */
    public function startSession(
        string $url,
        ?string $credentialsSignedUrl = null,
        ?string $storageStatePushUrl = null,
        array $options = [],
    ): array {
        $payload = array_filter([
            'url'                  => $url,
            'credentialsSignedUrl' => $credentialsSignedUrl,
            'storageStatePushUrl'  => $storageStatePushUrl,
            'maxPosts'             => $options['maxPosts'] ?? null,
            'parallelThreshold'    => $options['parallelThreshold'] ?? null,
            'postsPerWorker'       => $options['postsPerWorker'] ?? null,
            'maxParallelTabs'      => $options['maxParallelTabs'] ?? null,
        ], fn ($v) => $v !== null);

        $response = $this->request()->post("{$this->base}/sessions", $payload);

        if (! $response->successful()) {
            throw new RuntimeException(
                "Scraper agent error {$response->status()}: {$response->body()}",
            );
        }

        return $response->json();
    }

    /**
     * Cancel a running session.
     */
    public function cancelSession(string $sessionId): void
    {
        $this->request()->post("{$this->base}/sessions/{$sessionId}/cancel");
    }

    /**
     * Fetch current session status.
     */
    public function sessionStatus(string $sessionId): array
    {
        $response = $this->request()->get("{$this->base}/sessions/{$sessionId}");
        if (! $response->successful()) {
            throw new RuntimeException("Session not found: {$sessionId}");
        }
        return $response->json();
    }

    private function request(): \Illuminate\Http\Client\PendingRequest
    {
        $req = Http::timeout(10);
        if ($this->secret !== '') {
            $req = $req->withHeaders(['X-Scraper-Secret' => $this->secret]);
        }
        return $req;
    }
}
