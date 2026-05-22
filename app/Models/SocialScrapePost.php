<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SocialScrapePost extends Model
{
    protected $fillable = [
        'social_scrape_id',
        'type',
        'media_url',
        'description',
        'post_url',
        'post_url_hash',
        'posted_at',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'posted_at'  => 'datetime',
        'is_active'  => 'boolean',
        'sort_order' => 'integer',
    ];

    public function scrape(): BelongsTo
    {
        return $this->belongsTo(SocialScrape::class, 'social_scrape_id');
    }
}
