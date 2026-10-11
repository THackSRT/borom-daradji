<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lot 2 : factures et avoirs, encaissements, caisse journalière. Montants en francs CFA entiers.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->string('type', 20)->default('facture');
            // Attribué à l'émission seulement : un brouillon supprimé ne laisse pas de trou.
            $table->string('number', 30)->nullable()->unique();
            $table->string('status', 20)->default('brouillon');
            $table->foreignId('client_id')->constrained();
            $table->foreignId('property_id')->nullable()->constrained();
            $table->string('activity', 20)->default('immobilier');
            $table->foreignId('credited_invoice_id')->nullable()->constrained('invoices');
            $table->date('issue_date')->nullable();
            $table->date('due_date')->nullable();
            $table->bigInteger('subtotal')->default(0);
            $table->bigInteger('vat_total')->default(0);
            $table->bigInteger('total')->default(0);
            $table->bigInteger('paid_total')->default(0);
            $table->bigInteger('credited_total')->default(0);
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->foreignId('issued_by')->nullable()->constrained('users');
            $table->timestamp('issued_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'due_date']);
        });

        Schema::create('invoice_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('position')->default(0);
            $table->string('description', 500);
            $table->decimal('quantity', 12, 2)->default(1);
            $table->string('unit', 20)->nullable();
            $table->bigInteger('unit_price');
            $table->decimal('vat_rate', 5, 2)->default(0);
            $table->bigInteger('amount');
            $table->bigInteger('vat_amount');
            $table->timestamps();
        });

        Schema::create('cash_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained();
            $table->date('date');
            $table->bigInteger('opening_amount')->default(0);
            $table->bigInteger('expected_amount')->nullable();
            $table->bigInteger('counted_amount')->nullable();
            $table->bigInteger('difference')->nullable();
            $table->text('closing_note')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->foreignId('closed_by')->nullable()->constrained('users');
            $table->timestamps();

            $table->unique(['user_id', 'date']);
        });

        Schema::create('cash_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cash_session_id')->constrained();
            $table->string('type', 20);
            $table->bigInteger('amount');
            $table->string('label', 255);
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->string('number', 30)->unique();
            $table->foreignId('invoice_id')->constrained();
            $table->foreignId('client_id')->constrained();
            $table->string('method', 20);
            $table->bigInteger('amount');
            $table->date('paid_on');
            $table->string('reference', 100)->nullable();
            $table->string('proof_path')->nullable();
            $table->text('note')->nullable();
            $table->foreignId('received_by')->constrained('users');
            $table->foreignId('cash_session_id')->nullable()->constrained();
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users');
            $table->string('cancel_reason', 500)->nullable();
            $table->timestamps();

            $table->index(['method', 'reference']);
            $table->index('paid_on');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
        Schema::dropIfExists('cash_movements');
        Schema::dropIfExists('cash_sessions');
        Schema::dropIfExists('invoice_lines');
        Schema::dropIfExists('invoices');
    }
};
