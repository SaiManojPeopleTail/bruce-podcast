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
        // Contact_name	Title	Email	Linkedin retailer_profile_id
        Schema::create('retailer_contacts', function (Blueprint $table) {
            $table->id();
            $table->string('contact_name');
            $table->string('title');
            $table->string('email');
            $table->string('linkedin');
            $table->foreignId('retailer_profile_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('retailer_contacts');
    }
};
