<?php

namespace App\Support;

class SocialScrapeUrl
{
    public static function normalize(string $url): string
    {
        $url = trim($url);
        $parts = parse_url($url);

        if ($parts === false || empty($parts['host'])) {
            return $url;
        }

        $scheme = strtolower($parts['scheme'] ?? 'https');
        $host   = strtolower(preg_replace('/^www\./', '', $parts['host']));
        $path   = isset($parts['path']) ? rtrim($parts['path'], '/') : '';
        $query  = isset($parts['query']) ? '?' . $parts['query'] : '';

        return "{$scheme}://{$host}{$path}{$query}";
    }

    public static function hash(string $url): string
    {
        return hash('sha256', self::normalize($url));
    }

    /**
     * @return 'instagram'|'linkedin'|'other'
     */
    public static function detectPlatform(string $url): string
    {
        try {
            $host = strtolower(parse_url($url, PHP_URL_HOST) ?? '');
            $host = preg_replace('/^www\./', '', $host);

            if (str_contains($host, 'instagram.com')) {
                return 'instagram';
            }

            if (str_contains($host, 'linkedin.com')) {
                return 'linkedin';
            }
        } catch (\Throwable) {
            // fall through
        }

        return 'other';
    }

    public static function postHash(?string $postUrl): ?string
    {
        if ($postUrl === null || trim($postUrl) === '') {
            return null;
        }

        return hash('sha256', trim($postUrl));
    }
}
