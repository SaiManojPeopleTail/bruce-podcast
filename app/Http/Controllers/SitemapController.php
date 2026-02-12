<?php

namespace App\Http\Controllers;

use App\Models\Clip;
use App\Models\Episode;
use App\Models\SponsorVideo;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;

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
            'Allow: /all-episodes',
            'Allow: /episodes',
            'Allow: /episodes/clips',
            'Allow: /sponsor-videos',
            'Allow: /episode/',
            'Allow: /episodes/clip/',
            'Allow: /sponsor-video/',
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
            ['loc' => $base . '/all-episodes', 'priority' => '0.9', 'changefreq' => 'weekly'],
            ['loc' => $base . '/episodes', 'priority' => '0.9', 'changefreq' => 'weekly'],
            ['loc' => $base . '/episodes/clips', 'priority' => '0.9', 'changefreq' => 'weekly'],
            ['loc' => $base . '/sponsor-videos', 'priority' => '0.9', 'changefreq' => 'weekly'],
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

        // Clips
        $clips = Clip::orderByDesc('created_at')->get(['slug', 'updated_at', 'created_at']);
        foreach ($clips as $clip) {
            $lastmod = ($clip->updated_at ?? $clip->created_at)?->toW3cString();
            $urls[] = $this->urlNode(
                $base . '/episodes/clip/' . $clip->slug,
                $lastmod,
                '0.8',
                'weekly'
            );
        }

        // Sponsor videos
        $sponsorVideos = SponsorVideo::orderByDesc('created_at')->get(['slug', 'updated_at', 'created_at']);
        foreach ($sponsorVideos as $video) {
            $lastmod = ($video->updated_at ?? $video->created_at)?->toW3cString();
            $urls[] = $this->urlNode(
                $base . '/sponsor-video/' . $video->slug,
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
