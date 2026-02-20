<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class SponsorVideo extends Model
{
    protected $fillable = [
        'brand_id',
        'title',
        'slug',
        'short_description',
        'long_description',
        'bunny_video_id',
        'bunny_library_id',
        'status',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'status' => 'boolean',
    ];

    protected $appends = [
        'thumbnail_url',
    ];

    protected static function booted(): void
    {
        static::addGlobalScope('published', function (Builder $builder) {
            $builder->where('created_at', '<=', now())
                ->where('status', true);
        });
    }

    public function resolveRouteBinding($value, $field = null): ?Model
    {
        $field = $field ?: $this->getRouteKeyName();

        return $this->withoutGlobalScopes()
            ->where($field, $value)
            ->firstOrFail();
    }

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function getThumbnailUrlAttribute($value): ?string
    {
        if (!$this->bunny_video_id || !$this->bunny_library_id) {
            return $value ?: null;
        }

        $cdnHost = $this->resolveBunnyCdnHost();
        if (!$cdnHost) {
            return $value ?: null;
        }

        $thumbnailFileName = $this->resolveBunnyThumbnailFileName();
        if (!$thumbnailFileName) {
            return $value ?: null;
        }

        return "https://{$cdnHost}/{$this->bunny_video_id}/{$thumbnailFileName}";
    }

    protected function resolveBunnyThumbnailFileName(): ?string
    {
        $apiKey = config('services.bunny.api_key');
        if (!$apiKey) {
            return null;
        }

        $cacheKey = "sponsor-videos:bunny-thumb-file:{$this->bunny_library_id}:{$this->bunny_video_id}";

        return Cache::remember($cacheKey, now()->addMinutes(30), function () use ($apiKey) {
            $response = Http::withHeaders([
                'AccessKey' => $apiKey,
            ])->get("https://video.bunnycdn.com/library/{$this->bunny_library_id}/videos/{$this->bunny_video_id}");

            if (!$response->successful()) {
                return null;
            }

            $thumbnailFileName = $response->json('thumbnailFileName');
            return $thumbnailFileName ?: null;
        });
    }

    protected function resolveBunnyCdnHost(): ?string
    {
        $pullZone = trim((string) config('services.bunny.pull_zone'));
        if ($pullZone === '') {
            return null;
        }

        $cdnHost = preg_replace('#^https?://#', '', $pullZone);
        $cdnHost = trim((string) $cdnHost, '/');

        if ($cdnHost !== '' && !str_contains($cdnHost, '.')) {
            $cdnHost .= '.b-cdn.net';
        }

        return $cdnHost ?: null;
    }
}
