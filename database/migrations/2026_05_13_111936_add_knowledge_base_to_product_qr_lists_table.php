<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_qr_lists', function (Blueprint $table) {
            $table->string('elevenlabs_kb_id')->nullable()->after('retailers');
            $table->string('kb_rag_status')->nullable()->after('elevenlabs_kb_id');
            $table->string('kb_name')->nullable()->after('kb_rag_status');
        });
    }

    public function down(): void
    {
        Schema::table('product_qr_lists', function (Blueprint $table) {
            $table->dropColumn(['elevenlabs_kb_id', 'kb_rag_status', 'kb_name']);
        });
    }
};
