<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductEnquiry extends Model
{
    protected $fillable = [
        'product_qr_list_id',
        'name',
        'store_name',
        'phone',
        'email',
        'message',
        'notification_status',
        'notification_error',
    ];

    public function productQrList(): BelongsTo
    {
        return $this->belongsTo(ProductQrList::class);
    }
}
