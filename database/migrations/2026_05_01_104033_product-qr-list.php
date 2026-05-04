<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('product_qr_lists', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('product_name');
            $table->json('product_images')->nullable();
            $table->text('product_description')->nullable();
            $table->string('video_url')->nullable();
            $table->text('generated_qr_code_base64')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('product_qr_lists');
    }
};
