<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class Brand extends Model
{
    protected $fillable = [
        'name',
        'description',
        'image_path',
    ];

    protected $appends = [
        'image_url',
    ];

    public function sponsorVideos(): HasMany
    {
        return $this->hasMany(SponsorVideo::class)->orderByDesc('created_at');
    }

    public function getImageUrlAttribute(): ?string
    {
        if (!$this->image_path) {
            return null;
        }

        try {
            if (class_exists(\League\Flysystem\AwsS3V3\PortableVisibilityConverter::class)) {
                return Storage::disk('s3')->temporaryUrl($this->image_path, now()->addMinutes(30));
            }

            return Storage::disk('public')->url($this->image_path);
        } catch (\Throwable $e) {
            return null;
        }
    }
}
