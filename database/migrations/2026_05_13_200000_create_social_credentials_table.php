<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_credentials', function (Blueprint $table) {
            $table->id();
            $table->string('platform');
            $table->string('label');
            $table->text('username');
            $table->text('password');
            $table->longText('storage_state')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_credentials');
    }
};
