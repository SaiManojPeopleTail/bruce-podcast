<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_scrapes', function (Blueprint $table) {
            $table->id();
            $table->string('platform', 32);
            $table->string('source_url', 2048);
            $table->char('source_url_hash', 64)->unique();
            $table->text('notes')->nullable();
            $table->foreignId('saved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('social_scrape_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_scrape_id')->constrained('social_scrapes')->cascadeOnDelete();
            $table->string('type', 16)->default('image');
            $table->text('media_url')->nullable();
            $table->text('description')->nullable();
            $table->string('post_url', 2048)->nullable();
            $table->char('post_url_hash', 64)->nullable();
            $table->timestamp('posted_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['social_scrape_id', 'post_url_hash']);
            $table->index(['social_scrape_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_scrape_posts');
        Schema::dropIfExists('social_scrapes');
    }
};
