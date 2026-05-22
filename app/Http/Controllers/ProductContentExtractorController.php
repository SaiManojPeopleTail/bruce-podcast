<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProductContentExtractorController extends Controller
{
    private const INSTRUCTIONS = <<<'TEXT'
# Agent Instructions: Company + Product + Social Extraction -> Strict JSON Output

## Objective

Extract structured information about:
1. The company behind the provided URL
2. The product shown in the URL
3. The company's top social posts only from Instagram and LinkedIn

Return JSON only.

## Input

company_url: <required>
instagram_url: <optional>
linkedin_url: <optional>
instagram_profile_posts_json: <optional, trusted tool result from SocialApis Instagram profile posts API>

## Required Output Schema

{
  "name": {
    "product_name": "",
    "company_name": ""
  },
  "about_company": "",
  "about_product": "",
  "product_description": "",
  "social_links": [
    {
      "platform": "",
      "post_url": "",
      "description": ""
    }
  ],
  "notes": ""
}

## Extraction Rules

### 1) name

Extract exact names — do not invent or generalise.

product_name:
* The specific product name as shown on the product page (e.g. "Omega-3 Fish Oil 1000mg")
* If unavailable, use an empty string

company_name:
* The brand or company name only (e.g. "NutriCo")
* No descriptors, no taglines
* If unavailable, use an empty string

### 2) about_company (knowledge-base copy — long, unformatted)

Generate:
* Comprehensive, unformatted plain text — no markdown
* 150-300 words
* Cover: founding, mission, product categories, target audience, distribution/retail presence, any notable achievements or certifications visible on official sources

Allowed sources:
* official company website (About, Our Story pages)
* official Instagram bio + posts
* official LinkedIn

Restrictions:
* Never infer or embellish
* Never use third-party websites or review sites
* Omit unsupported claims

Fallback:
about_company = "Unable to determine from official sources."

### 3) about_product (knowledge-base copy — long, unformatted)

Generate:
* Comprehensive, unformatted plain text — no markdown
* 300-500 words
* Include ALL of: product category, intended use, full ingredients/components list, dosage, delivery format, mechanisms/features, certifications, packaging details, directions for use — whatever is available from official sources

Exclude:
* pricing, reviews, testimonials, comparisons, unsupported medical claims, opinions

Rules:
* Summarize only official content
* Rewrite in neutral language

Fallback:
about_product = "Product details unavailable from official sources."

### 4) product_description (formatted page copy — concise)

Generate:
* This is the FORMATTED description that will appear on the product's public page
* 100-180 words maximum
* Engaging, benefit-focused prose — rewrite from official language
* Use plain paragraph text, no headings, no bullet lists, no markdown
* Convey: what the product is, who it is for, key benefits or features

Fallback:
product_description = ""

### 5) social_links

Platforms allowed: Instagram, LinkedIn

Collection priority:
1. pinned posts
2. highest visible engagement
3. newest posts

Requirements:
* Maximum 10 posts total
* Company-owned posts only — no employee content, no reposts

Each object:
{
  "platform": "instagram|linkedin",
  "post_url": "full url",
  "description": "max 30 words"
}

Rules:
* Include only accessible posts
* Skip inaccessible posts
* Never generate URLs
* Never output empty objects
* For Instagram, use instagram_profile_posts_json when provided — treat it as the official tool result
* For Instagram posts, include only exact post_url values from instagram_profile_posts_json unless unavailable

If unavailable: "social_links": []

## Validation Rules (Anti-Hallucination)

Every statement must originate from an official source. If confidence < 95%, omit.

Never infer: ingredients, founders, certifications, popularity, engagement metrics, hidden content.
Never fabricate: social post text, descriptions, URLs, unavailable data.
If uncertain, omit instead of guess.

## Notes Field

Populate only with: inaccessible pages, blocked content, unavailable product details, missing social accounts, extraction limitations.

## Output Constraints

* Valid JSON only
* No markdown outside JSON
* No explanations, no citations, no extra keys
* UTF-8 safe

## Token Optimization

Read only: homepage, about page, target product page, visible social posts.
Stop when 10 valid posts collected.
Avoid duplicate page reads. Summarize aggressively. Do not revisit parsed pages.

Final principle: Absence of evidence is not permission to invent.
TEXT;

    public function extract(Request $request): StreamedResponse
    {
        $validated = $request->validate([
            'company_url'      => ['required', 'string', 'max:2048', 'url'],
            'instagram_handle' => ['nullable', 'string', 'max:100'],
            'linkedin_handle'  => ['nullable', 'string', 'max:100'],
        ]);

        return response()->stream(function () use ($validated) {
            @set_time_limit(0);
            @ini_set('output_buffering', '0');
            @ini_set('zlib.output_compression', '0');
            while (ob_get_level() > 0) {
                @ob_end_flush();
            }

            $emit = function (string $event, array $data): void {
                echo "event: {$event}\n";
                echo 'data: '.json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)."\n\n";
                echo str_repeat(' ', 256)."\n\n";
                @flush();
            };

            $apiKey = config('services.openai.api_key');
            if (! $apiKey) {
                $emit('error', ['message' => 'OPENAI_API_KEY is not configured.']);

                return;
            }

            // Clean handles — strip leading @ and whitespace
            $instagramHandle = ltrim(trim((string) ($validated['instagram_handle'] ?? '')), '@');
            $linkedinHandle  = ltrim(trim((string) ($validated['linkedin_handle'] ?? '')), '@');

            $instagramUrl = $instagramHandle !== '' ? "https://www.instagram.com/{$instagramHandle}/" : '';
            $linkedinUrl  = $linkedinHandle !== ''  ? "https://www.linkedin.com/company/{$linkedinHandle}/" : '';

            $emit('thought', ['text' => 'Reading the product URL and limiting sources to official pages.']);

            $instagramPosts = [];
            if ($instagramHandle !== '') {
                $emit('thought', ['text' => "SocialApis: fetching Instagram posts for @{$instagramHandle}..."]);
                $instagramPosts = $this->fetchInstagramPosts($instagramHandle, $emit);
                $emit('thought', ['text' => count($instagramPosts) > 0
                    ? 'SocialApis: returned '.count($instagramPosts).' post(s) for @'.$instagramHandle.'.'
                    : 'SocialApis: no posts returned for @'.$instagramHandle.'.']);
            } else {
                $emit('thought', ['text' => 'No Instagram handle provided — SocialApis step skipped.']);
            }

            // Build a lookup: post_url → image_url so we can re-attach after GPT responds
            $imageUrlMap = [];
            foreach ($instagramPosts as $p) {
                if (! empty($p['post_url']) && ! empty($p['image_url'])) {
                    $imageUrlMap[$p['post_url']] = $p['image_url'];
                }
            }

            $input = "company_url: {$validated['company_url']}\n"
                .'instagram_url: '.$instagramUrl."\n"
                .'linkedin_url: '.$linkedinUrl."\n"
                .'instagram_profile_posts_json: '.json_encode($instagramPosts, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)."\n";

            try {
                $emit('thought', ['text' => 'Calling GPT with web_search + streaming enabled, reasoning effort: medium.']);

                $streamResponse = Http::withToken($apiKey)
                    ->withOptions([
                        'stream' => true,
                        'read_timeout' => 180,
                    ])
                    ->withHeaders(['Accept' => 'text/event-stream'])
                    ->asJson()
                    ->timeout(180)
                    ->post('https://api.openai.com/v1/responses', [
                        'model' => config('services.openai.model', 'gpt-5-mini'),
                        'instructions' => self::INSTRUCTIONS,
                        'input' => $input,
                        'stream' => true,
                        'reasoning' => [
                            'effort' => 'medium',
                        ],
                        'tools' => [
                            ['type' => config('services.openai.web_search_tool', 'web_search')],
                        ],
                        'text' => [
                            'format' => [
                                'type' => 'json_schema',
                                'name' => 'product_content_extraction',
                                'strict' => true,
                                'schema' => $this->schema(),
                            ],
                        ],
                    ]);

                if ($streamResponse->status() >= 400) {
                    $emit('error', [
                        'message' => 'OpenAI extraction failed.',
                        'detail'  => (string) $streamResponse->body(),
                    ]);

                    return;
                }

                $body        = $streamResponse->toPsrResponse()->getBody();
                $lineBuffer  = '';
                $outputText  = '';
                $currentEventType = '';

                while (! $body->eof()) {
                    $chunk = $body->read(512);
                    if ($chunk === '' || $chunk === false) {
                        continue;
                    }

                    $lineBuffer .= $chunk;

                    while (($newline = strpos($lineBuffer, "\n")) !== false) {
                        $line       = substr($lineBuffer, 0, $newline);
                        $lineBuffer = substr($lineBuffer, $newline + 1);
                        $line       = rtrim($line, "\r");

                        if ($line === '') {
                            $currentEventType = '';
                            continue;
                        }

                        if (str_starts_with($line, 'event: ')) {
                            $currentEventType = trim(substr($line, 7));
                            continue;
                        }

                        if (! str_starts_with($line, 'data: ')) {
                            continue;
                        }

                        $raw = substr($line, 6);
                        if ($raw === '[DONE]') {
                            break 2;
                        }

                        $data = json_decode($raw, true);
                        if (! is_array($data)) {
                            continue;
                        }

                        $this->handleStreamEvent($currentEventType, $data, $emit, $outputText);
                    }
                }

                $emit('thought', ['text' => 'Stream complete — validating structured JSON.']);

                $parsed = json_decode($outputText, true);

                if (! is_array($parsed)) {
                    $emit('error', ['message' => 'The model response was not valid JSON.']);

                    return;
                }

                $emit('result', ['result' => $this->normalizeResult($parsed, $imageUrlMap)]);
                $emit('done', []);
            } catch (\Throwable $e) {
                report($e);
                $emit('error', ['message' => $e->getMessage()]);
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-store, no-transform',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * @return array<string, string>
     */
    /**
     * Route a single OpenAI streaming event to a frontend SSE thought or status.
     *
     * @param  array<string, mixed>  $data
     * @param  callable(string, array<string,mixed>): void  $emit
     */
    private function handleStreamEvent(
        string $eventType,
        array $data,
        callable $emit,
        string &$outputText,
    ): void {
        switch ($eventType) {

            // --- Reasoning summary deltas ---
            case 'response.reasoning_summary_text.delta':
                $delta = $data['delta'] ?? '';
                if (is_string($delta) && $delta !== '') {
                    $emit('thought', ['text' => $delta]);
                }
                break;

            // --- Output text deltas (accumulate into JSON) ---
            case 'response.output_text.delta':
                $delta = $data['delta'] ?? '';
                if (is_string($delta)) {
                    $outputText .= $delta;
                }
                break;

            // --- Web search events ---
            case 'response.web_search_call.in_progress':
                $emit('thought', ['text' => 'GPT is deciding whether to search...']);
                break;

            case 'response.web_search_call.searching':
                $query = $data['query'] ?? ($data['action']['query'] ?? null);
                if (is_string($query) && $query !== '') {
                    $emit('thought', ['text' => "Searching: {$query}"]);
                } else {
                    $emit('thought', ['text' => 'Web search in progress...']);
                }
                break;

            case 'response.web_search_call.completed':
                $emit('thought', ['text' => 'Web search completed.']);
                break;

            // --- High-level response lifecycle ---
            case 'response.in_progress':
                $emit('thought', ['text' => 'GPT started generating...']);
                break;

            case 'response.output_item.added':
                $itemType = $data['item']['type'] ?? null;
                if ($itemType === 'reasoning') {
                    $emit('thought', ['text' => 'Reasoning...']);
                } elseif ($itemType === 'web_search_call') {
                    $emit('thought', ['text' => 'Invoking web search tool...']);
                } elseif ($itemType === 'message') {
                    $emit('thought', ['text' => 'Composing structured output...']);
                }
                break;

            case 'response.completed':
                // We handle final text from accumulated outputText after the loop
                break;
        }
    }

    private function parseSocialLinks(string $raw): array
    {
        $out = [];
        foreach (preg_split('/[\r\n,]+/', $raw) ?: [] as $line) {
            $url = trim($line);
            if ($url === '') {
                continue;
            }
            $host = parse_url($url, PHP_URL_HOST) ?: '';
            if (str_contains($host, 'instagram.com')) {
                $out['instagram'] = $url;
            }
            if (str_contains($host, 'linkedin.com')) {
                $out['linkedin'] = $url;
            }
        }

        return $out;
    }

    private function instagramUsername(string $url): ?string
    {
        $path = trim((string) parse_url($url, PHP_URL_PATH), '/');
        if ($path === '') {
            return null;
        }

        $username = explode('/', $path)[0] ?? '';
        $username = trim($username);

        if ($username === '' || in_array($username, ['p', 'reel', 'reels', 'stories', 'explore'], true)) {
            return null;
        }

        return ltrim($username, '@');
    }

    /**
     * @param  callable(string, array<string,mixed>): void  $emit
     * @return list<array{platform: string, post_url: string, description: string}>
     */
    private function fetchInstagramPosts(string $username, callable $emit): array
    {
        $rawToken = config('services.socialapis.api_token');
        $token = is_string($rawToken) ? trim($rawToken, " \t\n\r\0\x0B\"'") : '';

        if ($token === '') {
            $emit('thought', ['text' => 'SocialApis: SOCIALAPIS_API_TOKEN is not set — skipping.']);

            return [];
        }

        try {
            $response = Http::withHeaders(['x-api-token' => $token])
                ->acceptJson()
                ->timeout(45)
                ->get('https://api.socialapis.io/instagram/profile/posts', [
                    'username' => $username,
                ]);

            if (! $response->successful()) {
                $emit('thought', ['text' => 'SocialApis error HTTP '.$response->status().': '.$response->body()]);

                return [];
            }

            $body  = $response->json();
            $items = $this->socialApiItems($body);

            if (empty($items)) {
                // Surface the raw response shape so we can debug unexpected formats
                $preview = json_encode(array_keys(is_array($body) ? $body : []), JSON_UNESCAPED_SLASHES);
                $emit('thought', ['text' => "SocialApis: response parsed but no items found. Top-level keys: {$preview}"]);

                return [];
            }

            $posts = [];

            foreach ($items as $item) {
                if (! is_array($item)) {
                    continue;
                }

                $url = $this->instagramPostUrl($item);
                if ($url === null) {
                    continue;
                }

                $description = $this->instagramDescription($item);
                $imageUrl    = $this->instagramImageUrl($item);
                $posts[] = [
                    'platform'    => 'instagram',
                    'post_url'    => $url,
                    'description' => $this->limitWords($description, 30),
                    'image_url'   => $imageUrl,
                ];

                if (count($posts) >= 10) {
                    break;
                }
            }

            return $posts;
        } catch (\Throwable $e) {
            report($e);
            $emit('thought', ['text' => 'SocialApis exception: '.$e->getMessage()]);

            return [];
        }
    }

    /**
     * @param  mixed  $body
     * @return list<mixed>
     */
    private function socialApiItems(mixed $body): array
    {
        if (! is_array($body)) {
            return [];
        }

        // SocialApis returns {"success":true,"data":{"posts":[...]}}
        // — drill through one extra nesting level if needed
        foreach (['posts', 'data', 'items', 'results'] as $key) {
            if (! isset($body[$key]) || ! is_array($body[$key])) {
                continue;
            }

            $candidate = $body[$key];

            // Flat list of items — use directly
            if (array_is_list($candidate)) {
                return $candidate;
            }

            // One more level: e.g. data => { posts => [...] }
            foreach (['posts', 'data', 'items', 'results'] as $inner) {
                if (isset($candidate[$inner]) && is_array($candidate[$inner]) && array_is_list($candidate[$inner])) {
                    return $candidate[$inner];
                }
            }
        }

        if (array_is_list($body)) {
            return $body;
        }

        return [];
    }

    /**
     * @param  array<string, mixed>  $item
     */
    private function instagramPostUrl(array $item): ?string
    {
        foreach (['post_url', 'url', 'permalink', 'link'] as $key) {
            if (! empty($item[$key]) && is_string($item[$key]) && str_contains($item[$key], 'instagram.com')) {
                return $item[$key];
            }
        }

        foreach (['shortcode', 'code'] as $key) {
            if (! empty($item[$key]) && is_string($item[$key])) {
                return 'https://www.instagram.com/p/'.trim($item[$key], '/').'/';
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $item
     */
    private function instagramDescription(array $item): string
    {
        // Flat string fields (caption is a plain string on most SocialApis posts)
        foreach (['caption', 'description', 'text', 'title', 'accessibility_caption'] as $key) {
            if (! empty($item[$key]) && is_string($item[$key])) {
                return trim($item[$key]);
            }
        }

        // Some API versions return caption as an object: { "text": "..." }
        $captionField = $item['caption'] ?? null;
        if (is_array($captionField) && ! empty($captionField['text']) && is_string($captionField['text'])) {
            return trim($captionField['text']);
        }

        // Older Instagram graph format
        $edgeCaption = $item['edge_media_to_caption']['edges'][0]['node']['text'] ?? null;
        if (is_string($edgeCaption) && $edgeCaption !== '') {
            return trim($edgeCaption);
        }

        return '';
    }

    /**
     * @param  array<string, mixed>  $item
     */
    private function instagramImageUrl(array $item): ?string
    {
        // Prefer thumbnail_src (smaller, ~640px), fall back to display_url (full)
        foreach (['thumbnail_src', 'display_url'] as $key) {
            if (! empty($item[$key]) && is_string($item[$key])) {
                return $item[$key];
            }
        }

        // display_resources: pick smallest available
        if (! empty($item['display_resources']) && is_array($item['display_resources'])) {
            $first = reset($item['display_resources']);
            if (is_array($first) && ! empty($first['src']) && is_string($first['src'])) {
                return $first['src'];
            }
        }

        return null;
    }

    private function limitWords(string $text, int $maxWords): string
    {
        $words = preg_split('/\s+/', trim($text)) ?: [];
        $words = array_values(array_filter($words, fn ($word) => $word !== ''));

        if (count($words) <= $maxWords) {
            return trim($text);
        }

        return implode(' ', array_slice($words, 0, $maxWords));
    }

    /**
     * @param  array<string, mixed>  $body
     */
    private function extractOutputText(array $body): string
    {
        if (isset($body['output_text']) && is_string($body['output_text'])) {
            return $body['output_text'];
        }

        foreach (($body['output'] ?? []) as $item) {
            foreach (($item['content'] ?? []) as $content) {
                if (isset($content['text']) && is_string($content['text'])) {
                    return $content['text'];
                }
            }
        }

        return '';
    }

    /**
     * @param  array<string, mixed>  $raw
     * @return array<string, mixed>
     */
    /**
     * @param  array<string, string>  $imageUrlMap  post_url → image_url lookup from SocialApis
     */
    private function normalizeResult(array $raw, array $imageUrlMap = []): array
    {
        $posts = [];
        foreach (($raw['social_links'] ?? []) as $post) {
            if (! is_array($post)) {
                continue;
            }
            $platform = strtolower((string) ($post['platform'] ?? ''));
            $url = trim((string) ($post['post_url'] ?? ''));
            if (! in_array($platform, ['instagram', 'linkedin'], true) || $url === '') {
                continue;
            }
            $posts[] = [
                'platform'    => $platform,
                'post_url'    => $url,
                'description' => trim((string) ($post['description'] ?? '')),
                'image_url'   => $imageUrlMap[$url] ?? null,
            ];
            if (count($posts) >= 10) {
                break;
            }
        }

        $nameRaw = is_array($raw['name'] ?? null) ? $raw['name'] : [];

        return [
            'name' => [
                'product_name' => (string) ($nameRaw['product_name'] ?? ''),
                'company_name'  => (string) ($nameRaw['company_name'] ?? ''),
            ],
            'about_company'       => (string) ($raw['about_company'] ?? ''),
            'about_product'       => (string) ($raw['about_product'] ?? ''),
            'product_description' => (string) ($raw['product_description'] ?? ''),
            'social_links'        => $posts,
            'notes'               => (string) ($raw['notes'] ?? ''),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function schema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'name' => [
                    'type' => 'object',
                    'properties' => [
                        'product_name' => ['type' => 'string'],
                        'company_name'  => ['type' => 'string'],
                    ],
                    'required' => ['product_name', 'company_name'],
                    'additionalProperties' => false,
                ],
                'about_company'       => ['type' => 'string'],
                'about_product'       => ['type' => 'string'],
                'product_description' => ['type' => 'string'],
                'social_links' => [
                    'type' => 'array',
                    'maxItems' => 10,
                    'items' => [
                        'type' => 'object',
                        'properties' => [
                            'platform'    => ['type' => 'string', 'enum' => ['instagram', 'linkedin']],
                            'post_url'    => ['type' => 'string'],
                            'description' => ['type' => 'string'],
                        ],
                        'required'             => ['platform', 'post_url', 'description'],
                        'additionalProperties' => false,
                    ],
                ],
                'notes' => ['type' => 'string'],
            ],
            'required'             => ['name', 'about_company', 'about_product', 'product_description', 'social_links', 'notes'],
            'additionalProperties' => false,
        ];
    }
}
