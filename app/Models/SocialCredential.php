<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SocialCredential extends Model
{
    protected $fillable = [
        'platform',
        'label',
        'username',
        'password',
        'storage_state',
        'last_used_at',
    ];

    protected $casts = [
        'username'      => 'encrypted',
        'password'      => 'encrypted',
        'storage_state' => 'encrypted:array',
        'last_used_at'  => 'datetime',
    ];

    protected $hidden = [
        'username',
        'password',
        'storage_state',
    ];
}
