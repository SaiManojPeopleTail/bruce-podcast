<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SiteSetting extends Model
{
    protected $fillable = [
        'meta_title',
        'meta_description',
        'meta_keywords',
        'og_image',
    ];

    /**
     * Get the single site settings row (singleton). Creates with defaults if none exists.
     */
    public static function get(): ?self
    {
        $setting = static::first();
        if ($setting) {
            return $setting;
        }
        return static::create([
            'meta_title' => config('app.name'),
            'meta_description' => null,
            'meta_keywords' => null,
            'og_image' => null,
        ]);
    }
}
