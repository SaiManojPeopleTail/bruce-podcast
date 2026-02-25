<?php

namespace App;

use App\Models\SiteSetting;
use Illuminate\Support\Facades\Config;

class Meta
{
    protected static array $meta = [];

    protected static ?string $canonical = null;

    public static function addMeta(string $name, string $content): void
    {
        static::$meta[$name] = $content;
    }

    public static function hasTitle(): bool
    {
        return isset(static::$meta['title']);
    }

    public static function setCanonical(string $url): void
    {
        static::$canonical = $url;
    }

    /**
     * Load default meta from site settings (DB). Call from public controllers.
     */
    public static function loadFromSiteSettings(): void
    {
        $settings = SiteSetting::get();
        if (!$settings) {
            return;
        }
        if ($settings->meta_title) {
            static::addMeta('title', $settings->meta_title);
            static::addMeta('og:title', $settings->meta_title);
        }
        if ($settings->meta_description) {
            static::addMeta('description', $settings->meta_description);
            static::addMeta('og:description', $settings->meta_description);
        }
        if ($settings->meta_keywords) {
            static::addMeta('keywords', $settings->meta_keywords);
        }
        if ($settings->og_image) {
            static::addMeta('og:image', $settings->og_image);
        }
        static::addMeta('og:type', 'website');
    }

    /**
     * Build WebPage JSON-LD from existing meta (title, description, canonical, og:image). No extra fields needed.
     */
    protected static function buildWebPageJsonLd(): ?string
    {
        $canonical = static::$canonical;
        $title = trim((string) (static::$meta['title'] ?? ''));
        $description = trim((string) (static::$meta['description'] ?? ''));
        $image = trim((string) (static::$meta['og:image'] ?? ''));

        if ($canonical === null && $title === '') {
            return null;
        }

        $data = [
            '@context' => 'https://schema.org',
            '@type' => 'WebPage',
        ];
        if ($title !== '') {
            $data['name'] = $title;
            $data['headline'] = $title;
        }
        if ($description !== '') {
            $data['description'] = $description;
        }
        if ($canonical !== null && $canonical !== '') {
            $data['url'] = $canonical;
        }
        if ($image !== '') {
            $data['image'] = $image;
        }
        $author = trim((string) Config::get('app.author', ''));
        if ($author !== '') {
            $data['author'] = ['@type' => 'Person', 'name' => $author];
            $data['publisher'] = ['@type' => 'Organization', 'name' => $author];
        }

        return json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    public static function render(): string
    {
        $html = [];
        $canonical = static::$canonical;
        if ($canonical) {
            $html[] = '<link rel="canonical" href="' . e($canonical) . '">';
        }
        $author = trim((string) Config::get('app.author', ''));
        if ($author !== '') {
            $html[] = '<meta name="author" content="' . e($author) . '">';
        }
        foreach (static::$meta as $name => $content) {
            $content = trim((string) $content);
            if ($content === '') {
                continue;
            }
            if ($name === 'title') {
                $html[] = '<title>' . e($content) . '</title>';
                continue;
            }
            if (str_starts_with($name, 'json-ld')) {
                $html[] = '<script type="application/ld+json">' . "\n" . $content . "\n" . '</script>';
                continue;
            }
            if (str_starts_with($name, 'og:')) {
                $html[] = '<meta property="' . e($name) . '" content="' . e($content) . '">';
                continue;
            }
            $html[] = '<meta name="' . e($name) . '" content="' . e($content) . '">';
        }

        $jsonLd = static::buildWebPageJsonLd();
        if ($jsonLd !== null) {
            $html[] = '<script type="application/ld+json">' . "\n" . $jsonLd . "\n" . '</script>';
        }

        return implode("\n        ", $html);
    }

    /**
     * Reset (e.g. for tests or between requests if needed).
     */
    public static function reset(): void
    {
        static::$meta = [];
        static::$canonical = null;
    }
}
