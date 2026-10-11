<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lot 3, chantiers : lots et avancement, journal, photos datées et géolocalisées.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('worksites', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 30)->unique();
            $table->foreignId('client_id')->constrained();
            $table->foreignId('property_id')->nullable()->constrained();
            $table->foreignId('quote_id')->nullable()->constrained();
            $table->string('title', 255);
            $table->string('address', 255)->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('status', 20)->default('planifie');
            $table->foreignId('manager_id')->nullable()->constrained('users');
            $table->date('start_date')->nullable();
            $table->date('planned_end_date')->nullable();
            $table->date('actual_end_date')->nullable();
            // Montant du marché (devis accepté) : base des acomptes, situations et solde.
            $table->bigInteger('contract_ht')->default(0);
            $table->bigInteger('contract_total')->default(0);
            // Budget de coût prévu ; le coût réel vient des dépenses, du pointage et (lot 4) du stock.
            $table->bigInteger('budget_materials')->default(0);
            $table->bigInteger('budget_labor')->default(0);
            $table->bigInteger('budget_other')->default(0);
            $table->timestamp('budget_alerted_at')->nullable();
            $table->string('tracking_token', 64)->nullable()->unique();
            $table->timestamp('tracking_enabled_at')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'manager_id']);
        });

        Schema::table('quotes', function (Blueprint $table) {
            $table->foreignId('worksite_id')->nullable()->after('property_id')->constrained();
        });

        Schema::create('worksite_lots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('worksite_id')->constrained()->cascadeOnDelete();
            $table->foreignId('quote_lot_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('trade_id')->nullable()->constrained();
            $table->string('title', 255);
            $table->bigInteger('amount_ht')->default(0);
            $table->unsignedTinyInteger('progress')->default(0);
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('worksite_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('worksite_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained();
            $table->string('kind', 20)->default('note');
            $table->date('logged_on');
            $table->text('body');
            // Visible du client sur le lien de suivi.
            $table->boolean('is_public')->default(false);
            $table->timestamps();

            $table->index(['worksite_id', 'logged_on']);
        });

        Schema::create('worksite_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('worksite_id')->constrained()->cascadeOnDelete();
            $table->foreignId('worksite_lot_id')->nullable()->constrained()->nullOnDelete();
            $table->string('path');
            $table->string('caption', 255)->nullable();
            $table->timestamp('taken_at');
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->boolean('is_public')->default(true);
            // Saisie hors ligne : identifiant créé sur le téléphone, évite les doublons à la synchronisation.
            $table->uuid('client_uuid')->nullable()->unique();
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('worksite_photos');
        Schema::dropIfExists('worksite_logs');
        Schema::dropIfExists('worksite_lots');
        Schema::table('quotes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('worksite_id');
        });
        Schema::dropIfExists('worksites');
    }
};
