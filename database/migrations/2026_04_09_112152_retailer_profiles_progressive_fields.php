<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Fix databases that ran the original retailer_profiles migration (wrong FKs, required fields).
     * Skips when retailer_profiles already has the progressive schema (handle column).
     */
    public function up(): void
    {
        if (! Schema::hasTable('retailer_profiles') || Schema::hasColumn('retailer_profiles', 'handle')) {
            return;
        }

        Schema::dropIfExists('retailer_contacts');
        Schema::dropIfExists('retailer_phone_numbers');
        Schema::dropIfExists('retailer_profiles');

        Schema::create('retailer_profiles', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('handle')->unique();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->text('description')->nullable();
            $table->string('address_line_1')->nullable();
            $table->string('address_line_2')->nullable();
            $table->string('city')->nullable();
            $table->string('state')->nullable();
            $table->string('zip')->nullable();
            $table->string('country')->default('Canada');
            $table->string('email')->nullable();
            $table->string('website')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('department_id')
                ->references('id')
                ->on('retailer_departments')
                ->nullOnDelete();
        });

        Schema::create('retailer_contacts', function (Blueprint $table) {
            $table->id();
            $table->string('contact_name');
            $table->string('title');
            $table->string('email');
            $table->string('linkedin');
            $table->foreignId('retailer_profile_id')->constrained('retailer_profiles')->cascadeOnDelete();
            $table->timestamps();
        });

        Schema::create('retailer_phone_numbers', function (Blueprint $table) {
            $table->id();
            $table->string('phone_number');
            $table->foreignId('retailer_profile_id')->constrained('retailer_profiles')->cascadeOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No safe rollback to the legacy schema.
    }
};
