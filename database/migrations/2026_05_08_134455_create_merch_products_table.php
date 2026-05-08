<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('merch_products', function (Blueprint $table) {
            $table->id();
            $table->string('printify_product_id')->unique();
            $table->string('slug')->unique();
            $table->string('title');
            $table->text('description')->nullable();
            $table->json('images')->nullable();
            $table->json('variants')->nullable();
            $table->unsignedInteger('blueprint_id')->nullable();
            $table->unsignedInteger('print_provider_id')->nullable();
            $table->boolean('is_visible')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('merch_products');
    }
};
