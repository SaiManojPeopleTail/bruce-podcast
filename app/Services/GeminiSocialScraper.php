<?php

namespace App\Services;

/**
 * Streams Gemini's :streamGenerateContent (SSE) and forwards parsed events
 * (status / thought / text / urlMeta / finish / error) to a caller-supplied
 * sink via a callback.
 *
 * Designed to be pumped from inside a Laravel response()->stream() so the
 * frontend can show live "thinking" updates.
 */
class GeminiSocialScraper
{
    private const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

    /**
     * @param  callable(string $event, array $data): void  $emit
     */
    public function streamScrape(string $sourceUrl, callable $emit): void
    {
        $apiKey = (string) config('services.gemini.api_key');
        $model  = (string) config('services.gemini.model', 'gemini-2.5-flash');

        if ($apiKey === '') {
            $emit('error', ['message' => 'GEMINI_API_KEY is not configured on the server.']);
            return;
        }

        $endpoint = self::BASE . "/{$model}:streamGenerateContent?alt=sse&key={$apiKey}";

        $payload = [
            'contents' => [[
                'role'  => 'user',
                'parts' => [['text' => $this->buildPrompt($sourceUrl)]],
            ]],
            'tools' => [
                ['url_context'   => new \stdClass()],
                ['google_search' => new \stdClass()],
            ],
            'generationConfig' => [
                'temperature'    => 0.3,
                'thinkingConfig' => [
                    'includeThoughts' => true,
                    'thinkingBudget'  => -1,
                ],
            ],
        ];

        $emit('status', ['stage' => 'connecting', 'message' => 'Connecting to Gemini…']);

        $buffer       = '';
        $firstChunk   = true;
        $errorBody    = '';
        $httpStatus   = 0;
        $captureError = false;

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $endpoint,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'Accept: text/event-stream',
            ],
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_TIMEOUT        => 300,
            CURLOPT_CONNECTTIMEOUT => 30,
            CURLOPT_HEADERFUNCTION => function ($_ch, $header) use (&$httpStatus, &$captureError) {
                if (preg_match('#^HTTP/\S+\s+(\d{3})#', $header, $m)) {
                    $httpStatus = (int) $m[1];
                    $captureError = $httpStatus >= 400;
                }
                return strlen($header);
            },
            CURLOPT_WRITEFUNCTION  => function ($_ch, $data) use (&$buffer, &$firstChunk, &$errorBody, &$captureError, $emit) {
                if ($captureError) {
                    $errorBody .= $data;
                    return strlen($data);
                }
                if ($firstChunk) {
                    $firstChunk = false;
                    $emit('status', ['stage' => 'streaming', 'message' => 'Reading the page and thinking…']);
                }

                $buffer .= $data;

                // SSE chunks are separated by a blank line ("\n\n").
                while (($idx = strpos($buffer, "\n\n")) !== false) {
                    $block  = substr($buffer, 0, $idx);
                    $buffer = substr($buffer, $idx + 2);
                    $this->processSseBlock($block, $emit);
                }

                return strlen($data);
            },
        ]);

        $ok = curl_exec($ch);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($captureError) {
            $emit('error', [
                'message' => "Gemini API returned HTTP {$httpStatus}",
                'detail'  => $this->safeTrim($errorBody),
            ]);
            return;
        }

        if ($ok === false && $curlErr) {
            $emit('error', ['message' => 'Network error: ' . $curlErr]);
            return;
        }

        // Drain any trailing buffered block (rare).
        if (trim($buffer) !== '') {
            $this->processSseBlock($buffer, $emit);
        }
    }

    private function processSseBlock(string $block, callable $emit): void
    {
        $dataPayload = '';
        foreach (explode("\n", $block) as $line) {
            $line = rtrim($line, "\r");
            if (str_starts_with($line, 'data: ')) {
                $dataPayload .= substr($line, 6);
            } elseif (str_starts_with($line, 'data:')) {
                $dataPayload .= substr($line, 5);
            }
        }

        if ($dataPayload === '' || trim($dataPayload) === '[DONE]') {
            return;
        }

        $json = json_decode($dataPayload, true);
        if (!is_array($json)) {
            return;
        }

        $candidate = $json['candidates'][0] ?? null;
        if ($candidate) {
            foreach (($candidate['content']['parts'] ?? []) as $part) {
                $text = $part['text'] ?? '';
                if ($text === '') {
                    continue;
                }
                if (!empty($part['thought'])) {
                    $emit('thought', ['text' => $text]);
                } else {
                    $emit('text', ['text' => $text]);
                }
            }

            if (!empty($candidate['finishReason'])) {
                $emit('finish', ['reason' => $candidate['finishReason']]);
            }
        }

        // Surface URL-context metadata for transparency (which URLs were actually fetched).
        $urlMeta = $json['candidates'][0]['url_context_metadata']['url_metadata']
            ?? $json['candidates'][0]['urlContextMetadata']['urlMetadata']
            ?? null;
        if (is_array($urlMeta)) {
            $emit('urlMeta', ['urls' => $urlMeta]);
        }
    }

    private function safeTrim(string $s, int $max = 800): string
    {
        $s = trim($s);
        return mb_strlen($s) > $max ? mb_substr($s, 0, $max) . '…' : $s;
    }

    private function buildPrompt(string $sourceUrl): string
    {
        return <<<PROMPT
You are a social-media post extractor for a product team.

Your job: given the URL below, identify recent public posts and return their key fields.

URL: {$sourceUrl}

Workflow you MUST follow:
1. Use the url_context tool to fetch the page at the URL.
2. If the page is a profile / channel / company page, identify the most recent posts you can see (up to 10).
3. If the page is a single post, return just that one post.
4. If url_context cannot access the page (login required, blocked, etc.), use google_search to look up the same handle / company and gather what you can about their recent posts.
5. For every post, collect:
   - type ("image" | "video" | "text" | "mixed")
   - media_url (direct image or video URL; null if you cannot determine one)
   - description (caption / body text — keep newlines, no truncation)
   - post_url (canonical permalink to that exact post)
   - posted_at (ISO 8601 if known, else null)
6. Briefly think out loud about what you are doing — your thought summaries are streamed live to the user so they know progress is being made.

Final answer format (MANDATORY):
Output your final answer as a single JSON code block, exactly like this and nothing else after it:

```json
{
  "platform": "instagram | linkedin | twitter | youtube | facebook | tiktok | other",
  "source_url": "{$sourceUrl}",
  "posts": [
    {
      "type": "image",
      "media_url": "https://…",
      "description": "Caption text…",
      "post_url": "https://…",
      "posted_at": "2026-04-21T15:30:00Z"
    }
  ],
  "notes": "Any caveats about access, gaps, or how confident you are."
}
```

Rules:
- The JSON block must be valid JSON (double quotes, no trailing commas).
- If you genuinely could not extract any posts, still return the JSON block with "posts": [] and explain in "notes".
- Do NOT invent posts, URLs, or media you did not actually observe — leave fields null and note it.
PROMPT;
    }
}
