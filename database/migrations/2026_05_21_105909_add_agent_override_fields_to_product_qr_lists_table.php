<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_qr_lists', function (Blueprint $table) {
            $table->string('voice_id', 255)->nullable()->after('retailers');
            $table->string('first_message', 1000)->nullable()->after('retailers');
        });
    }

    public function down(): void
    {
        Schema::table('product_qr_lists', function (Blueprint $table) {
            $table->dropColumn(['first_message', 'voice_id']);
        });
    }
};
