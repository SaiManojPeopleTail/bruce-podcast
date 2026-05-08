<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MerchOrder extends Model
{
    protected $fillable = [
        'uuid',
        'stripe_payment_intent_id',
        'printify_order_id',
        'status',
        'customer_name',
        'customer_email',
        'customer_phone',
        'address_first_name',
        'address_last_name',
        'address_line1',
        'address_line2',
        'address_city',
        'address_region',
        'address_zip',
        'address_country',
        'subtotal_amount',
        'shipping_cost',
        'tax_rate',
        'tax_amount',
        'total_amount',
        'shipping_method',
        'tracking_info',
        'tracking_last_polled_at',
    ];

    protected $casts = [
        'tracking_info' => 'array',
        'tracking_last_polled_at' => 'datetime',
        'tax_rate' => 'decimal:4',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(MerchOrderItem::class);
    }

    public function statusLabel(): string
    {
        return match ($this->status) {
            'pending_payment' => 'Pending Payment',
            'paid' => 'Paid',
            'submitted' => 'Submitted to Printify',
            'in_production' => 'In Production',
            'shipped' => 'Shipped',
            'fulfilled' => 'Fulfilled',
            'cancelled' => 'Cancelled',
            'failed' => 'Failed',
            default => ucfirst($this->status),
        };
    }

    public function statusColor(): string
    {
        return match ($this->status) {
            'paid', 'submitted' => 'amber',
            'in_production' => 'blue',
            'shipped' => 'indigo',
            'fulfilled' => 'emerald',
            'cancelled', 'failed' => 'red',
            default => 'gray',
        };
    }
}
