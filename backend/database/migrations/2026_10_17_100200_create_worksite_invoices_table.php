<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lot 3, facturation des travaux : chaque facture d'un chantier (acompte, situation, solde) garde le
 * cumul facturé par lot et la part d'acompte déduite, base de la situation suivante.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('worksite_invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('worksite_id')->constrained();
            $table->foreignId('invoice_id')->unique()->constrained();
            $table->string('kind', 20);
            $table->unsignedSmallInteger('sequence')->default(0);
            // Valeur HT des travaux facturés en cumul (situations), acompte HT (acomptes), part d'acompte déduite.
            $table->bigInteger('cumulative_ht')->default(0);
            $table->bigInteger('deposit_ht')->default(0);
            $table->bigInteger('deposit_deducted_ht')->default(0);
            $table->json('lots');
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestamps();

            $table->index(['worksite_id', 'kind']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('worksite_invoices');
    }
};
