<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('merch_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merch_order_id')->constrained()->cascadeOnDelete();
            $table->string('printify_product_id');
            $table->string('printify_variant_id');
            $table->string('product_title');
            $table->string('variant_title')->nullable();
            $table->unsignedSmallInteger('quantity')->default(1);
            $table->unsignedInteger('unit_price');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('merch_order_items');
    }
};
