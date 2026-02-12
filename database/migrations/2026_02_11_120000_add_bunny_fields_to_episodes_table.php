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
        Schema::table('episodes', function (Blueprint $table) {
            $table->string('bunny_video_id')->nullable()->after('long_description');
            $table->string('bunny_library_id')->nullable()->after('bunny_video_id');
            $table->string('thumbnail_url')->nullable()->after('bunny_library_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('episodes', function (Blueprint $table) {
            $table->dropColumn(['bunny_video_id', 'bunny_library_id', 'thumbnail_url']);
        });
    }
};
