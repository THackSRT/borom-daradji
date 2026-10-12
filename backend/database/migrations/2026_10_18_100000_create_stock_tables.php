<?php

use App\Support\PermissionCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Lot 4, stock et négoce : articles, mouvements valorisés au coût moyen unitaire pondéré (CMUP), achats
 * aux fournisseurs et leurs paiements, inventaires physiques, lien entre lignes de facture et articles
 * (vente au comptoir).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('article_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100)->unique();
            $table->unsignedSmallInteger('position')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
        $now = now();
        foreach (config('borom.default_article_categories', []) as $i => $name) {
            DB::table('article_categories')->insert(['name' => $name, 'position' => $i + 1, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now]);
        }

        Schema::create('articles', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 30)->unique();
            $table->string('name', 160);
            $table->foreignId('article_category_id')->nullable()->constrained();
            $table->string('unit', 20);
            $table->bigInteger('purchase_price')->default(0);
            $table->bigInteger('sale_price')->default(0);
            $table->decimal('vat_rate', 5, 2)->default(18);
            $table->decimal('min_quantity', 12, 2)->default(0);
            $table->decimal('max_quantity', 12, 2)->nullable();
            $table->string('location', 100)->nullable();
            // Quantité en stock et coût moyen pondéré : tenus à jour par chaque mouvement (StockService).
            $table->decimal('quantity', 12, 2)->default(0);
            $table->decimal('average_cost', 14, 4)->default(0);
            $table->foreignId('supplier_id')->nullable()->constrained('clients');
            $table->boolean('is_active')->default(true);
            $table->timestamp('low_stock_alerted_at')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestamps();
        });

        Schema::create('purchases', function (Blueprint $table) {
            $table->id();
            $table->string('number', 30)->unique();
            $table->foreignId('supplier_id')->constrained('clients');
            $table->string('supplier_reference', 100)->nullable();
            $table->date('received_on');
            $table->bigInteger('subtotal')->default(0);
            $table->bigInteger('vat_total')->default(0);
            $table->bigInteger('total')->default(0);
            $table->bigInteger('paid_total')->default(0);
            $table->date('due_date')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users');
            $table->string('cancel_reason', 500)->nullable();
            $table->timestamps();
        });

        Schema::create('purchase_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_id')->constrained()->cascadeOnDelete();
            $table->foreignId('article_id')->constrained();
            $table->decimal('quantity', 12, 2);
            $table->bigInteger('unit_cost');
            $table->decimal('vat_rate', 5, 2)->default(18);
            $table->bigInteger('amount');
            $table->bigInteger('vat_amount');
            $table->timestamps();
        });

        Schema::create('supplier_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_id')->constrained();
            $table->bigInteger('amount');
            $table->date('paid_on');
            $table->string('method', 20);
            $table->string('reference', 100)->nullable();
            $table->string('note', 255)->nullable();
            $table->foreignId('cash_movement_id')->nullable()->constrained();
            $table->foreignId('paid_by')->nullable()->constrained('users');
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users');
            $table->string('cancel_reason', 500)->nullable();
            $table->timestamps();
        });

        Schema::create('inventories', function (Blueprint $table) {
            $table->id();
            $table->string('number', 30)->unique();
            $table->date('counted_on');
            $table->foreignId('article_category_id')->nullable()->constrained();
            $table->string('status', 20)->default('en_cours');
            $table->text('notes')->nullable();
            $table->bigInteger('value_difference')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestamp('validated_at')->nullable();
            $table->foreignId('validated_by')->nullable()->constrained('users');
            $table->timestamps();
        });

        Schema::create('inventory_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_id')->constrained()->cascadeOnDelete();
            $table->foreignId('article_id')->constrained();
            $table->decimal('counted_quantity', 12, 2)->nullable();
            // Figés à la validation : stock théorique à ce moment, écart et sa valeur au CMUP.
            $table->decimal('expected_quantity', 12, 2)->nullable();
            $table->decimal('difference', 12, 2)->nullable();
            $table->bigInteger('value_difference')->nullable();
            $table->string('note', 255)->nullable();
            $table->timestamps();

            $table->unique(['inventory_id', 'article_id']);
        });

        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('article_id')->constrained();
            $table->string('type', 20);
            // Quantité signée (+ entrée, − sortie) et valeur signée en francs, au coût du mouvement.
            $table->decimal('quantity', 12, 2);
            $table->decimal('unit_cost', 14, 4);
            $table->bigInteger('value');
            $table->decimal('quantity_after', 12, 2);
            $table->decimal('average_cost_after', 14, 4);
            $table->date('moved_on');
            $table->string('reason', 255)->nullable();
            $table->foreignId('worksite_id')->nullable()->constrained();
            $table->foreignId('purchase_id')->nullable()->constrained();
            $table->foreignId('invoice_id')->nullable()->constrained();
            $table->foreignId('inventory_id')->nullable()->constrained();
            $table->foreignId('reverses_id')->nullable()->constrained('stock_movements');
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestamps();

            $table->index(['article_id', 'id']);
            $table->index(['worksite_id', 'type']);
        });

        Schema::table('invoice_lines', function (Blueprint $table) {
            $table->foreignId('article_id')->nullable()->after('invoice_id')->constrained();
        });

        PermissionCatalog::sync();
    }

    public function down(): void
    {
        Schema::table('invoice_lines', function (Blueprint $table) {
            $table->dropConstrainedForeignId('article_id');
        });
        Schema::dropIfExists('stock_movements');
        Schema::dropIfExists('inventory_lines');
        Schema::dropIfExists('inventories');
        Schema::dropIfExists('supplier_payments');
        Schema::dropIfExists('purchase_lines');
        Schema::dropIfExists('purchases');
        Schema::dropIfExists('articles');
        Schema::dropIfExists('article_categories');
    }
};
