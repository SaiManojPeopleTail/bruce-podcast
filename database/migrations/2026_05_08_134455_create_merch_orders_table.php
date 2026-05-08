<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('merch_orders', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('stripe_payment_intent_id')->unique();
            $table->string('printify_order_id')->nullable();
            $table->string('status')->default('pending_payment');

            $table->string('customer_name');
            $table->string('customer_email');
            $table->string('customer_phone')->nullable();

            $table->string('address_first_name');
            $table->string('address_last_name');
            $table->string('address_line1');
            $table->string('address_line2')->nullable();
            $table->string('address_city');
            $table->string('address_region');
            $table->string('address_zip');
            $table->string('address_country', 2)->default('CA');

            $table->unsignedInteger('subtotal_amount');
            $table->unsignedInteger('shipping_cost')->default(0);
            $table->decimal('tax_rate', 5, 4)->default(0);
            $table->unsignedInteger('tax_amount')->default(0);
            $table->unsignedInteger('total_amount');
            $table->integer('shipping_method')->nullable();

            $table->json('tracking_info')->nullable();
            $table->timestamp('tracking_last_polled_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('merch_orders');
    }
};
