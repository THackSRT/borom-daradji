<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lot 2, finitions : relances automatiques des impayés, alerte de fin de bail, annulation d'une
 * restitution de caution (une nouvelle restitution devient alors possible).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            // Dernier palier de relance atteint (1 = J+3, 2 = J+15, 3 = J+30 par défaut).
            $table->unsignedTinyInteger('reminder_level')->default(0);
            $table->timestamp('last_reminded_at')->nullable();
        });

        Schema::table('leases', function (Blueprint $table) {
            $table->timestamp('end_alerted_at')->nullable();
        });

        Schema::table('deposit_settlements', function (Blueprint $table) {
            $table->dropUnique(['lease_id']);
            $table->index('lease_id');
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users');
            $table->string('cancel_reason', 500)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('deposit_settlements', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cancelled_by');
            $table->dropColumn(['cancelled_at', 'cancel_reason']);
            $table->dropIndex(['lease_id']);
            $table->unique('lease_id');
        });
        Schema::table('leases', function (Blueprint $table) {
            $table->dropColumn('end_alerted_at');
        });
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['reminder_level', 'last_reminded_at']);
        });
    }
};
