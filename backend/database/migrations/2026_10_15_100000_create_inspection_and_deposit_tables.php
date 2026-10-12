<?php

use App\Support\PermissionCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lot 2, fin de la gestion locative : états des lieux d'entrée et de sortie (pièces, état, photos)
 * et restitution de la caution en fin de bail.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lease_inspections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lease_id')->constrained();
            $table->string('type', 10);
            $table->date('inspected_on');
            $table->foreignId('inspector_id')->nullable()->constrained('users');
            $table->boolean('tenant_present')->default(true);
            $table->string('electricity_meter', 40)->nullable();
            $table->string('water_meter', 40)->nullable();
            $table->unsignedSmallInteger('keys_count')->nullable();
            $table->text('general_comment')->nullable();
            // Validé : figé, plus aucune modification (pièce opposable en cas de litige).
            $table->timestamp('validated_at')->nullable();
            $table->foreignId('validated_by')->nullable()->constrained('users');
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestamps();

            $table->unique(['lease_id', 'type']);
        });

        Schema::create('lease_inspection_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lease_inspection_id')->constrained()->cascadeOnDelete();
            $table->string('room', 80);
            $table->string('element', 80);
            $table->string('condition', 20)->nullable();
            $table->text('comment')->nullable();
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('lease_inspection_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lease_inspection_id')->constrained()->cascadeOnDelete();
            $table->foreignId('lease_inspection_item_id')->nullable()->constrained()->nullOnDelete();
            $table->string('path');
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestamps();
        });

        Schema::create('deposit_settlements', function (Blueprint $table) {
            $table->id();
            $table->string('number', 30)->unique();
            $table->foreignId('lease_id')->unique()->constrained();
            $table->foreignId('exit_inspection_id')->nullable()->constrained('lease_inspections');
            $table->bigInteger('deposit_held');
            $table->bigInteger('arrears_retained')->default(0);
            $table->bigInteger('deductions_total')->default(0);
            $table->json('deductions');
            $table->bigInteger('refund')->default(0);
            // Retenues supérieures à la caution : le reste est facturé au locataire (brouillon).
            $table->bigInteger('balance_due')->default(0);
            $table->foreignId('balance_invoice_id')->nullable()->constrained('invoices');
            $table->string('refund_method', 20)->nullable();
            $table->string('refund_reference', 100)->nullable();
            $table->date('settled_on');
            $table->foreignId('cash_movement_id')->nullable()->constrained();
            $table->text('note')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
        });

        Schema::table('payments', function (Blueprint $table) {
            // Loyer impayé retenu sur la caution : encaissement « caution » rattaché à la restitution.
            $table->foreignId('deposit_settlement_id')->nullable()->after('owner_payout_id')->constrained();
        });

        // Nouvelle permission « deposits.settle ».
        PermissionCatalog::sync();
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('deposit_settlement_id');
        });
        Schema::dropIfExists('deposit_settlements');
        Schema::dropIfExists('lease_inspection_photos');
        Schema::dropIfExists('lease_inspection_items');
        Schema::dropIfExists('lease_inspections');
    }
};
