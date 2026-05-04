<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_qr_lists', function (Blueprint $table) {
            $table->string('notification_email')->nullable()->after('product_name');
        });

        Schema::table('product_enquiries', function (Blueprint $table) {
            $table->string('notification_status', 32)->default('na')->after('message');
            $table->text('notification_error')->nullable()->after('notification_status');
        });
    }

    public function down(): void
    {
        Schema::table('product_qr_lists', function (Blueprint $table) {
            $table->dropColumn('notification_email');
        });

        Schema::table('product_enquiries', function (Blueprint $table) {
            $table->dropColumn(['notification_status', 'notification_error']);
        });
    }
};
