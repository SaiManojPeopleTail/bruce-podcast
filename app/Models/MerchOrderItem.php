<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MerchOrderItem extends Model
{
    protected $fillable = [
        'merch_order_id',
        'printify_product_id',
        'printify_variant_id',
        'product_title',
        'variant_title',
        'quantity',
        'unit_price',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(MerchOrder::class, 'merch_order_id');
    }
}
