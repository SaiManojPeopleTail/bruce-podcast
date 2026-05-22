<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SocialScrape extends Model
{
    protected $fillable = [
        'platform',
        'source_url',
        'source_url_hash',
        'notes',
        'saved_by',
    ];

    public function posts(): HasMany
    {
        return $this->hasMany(SocialScrapePost::class)->orderBy('sort_order')->orderBy('id');
    }

    public function savedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'saved_by');
    }
}
