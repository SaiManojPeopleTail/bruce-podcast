<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProductContentExtractorController extends Controller
{
    private const INSTRUCTIONS = <<<'TEXT'
# Agent Instructions: Company + Social Extraction -> Strict JSON Output

## Objective

Extract structured information about the COMPANY behind the provided URL.
Focus on the company as a whole — do NOT focus on any single product page even if the URL is a product page.
Also extract the company's top social posts from Instagram and LinkedIn.

Return JSON only.

## Input

company_url: <required>
instagram_url: <optional>
linkedin_url: <optional>
instagram_profile_posts_json: <optional, trusted tool result from SocialApis Instagram profile posts API>
shopify_products_json: <optional, plain-text summary of all products from the company's Shopify store — use as PRIMARY source for product details in the `about` knowledge base field>

## Required Output Schema

{
  "name": {
    "company_name": ""
  },
  "description": "",
  "about": "",
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

company_name:
* Copy the brand or company name EXACTLY as it appears on the official website — preserve original capitalisation, spacing, and punctuation (e.g. "EarthSuds", "Ginger Bug", "La Roche-Posay", "dr. bronner's")
* Do NOT lowercase, slug-ify, or normalise the name in any way
* No descriptors, no taglines — the brand name only
* If unavailable, use an empty string

### 2) description (rich HTML page copy — engaging, company-level)

Generate:
* HTML-formatted text using only: <p>, <strong>, <ul>, <li> tags
* 100-180 words maximum
* Engaging, benefit-focused, mission-driven — rewrite from official language
* About the COMPANY and its range of products/services — NOT about a single product
* Use <strong> for key brand terms and benefits, <ul><li> for key product lines or features, <p> for paragraphs
* No markdown, no headings, no <h1>-<h6>, no <a>, no inline styles
* Convey: what the company does, who it is for, what makes it unique

Fallback:
description = ""

### 3) about (knowledge-base copy — comprehensive, plain text)

Generate:
* Plain unformatted text — no HTML tags, no markdown
* 400-600 words total
* Structure:
  - Company overview: founding story, mission, values, certifications, target audience, distribution
  - Products & range: cover ALL product categories/lines the company sells — name each product line, key ingredients or features, intended use, formats available

Allowed sources:
* official company website (Homepage, About, Our Story, Products pages)
* official Instagram bio + posts
* official LinkedIn

Restrictions:
* Never infer or embellish
* Never use third-party websites or review sites
* Omit unsupported claims
* No pricing, no reviews, no testimonials

If `shopify_products_json` is provided:
* Use it as the PRIMARY source for ALL product information in the `about` field
* List every product by name with: key ingredients/materials, intended use, variants/formats available
* This data is authoritative — prefer it over web search results for product details
* Do NOT copy raw JSON — convert to readable plain prose

Fallback:
about = "Unable to determine from official sources."

### 4) social_links

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
                echo 'data: '.json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE)."\n\n";
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

            // Try to fetch Shopify products.json for richer KB generation
            $emit('thought', ['text' => 'Checking for Shopify product catalogue to enrich knowledge base…']);
            $shopifyText = $this->fetchShopifyProductsText($validated['company_url']);
            if ($shopifyText !== '') {
                $emit('thought', ['text' => 'Shopify products.json found — attaching product catalogue to extraction context.']);
            } else {
                $emit('thought', ['text' => 'No Shopify products.json found — relying on web search for product details.']);
            }

            $input = "company_url: {$validated['company_url']}\n"
                .'instagram_url: '.$instagramUrl."\n"
                .'linkedin_url: '.$linkedinUrl."\n"
                .'instagram_profile_posts_json: '.json_encode($instagramPosts, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE)."\n"
                .($shopifyText !== '' ? "\nshopify_products_json:\n{$shopifyText}\n" : '');

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
     * Fetch Shopify products.json and return a condensed plain-text summary
     * suitable for injection into the GPT prompt as knowledge-base material.
     * Returns an empty string if the site is not Shopify or the request fails.
     */
    private function fetchShopifyProductsText(string $companyUrl): string
    {
        // Strip invalid UTF-8 bytes so json_encode never chokes on Shopify content
        $utf8 = static function (mixed $v): string {
            $s = is_string($v) ? $v : (string) $v;
            // iconv with //IGNORE drops bytes that cannot be represented in UTF-8
            $clean = @iconv('UTF-8', 'UTF-8//IGNORE', $s);
            return $clean !== false ? $clean : preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s) ?? $s;
        };

        try {
            $parsed = parse_url($companyUrl);
            if (empty($parsed['host'])) return '';
            $scheme = $parsed['scheme'] ?? 'https';
            $domain = "{$scheme}://{$parsed['host']}";

            $res = Http::timeout(10)->get("{$domain}/products.json?limit=250");
            if (! $res->successful()) return '';

            $data = $res->json();
            if (! is_array($data['products'] ?? null) || empty($data['products'])) return '';

            $lines = [];
            foreach ($data['products'] as $product) {
                $name     = $utf8($product['title'] ?? '');
                $vendor   = $utf8($product['vendor'] ?? '');
                $title    = $utf8($product['product_type'] ?? '');
                $body     = $utf8(trim(strip_tags($product['body_html'] ?? '')));
                // Condense body to first 300 chars (byte-safe)
                if (mb_strlen($body) > 300) $body = mb_substr($body, 0, 300) . '…';
                $tags     = implode(', ', array_map($utf8, $product['tags'] ?? []));
                $variants = collect($product['variants'] ?? [])
                    ->map(fn($v) => $utf8(trim($v['title'] ?? '')))
                    ->filter()->unique()->implode(' | ');

                $line = "Product: {$name}";
                if ($vendor)   $line .= " | Brand: {$vendor}";
                if ($title)    $line .= " | Type: {$title}";
                if ($variants) $line .= " | Variants: {$variants}";
                if ($body)     $line .= "\n  Description: {$body}";
                if ($tags)     $line .= "\n  Tags: {$tags}";
                $lines[] = $line;
            }

            return implode("\n\n", $lines);
        } catch (\Throwable) {
            return '';
        }
    }

    /**
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
                'company_name' => (string) ($nameRaw['company_name'] ?? ''),
            ],
            'description'  => (string) ($raw['description'] ?? ''),
            'about'        => (string) ($raw['about'] ?? ''),
            'social_links' => $posts,
            'notes'        => (string) ($raw['notes'] ?? ''),
        ];
    }

    /**
     * Detect a Shopify store from a URL, fetch its products.json, and return suitable image URLs.
     * GPT is used to select the best images only when there are too many (>30).
     * No streaming, no reasoning effort — this is a fast synchronous call.
     */
    public function shopifyImages(Request $request): \Illuminate\Http\JsonResponse
    {
        $validated = $request->validate([
            'company_url' => ['required', 'string', 'url'],
        ]);

        $parsed = parse_url($validated['company_url']);
        if (! $parsed || empty($parsed['host'])) {
            return response()->json(['is_shopify' => false, 'images' => [], 'message' => 'Invalid URL.']);
        }

        $domain = ($parsed['scheme'] ?? 'https').'://'.$parsed['host'];

        try {
            $res = Http::timeout(10)
                ->withHeaders(['User-Agent' => 'Mozilla/5.0 (compatible; ProductBot/1.0)'])
                ->get("{$domain}/products.json", ['limit' => 250]);
        } catch (\Exception) {
            return response()->json(['is_shopify' => false, 'images' => [], 'message' => 'Could not reach the website.']);
        }

        if (! $res->ok()) {
            return response()->json(['is_shopify' => false, 'images' => [], 'message' => 'Not a Shopify store or products not accessible.']);
        }

        $data = $res->json();
        if (! isset($data['products']) || ! is_array($data['products'])) {
            return response()->json(['is_shopify' => false, 'images' => [], 'message' => 'Not a Shopify store.']);
        }

        $products = $data['products'];
        if (empty($products)) {
            return response()->json(['is_shopify' => true, 'images' => [], 'message' => 'No products found.']);
        }

        // Collect all image URLs with context
        $allImages = [];
        foreach ($products as $product) {
            $title = (string) ($product['title'] ?? '');
            foreach ($product['images'] ?? [] as $img) {
                if (! empty($img['src'])) {
                    $allImages[] = [
                        'src'           => (string) $img['src'],
                        'product_title' => $title,
                        'position'      => (int) ($img['position'] ?? 1),
                    ];
                }
            }
        }

        if (empty($allImages)) {
            return response()->json(['is_shopify' => true, 'images' => [], 'message' => 'No images found.']);
        }

        // 30 or fewer — just return them all sorted by position
        if (count($allImages) <= 30) {
            $urls = collect($allImages)->sortBy('position')->pluck('src')->unique()->values()->all();

            return response()->json(['is_shopify' => true, 'images' => $urls, 'count' => count($urls)]);
        }

        // More than 30 — ask GPT (no reasoning effort) to pick the best ones
        $apiKey = config('services.openai.api_key');
        $model  = config('services.openai.model', 'gpt-4o-mini');

        $fallbackUrls = fn () => collect($allImages)
            ->where('position', 1)
            ->pluck('src')
            ->unique()
            ->take(30)
            ->values()
            ->all();

        if (! $apiKey) {
            return response()->json(['is_shopify' => true, 'images' => $fallbackUrls(), 'count' => count($fallbackUrls())]);
        }

        $imageLines = collect($allImages)
            ->take(100)
            ->map(fn ($img) => "pos:{$img['position']} product:\"{$img['product_title']}\" url:{$img['src']}")
            ->join("\n");

        try {
            $gptRes = Http::withToken($apiKey)
                ->timeout(30)
                ->post('https://api.openai.com/v1/responses', [
                    'model'  => $model,
                    'stream' => false,
                    'input'  => [[
                        'role'    => 'user',
                        'content' => "Select up to 30 product showcase image URLs from the list below. Prefer position-1 hero shots. Exclude images whose filename contains keywords like 'how-to', 'ingredient', 'instruction', 'step'. Return JSON only.\n\n{$imageLines}",
                    ]],
                    'text' => [
                        'format' => [
                            'type'   => 'json_schema',
                            'name'   => 'selected_images',
                            'strict' => true,
                            'schema' => [
                                'type'       => 'object',
                                'properties' => [
                                    'selected_urls' => ['type' => 'array', 'items' => ['type' => 'string']],
                                ],
                                'required'             => ['selected_urls'],
                                'additionalProperties' => false,
                            ],
                        ],
                    ],
                ]);

            if (! $gptRes->ok()) {
                throw new \Exception('GPT call failed');
            }

            // Parse non-streaming Responses API output
            $text = '';
            foreach ($gptRes->json('output') ?? [] as $item) {
                if (($item['type'] ?? '') === 'message') {
                    foreach ($item['content'] ?? [] as $c) {
                        if (($c['type'] ?? '') === 'output_text') {
                            $text = $c['text'] ?? '';
                            break 2;
                        }
                    }
                }
            }

            $selected = json_decode($text, true)['selected_urls'] ?? [];
            if (empty($selected)) {
                throw new \Exception('Empty selection');
            }

            $urls = array_values(array_unique($selected));

            return response()->json(['is_shopify' => true, 'images' => $urls, 'count' => count($urls)]);
        } catch (\Exception) {
            $fb = $fallbackUrls();

            return response()->json(['is_shopify' => true, 'images' => $fb, 'count' => count($fb)]);
        }
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
                        'company_name' => ['type' => 'string'],
                    ],
                    'required'             => ['company_name'],
                    'additionalProperties' => false,
                ],
                'description' => ['type' => 'string'],
                'about'       => ['type' => 'string'],
                'social_links' => [
                    'type'     => 'array',
                    'maxItems' => 10,
                    'items'    => [
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
            'required'             => ['name', 'description', 'about', 'social_links', 'notes'],
            'additionalProperties' => false,
        ];
    }

    /* ── KB-only generation ─────────────────────────────────────────────── */

    private const KB_INSTRUCTIONS = <<<'TEXT'
# Agent Instructions: Knowledge Base Generation

## Objective

Generate a comprehensive, plain-text knowledge base document about the COMPANY behind the provided URL.
This content will be fed directly to an AI assistant as its knowledge base — it must be accurate, detailed, and well-structured.

## Input

company_url: <required>
shopify_products_json: <optional, plain-text summary of all products from the company's Shopify store>

## Output

Return plain unformatted text only — no HTML, no markdown, no JSON.

Structure the output as follows:

COMPANY OVERVIEW
[Company name, founding story, mission, values, certifications, target audience, where they sell]

PRODUCTS & RANGE
[Cover every product line and individual product. For each: product name, key ingredients or materials, intended use, available formats/variants, what makes it unique]

BRAND VALUES & DIFFERENTIATORS
[What sets this company apart — sustainability, sourcing, ethics, community, etc.]

FREQUENTLY ASKED QUESTIONS
[Anticipate 5-8 questions a customer might ask the AI about this company or its products]

## Rules
* Use shopify_products_json as PRIMARY source for product details when provided
* Supplement with web search for company overview, brand story, and FAQs
* Plain text only — no bullet symbols, no markdown, no HTML
* 600-1200 words total
* Never infer or fabricate — omit if unsure
* Do NOT add any notes, disclaimers, caveats, citations, source references, or footnotes — anywhere in the output
* Do NOT add a "Notes", "Sources", "Disclaimer", "Limitations", or any similar trailing section
* End the output after the FREQUENTLY ASKED QUESTIONS section — nothing after
TEXT;

    public function generateKb(Request $request): StreamedResponse
    {
        $validated = $request->validate([
            'company_url' => ['required', 'string', 'max:2048', 'url'],
        ]);

        return response()->stream(function () use ($validated) {
            @set_time_limit(0);
            @ini_set('output_buffering', '0');
            @ini_set('zlib.output_compression', '0');
            while (ob_get_level() > 0) @ob_end_flush();

            $emit = function (string $event, array $data): void {
                echo "event: {$event}\n";
                echo 'data: '.json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE)."\n\n";
                echo str_repeat(' ', 256)."\n\n";
                @flush();
            };

            $apiKey = config('services.openai.api_key');
            if (! $apiKey) {
                $emit('error', ['message' => 'OPENAI_API_KEY is not configured.']);
                return;
            }

            $emit('thought', ['text' => 'Checking for Shopify product catalogue…']);
            $shopifyText = $this->fetchShopifyProductsText($validated['company_url']);
            if ($shopifyText !== '') {
                $emit('thought', ['text' => 'Shopify products.json found — product catalogue will be used as primary source.']);
            } else {
                $emit('thought', ['text' => 'No Shopify catalogue found — will rely on web search.']);
            }

            $input = "company_url: {$validated['company_url']}\n"
                .($shopifyText !== '' ? "\nshopify_products_json:\n{$shopifyText}\n" : '');

            $emit('thought', ['text' => 'Calling GPT to generate knowledge base…']);

            try {
                $streamResponse = Http::withToken($apiKey)
                    ->withOptions(['stream' => true, 'read_timeout' => 120])
                    ->withHeaders(['Accept' => 'text/event-stream'])
                    ->asJson()
                    ->timeout(120)
                    ->post('https://api.openai.com/v1/responses', [
                        'model'        => config('services.openai.model', 'gpt-4o-mini'),
                        'instructions' => self::KB_INSTRUCTIONS,
                        'input'        => $input,
                        'stream'       => true,
                        'tools'        => [['type' => config('services.openai.web_search_tool', 'web_search')]],
                    ]);

                if ($streamResponse->status() >= 400) {
                    $emit('error', ['message' => 'GPT request failed.', 'detail' => (string) $streamResponse->body()]);
                    return;
                }

                $body       = $streamResponse->toPsrResponse()->getBody();
                $lineBuffer = '';
                $outputText = '';
                $currentEventType = '';

                while (! $body->eof()) {
                    $chunk = $body->read(512);
                    if ($chunk === '' || $chunk === false) continue;
                    $lineBuffer .= $chunk;

                    while (($nl = strpos($lineBuffer, "\n")) !== false) {
                        $line       = rtrim(substr($lineBuffer, 0, $nl), "\r");
                        $lineBuffer = substr($lineBuffer, $nl + 1);

                        if ($line === '') { $currentEventType = ''; continue; }
                        if (str_starts_with($line, 'event: ')) { $currentEventType = trim(substr($line, 7)); continue; }
                        if (! str_starts_with($line, 'data: ')) continue;

                        $raw = substr($line, 6);
                        if ($raw === '[DONE]') break 2;
                        $data = json_decode($raw, true);
                        if (! is_array($data)) continue;

                        $this->handleStreamEvent($currentEventType, $data, $emit, $outputText);
                    }
                }

                $kbText = trim($outputText);
                if ($kbText === '') {
                    $emit('error', ['message' => 'GPT returned an empty response.']);
                    return;
                }

                $emit('result', ['kb_text' => $kbText]);
                $emit('done', []);
            } catch (\Throwable $e) {
                report($e);
                $emit('error', ['message' => $e->getMessage()]);
            }
        }, 200, [
            'Content-Type'      => 'text/event-stream',
            'Cache-Control'     => 'no-cache',
            'X-Accel-Buffering' => 'no',
        ]);
    }
}
