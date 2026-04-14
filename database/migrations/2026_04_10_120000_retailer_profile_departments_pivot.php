<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('retailer_department_retailer_profile', function (Blueprint $table) {
            $table->foreignId('retailer_profile_id')->constrained('retailer_profiles')->cascadeOnDelete();
            $table->foreignId('retailer_department_id')->constrained('retailer_departments')->cascadeOnDelete();
            $table->primary(['retailer_profile_id', 'retailer_department_id']);
        });

        if (Schema::hasColumn('retailer_profiles', 'department_id')) {
            $rows = DB::table('retailer_profiles')
                ->whereNotNull('department_id')
                ->get(['id', 'department_id']);

            foreach ($rows as $row) {
                DB::table('retailer_department_retailer_profile')->insert([
                    'retailer_profile_id' => $row->id,
                    'retailer_department_id' => $row->department_id,
                ]);
            }

            Schema::table('retailer_profiles', function (Blueprint $table) {
                $table->dropForeign(['department_id']);
            });

            Schema::table('retailer_profiles', function (Blueprint $table) {
                $table->dropColumn('department_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('retailer_department_retailer_profile');

        Schema::table('retailer_profiles', function (Blueprint $table) {
            $table->unsignedBigInteger('department_id')->nullable()->after('handle');
        });

        Schema::table('retailer_profiles', function (Blueprint $table) {
            $table->foreign('department_id')
                ->references('id')
                ->on('retailer_departments')
                ->nullOnDelete();
        });
    }
};
