<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Episode extends Model
{
    protected $fillable = [
        'title',
        'slug',
        'short_description',
        'long_description',
        'video_url',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];
}
