<?php

use App\Support\PermissionCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Lot 3, travaux : corps de métier, catalogue de prestations, devis par lots (et modèles de devis).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trades', function (Blueprint $table) {
            $table->id();
            $table->string('name', 80)->unique();
            $table->unsignedSmallInteger('position')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('catalog_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trade_id')->constrained();
            $table->string('designation', 255);
            $table->string('unit', 20);
            $table->bigInteger('unit_price');
            $table->decimal('vat_rate', 5, 2)->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['trade_id', 'is_active']);
        });

        Schema::create('quotes', function (Blueprint $table) {
            $table->id();
            $table->string('number', 30)->nullable()->unique();
            // Modèle réutilisable : pas de client, pas de numéro, jamais envoyé.
            $table->boolean('is_template')->default(false);
            $table->string('template_name', 120)->nullable();
            $table->foreignId('client_id')->nullable()->constrained();
            $table->foreignId('property_id')->nullable()->constrained();
            $table->string('title', 255);
            $table->string('site_address', 255)->nullable();
            $table->string('status', 20)->default('brouillon');
            $table->date('issue_date')->nullable();
            $table->date('valid_until')->nullable();
            $table->decimal('discount_rate', 5, 2)->default(0);
            $table->decimal('deposit_rate', 5, 2)->default(0);
            $table->bigInteger('subtotal')->default(0);
            $table->bigInteger('discount_amount')->default(0);
            $table->bigInteger('total_ht')->default(0);
            $table->bigInteger('vat_total')->default(0);
            $table->bigInteger('total')->default(0);
            $table->text('conditions')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->string('refusal_reason', 500)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'is_template']);
        });

        Schema::create('quote_lots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quote_id')->constrained()->cascadeOnDelete();
            $table->foreignId('trade_id')->nullable()->constrained();
            $table->string('title', 255);
            $table->unsignedSmallInteger('position')->default(0);
            $table->bigInteger('total_ht')->default(0);
            $table->timestamps();
        });

        Schema::create('quote_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quote_lot_id')->constrained()->cascadeOnDelete();
            $table->foreignId('catalog_item_id')->nullable()->constrained()->nullOnDelete();
            $table->string('designation', 500);
            $table->string('unit', 20)->nullable();
            $table->decimal('quantity', 12, 2)->default(1);
            $table->bigInteger('unit_price');
            $table->decimal('vat_rate', 5, 2)->default(0);
            // Montant HT avant remise, puis HT et TVA après remise, arrondis au franc par ligne.
            $table->bigInteger('amount');
            $table->bigInteger('net_amount');
            $table->bigInteger('vat_amount');
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
        });

        // Corps de métier proposés au départ (config/borom.php), modifiables ensuite.
        $now = now();
        DB::table('trades')->insert(array_map(
            fn (string $name, int $i) => ['name' => $name, 'position' => $i + 1, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            config('borom.default_trades'),
            array_keys(config('borom.default_trades')),
        ));

        // Nouvelles permissions « works.* ».
        PermissionCatalog::sync();
    }

    public function down(): void
    {
        Schema::dropIfExists('quote_lines');
        Schema::dropIfExists('quote_lots');
        Schema::dropIfExists('quotes');
        Schema::dropIfExists('catalog_items');
        Schema::dropIfExists('trades');
    }
};
