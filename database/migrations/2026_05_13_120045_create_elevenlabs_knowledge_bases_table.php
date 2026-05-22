<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('elevenlabs_knowledge_bases', function (Blueprint $table) {
            $table->string('elevenlabs_kb_id')->primary();
            $table->string('kb_name');
            $table->string('kb_rag_status')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('elevenlabs_knowledge_bases');
    }
};
