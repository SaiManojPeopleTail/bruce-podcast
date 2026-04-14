<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RetailerContact extends Model
{
    protected $fillable = [
        'contact_name',
        'title',
        'email',
        'linkedin',
        'retailer_profile_id',
    ];

    public function retailerProfile(): BelongsTo
    {
        return $this->belongsTo(RetailerProfile::class, 'retailer_profile_id');
    }
}
