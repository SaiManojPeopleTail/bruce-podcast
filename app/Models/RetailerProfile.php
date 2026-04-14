<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class RetailerProfile extends Model
{
    protected $fillable = [
        'name',
        'handle',
        'description',
        'notes',
        'address_line_1',
        'address_line_2',
        'city',
        'state',
        'zip',
        'country',
        'email',
        'website',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public static function generateUniqueHandle(string $name, ?int $ignoreId = null): string
    {
        $base = Str::slug($name) ?: 'retailer';
        $handle = $base;
        $n = 0;

        while (static::query()
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->where('handle', $handle)
            ->exists()) {
            $n++;
            $handle = $base.'-'.$n;
        }

        return $handle;
    }

    public function departments(): BelongsToMany
    {
        return $this->belongsToMany(
            RetailerDepartment::class,
            'retailer_department_retailer_profile',
            'retailer_profile_id',
            'retailer_department_id'
        );
    }

    public function phoneNumbers(): HasMany
    {
        return $this->hasMany(RetailerPhoneNumber::class, 'retailer_profile_id');
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(RetailerContact::class, 'retailer_profile_id');
    }
}
