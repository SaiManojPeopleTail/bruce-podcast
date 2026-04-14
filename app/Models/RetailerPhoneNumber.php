<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RetailerPhoneNumber extends Model
{
    protected $table = 'retailer_phone_numbers';

    protected $fillable = [
        'phone_number',
        'retailer_profile_id',
    ];

    public function retailerProfile(): BelongsTo
    {
        return $this->belongsTo(RetailerProfile::class, 'retailer_profile_id');
    }
}
