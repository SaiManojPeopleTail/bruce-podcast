<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('retailer_profiles')) {
            return;
        }
        if (! Schema::hasColumn('retailer_profiles', 'notes')) {
            Schema::table('retailer_profiles', function (Blueprint $table) {
                $table->text('notes')->nullable()->after('description');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('retailer_profiles') && Schema::hasColumn('retailer_profiles', 'notes')) {
            Schema::table('retailer_profiles', function (Blueprint $table) {
                $table->dropColumn('notes');
            });
        }
    }
};
