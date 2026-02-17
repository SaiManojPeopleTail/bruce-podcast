<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Personality extends Model
{
    protected $fillable = [
        'name',
        'video_path',
        'status',
    ];

    protected $casts = [
        'status' => 'boolean',
    ];

    protected $appends = [
        'video_url',
    ];

    public function getVideoUrlAttribute(): ?string
    {
        if (!$this->video_path) {
            return null;
        }

        try {
            if (class_exists(\League\Flysystem\AwsS3V3\PortableVisibilityConverter::class)) {
                return Storage::disk('s3')->temporaryUrl($this->video_path, now()->addMinutes(30));
            }

            return Storage::disk('public')->url($this->video_path);
        } catch (\Throwable $e) {
            return null;
        }
    }
}
