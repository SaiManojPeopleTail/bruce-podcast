<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MerchProduct extends Model
{
    protected $fillable = [
        'printify_product_id',
        'slug',
        'title',
        'description',
        'images',
        'variants',
        'blueprint_id',
        'print_provider_id',
        'is_visible',
    ];

    protected $casts = [
        'images' => 'array',
        'variants' => 'array',
        'is_visible' => 'boolean',
    ];

    public function startingPrice(): int
    {
        $variants = $this->variants ?? [];
        $available = array_filter($variants, fn ($v) => ($v['is_available'] ?? true));
        if (empty($available)) {
            return 0;
        }
        $prices = array_map(function ($v) {
            $sale = isset($v['sale_price']) && $v['sale_price'] > 0 ? (int) $v['sale_price'] : null;

            return $sale !== null && $sale < (int) $v['our_price'] ? $sale : (int) $v['our_price'];
        }, $available);

        return min($prices);
    }

    public function hasSale(): bool
    {
        foreach ($this->variants ?? [] as $v) {
            if (isset($v['sale_price']) && $v['sale_price'] > 0 && $v['sale_price'] < ($v['our_price'] ?? PHP_INT_MAX)) {
                return true;
            }
        }

        return false;
    }

    public function firstImage(): ?string
    {
        return $this->images[0]['src'] ?? $this->images[0] ?? null;
    }
}
