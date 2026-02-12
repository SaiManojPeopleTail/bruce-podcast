<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Page extends Model
{
    protected $fillable = [
        'slug',
        'meta_title',
        'meta_description',
        'meta_keywords',
        'og_image',
    ];

    /** Route path for display. */
    public static function routeForSlug(string $slug): string
    {
        return match ($slug) {
            'home' => '/',
            'all-episodes' => '/all-episodes',
            'clips' => '/episodes/clips',
            default => '/' . $slug,
        };
    }

    /** Display name for slug. */
    public static function nameForSlug(string $slug): string
    {
        return match ($slug) {
            'home' => 'Home',
            'about' => 'Meet Bruce',
            'brand-partnerships' => 'Brand Partnerships',
            'guest-submissions' => 'Guest Submission',
            'all-episodes' => 'All Episodes',
            'episodes' => 'Episodes',
            'clips' => 'Clips',
            'sponsor-videos' => 'Sponsor Videos',
            default => $slug,
        };
    }

    public static function findBySlug(string $slug): ?self
    {
        return static::where('slug', $slug)->first();
    }
}
