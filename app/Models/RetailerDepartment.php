<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class RetailerDepartment extends Model
{
    protected $table = 'retailer_departments';

    protected $fillable = [
        'name',
    ];

    public function retailerProfiles(): BelongsToMany
    {
        return $this->belongsToMany(
            RetailerProfile::class,
            'retailer_department_retailer_profile',
            'retailer_department_id',
            'retailer_profile_id'
        );
    }
}
