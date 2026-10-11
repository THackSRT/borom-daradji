<?php

use App\Support\PermissionCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lot 2, gestion locative : baux, appels de loyer (une facture par mois), reversements aux propriétaires.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('owner_payouts', function (Blueprint $table) {
            $table->id();
            $table->string('number', 30)->unique();
            $table->foreignId('owner_id')->constrained('clients');
            $table->date('period');
            $table->bigInteger('collected');
            $table->bigInteger('commission');
            $table->bigInteger('commission_vat');
            $table->bigInteger('expenses');
            $table->bigInteger('net');
            $table->json('details');
            $table->string('method', 20);
            $table->string('reference', 100)->nullable();
            $table->date('paid_on');
            $table->text('note')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users');
            $table->string('cancel_reason', 500)->nullable();
            $table->timestamps();

            $table->index(['owner_id', 'period']);
        });

        Schema::create('leases', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 30)->unique();
            $table->foreignId('property_id')->constrained();
            $table->foreignId('tenant_id')->constrained('clients');
            $table->foreignId('owner_id')->nullable()->constrained('clients');
            $table->foreignId('agent_id')->nullable()->constrained('users');
            $table->date('start_date');
            $table->date('end_date')->nullable();
            // Premier mois facturé : après les mois payés d'avance à l'entrée.
            $table->date('billing_start');
            $table->bigInteger('rent');
            $table->bigInteger('charges')->default(0);
            $table->bigInteger('deposit')->default(0);
            $table->unsignedTinyInteger('advance_months')->default(0);
            $table->unsignedTinyInteger('due_day')->default(5);
            $table->decimal('rent_vat_rate', 5, 2)->default(0);
            // Gestion locative : l'agence encaisse pour le propriétaire et lui reverse, moins sa commission.
            $table->boolean('managed')->default(false);
            $table->decimal('commission_rate', 5, 2)->default(0);
            $table->string('status', 20)->default('actif');
            $table->date('terminated_on')->nullable();
            $table->string('termination_reason', 500)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('entry_invoice_id')->nullable()->constrained('invoices');
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestamps();

            $table->index(['status', 'property_id']);
        });

        Schema::create('rent_calls', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lease_id')->constrained();
            $table->date('period');
            $table->foreignId('invoice_id')->constrained();
            $table->timestamps();

            $table->unique(['lease_id', 'period']);
        });

        Schema::table('payments', function (Blueprint $table) {
            // Loyer encaissé déjà reversé au propriétaire : il ne compte pas deux fois.
            $table->foreignId('owner_payout_id')->nullable()->after('cash_session_id')->constrained();
        });

        // Nouvelles permissions « leases.* » et « payouts.* ».
        PermissionCatalog::sync();
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('owner_payout_id');
        });
        Schema::dropIfExists('rent_calls');
        Schema::dropIfExists('leases');
        Schema::dropIfExists('owner_payouts');
    }
};
