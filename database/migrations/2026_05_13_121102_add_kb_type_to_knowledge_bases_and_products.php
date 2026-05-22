<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('elevenlabs_knowledge_bases', function (Blueprint $table) {
            $table->string('kb_type')->default('file')->after('kb_name'); // 'file' | 'text' | 'url'
        });

        Schema::table('product_qr_lists', function (Blueprint $table) {
            $table->string('kb_type')->nullable()->after('kb_name');
        });
    }

    public function down(): void
    {
        Schema::table('elevenlabs_knowledge_bases', function (Blueprint $table) {
            $table->dropColumn('kb_type');
        });

        Schema::table('product_qr_lists', function (Blueprint $table) {
            $table->dropColumn('kb_type');
        });
    }
};
