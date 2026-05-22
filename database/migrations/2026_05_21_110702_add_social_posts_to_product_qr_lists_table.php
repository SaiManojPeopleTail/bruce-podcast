<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_qr_lists', function (Blueprint $table) {
            $table->json('social_posts')->nullable()->after('voice_id');
        });
    }

    public function down(): void
    {
        Schema::table('product_qr_lists', function (Blueprint $table) {
            $table->dropColumn('social_posts');
        });
    }
};
