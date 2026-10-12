<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lot 3, équipes et argent du chantier : tâcherons, pointage journalier, travaux à la tâche, avances
 * et paiements, caisse de chantier (approvisionnements, dépenses avec reçu, retours).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workers', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('phone', 20)->nullable()->unique();
            $table->foreignId('trade_id')->nullable()->constrained();
            // Payé à la journée (pointage) ou à la tâche (travaux convenus).
            $table->string('pay_type', 20)->default('journalier');
            $table->bigInteger('daily_rate')->default(0);
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestamps();
        });

        Schema::create('worksite_attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('worksite_id')->constrained();
            $table->foreignId('worker_id')->constrained();
            $table->date('worked_on');
            $table->decimal('days', 3, 1)->default(1);
            $table->bigInteger('daily_rate');
            $table->bigInteger('amount');
            $table->string('note', 255)->nullable();
            $table->uuid('client_uuid')->nullable()->unique();
            $table->foreignId('recorded_by')->nullable()->constrained('users');
            $table->timestamps();

            $table->unique(['worksite_id', 'worker_id', 'worked_on']);
        });

        Schema::create('worker_tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('worksite_id')->constrained();
            $table->foreignId('worker_id')->constrained();
            $table->string('description', 255);
            $table->bigInteger('amount');
            $table->string('status', 20)->default('en_cours');
            $table->date('completed_on')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestamps();
        });

        Schema::create('site_cash_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('worksite_id')->constrained();
            $table->string('kind', 20);
            $table->string('category', 20)->nullable();
            $table->bigInteger('amount');
            $table->string('label', 255);
            $table->date('spent_on');
            $table->string('receipt_path')->nullable();
            $table->foreignId('holder_id')->nullable()->constrained('users');
            // Approvisionnement ou retour passé par la caisse du jour de l'agence.
            $table->foreignId('cash_movement_id')->nullable()->constrained();
            $table->uuid('client_uuid')->nullable()->unique();
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users');
            $table->string('cancel_reason', 500)->nullable();
            $table->timestamps();

            $table->index(['worksite_id', 'kind']);
        });

        Schema::create('worker_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('worker_id')->constrained();
            $table->foreignId('worksite_id')->nullable()->constrained();
            $table->string('kind', 20);
            $table->bigInteger('amount');
            $table->date('paid_on');
            $table->string('method', 20);
            $table->string('reference', 100)->nullable();
            $table->string('note', 255)->nullable();
            // Payé avec la caisse du chantier : la sortie y est inscrite.
            $table->foreignId('site_cash_entry_id')->nullable()->constrained();
            $table->foreignId('paid_by')->nullable()->constrained('users');
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users');
            $table->string('cancel_reason', 500)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('worker_payments');
        Schema::dropIfExists('site_cash_entries');
        Schema::dropIfExists('worker_tasks');
        Schema::dropIfExists('worksite_attendances');
        Schema::dropIfExists('workers');
    }
};
