<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductQrList extends Model
{
    protected $fillable = [
        'slug',
        'product_name',
        'product_images',
        'product_description',
        'video_url',
        'generated_qr_code_base64',
    ];

    // product images will be an array of strings should be converted to json and stored in the database

    protected $casts = [
        'product_images' => 'array',
        'generated_qr_code_base64' => 'string',
    ];

    public function enquiries(): HasMany
    {
        return $this->hasMany(ProductEnquiry::class);
    }
}
