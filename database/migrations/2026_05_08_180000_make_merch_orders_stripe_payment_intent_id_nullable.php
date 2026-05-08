<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('merch_orders', function (Blueprint $table) {
            $table->dropUnique(['stripe_payment_intent_id']);
        });

        Schema::table('merch_orders', function (Blueprint $table) {
            $table->string('stripe_payment_intent_id')->nullable()->unique()->change();
        });
    }

    public function down(): void
    {
        Schema::table('merch_orders', function (Blueprint $table) {
            $table->dropUnique(['stripe_payment_intent_id']);
        });

        Schema::table('merch_orders', function (Blueprint $table) {
            $table->string('stripe_payment_intent_id')->nullable(false)->unique()->change();
        });
    }
};
