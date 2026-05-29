<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductQrList extends Model
{
    protected $fillable = [
        'slug',
        'is_active',
        'product_name',
        'notification_email',
        'product_images',
        'product_description',
        'video_url',
        'video_thumbnail_url',
        'generated_qr_code_base64',
        'retailers',
        'first_message',
        'voice_id',
        'social_posts',
        'elevenlabs_kb_id',
        'kb_rag_status',
        'kb_name',
        'kb_type',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'product_images' => 'array',
        'generated_qr_code_base64' => 'string',
        'retailers' => 'array',
        'social_posts' => 'array',
    ];

    public function enquiries(): HasMany
    {
        return $this->hasMany(ProductEnquiry::class);
    }
}
