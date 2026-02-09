<?php

namespace App\Http\Controllers;

use App\Models\Episode;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Route;

class SitemapController extends Controller
{
    public const SITEMAP_CACHE_KEY = 'sitemap.xml';

    /** TTL in seconds (1 hour). Sitemap also invalidated when episodes change. */
    public const SITEMAP_CACHE_TTL = 3600;

    public function robots(): Response
    {
        $base = rtrim(config('app.url'), '/');
        $lines = [
            'User-agent: *',
            'Allow: /',
            'Allow: /meet-bruce',
            'Allow: /brand-partnerships',
            'Allow: /guest-submissions',
            'Allow: /episode/',
            'Disallow: /admin',
            'Disallow: /login',
            'Disallow: /forgot-password',
            'Disallow: /reset-password',
            'Disallow: /verify-email',
            'Disallow: /confirm-password',
            'Disallow: /api/',
            'Sitemap: ' . $base . '/sitemap.xml',
        ];

        return response(implode("\n", $lines), 200, [
            'Content-Type' => 'text/plain; charset=utf-8',
        ]);
    }

    public function sitemap(): Response
    {
        $xml = Cache::remember(self::SITEMAP_CACHE_KEY, self::SITEMAP_CACHE_TTL, function () {
            return $this->buildSitemapXml();
        });

        return response($xml, 200, [
            'Content-Type' => 'application/xml; charset=utf-8',
        ]);
    }

    protected function buildSitemapXml(): string
    {
        $base = rtrim(config('app.url'), '/');

        $urls = [];

        // Static pages
        $static = [
            ['loc' => $base . '/', 'priority' => '1.0', 'changefreq' => 'weekly'],
            ['loc' => $base . '/meet-bruce', 'priority' => '0.9', 'changefreq' => 'monthly'],
            ['loc' => $base . '/brand-partnerships', 'priority' => '0.9', 'changefreq' => 'monthly'],
            ['loc' => $base . '/guest-submissions', 'priority' => '0.9', 'changefreq' => 'monthly'],
        ];

        foreach ($static as $entry) {
            $urls[] = $this->urlNode($entry['loc'], null, $entry['priority'], $entry['changefreq']);
        }

        // Episodes
        $episodes = Episode::orderByDesc('created_at')->get(['slug', 'updated_at', 'created_at']);
        foreach ($episodes as $episode) {
            $lastmod = ($episode->updated_at ?? $episode->created_at)?->toW3cString();
            $urls[] = $this->urlNode(
                $base . '/episode/' . $episode->slug,
                $lastmod,
                '0.8',
                'weekly'
            );
        }

        return '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
            . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n"
            . implode("\n", $urls) . "\n"
            . '</urlset>';
    }

    protected function urlNode(string $loc, ?string $lastmod, string $priority, string $changefreq): string
    {
        $loc = htmlspecialchars($loc, ENT_XML1, 'UTF-8');
        $out = '  <url><loc>' . $loc . '</loc>';
        if ($lastmod) {
            $out .= '<lastmod>' . htmlspecialchars($lastmod, ENT_XML1, 'UTF-8') . '</lastmod>';
        }
        $out .= '<changefreq>' . htmlspecialchars($changefreq, ENT_XML1, 'UTF-8') . '</changefreq>';
        $out .= '<priority>' . htmlspecialchars($priority, ENT_XML1, 'UTF-8') . '</priority></url>';
        return $out;
    }
}
