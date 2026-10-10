<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('properties', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 20)->unique();
            $table->string('slug')->unique();
            $table->string('title');
            $table->string('type', 20)->index();
            $table->string('transaction', 20)->index();
            $table->string('status', 20)->default('brouillon')->index();
            // Francs CFA entiers ; pour une location, loyer mensuel.
            $table->unsignedBigInteger('price');
            $table->unsignedBigInteger('charges')->nullable();
            $table->unsignedTinyInteger('deposit_months')->nullable();
            $table->unsignedTinyInteger('advance_months')->nullable();
            $table->unsignedInteger('surface')->nullable();
            $table->unsignedInteger('land_surface')->nullable();
            $table->unsignedTinyInteger('rooms')->nullable();
            $table->unsignedTinyInteger('bedrooms')->nullable();
            $table->unsignedTinyInteger('bathrooms')->nullable();
            $table->json('features');
            $table->string('city', 100)->index();
            $table->string('neighborhood', 100)->nullable()->index();
            $table->string('address')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->text('description')->nullable();
            $table->string('land_status', 30)->default('inconnu');
            $table->string('land_reference', 100)->nullable();
            $table->foreignId('owner_id')->nullable()->constrained('clients')->nullOnDelete();
            $table->foreignId('agent_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('is_featured')->default(false);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('property_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('property_id')->constrained()->cascadeOnDelete();
            $table->string('path');
            $table->unsignedSmallInteger('position')->default(0);
            $table->boolean('is_cover')->default(false);
            $table->timestamps();
        });

        Schema::create('property_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('property_id')->constrained()->cascadeOnDelete();
            $table->string('type', 30);
            $table->string('path');
            $table->string('original_name');
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('property_checks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('property_id')->constrained()->cascadeOnDelete();
            $table->string('item', 40);
            $table->string('status', 20)->default('a_faire');
            $table->text('note')->nullable();
            $table->foreignId('document_id')->nullable()->constrained('property_documents')->nullOnDelete();
            $table->foreignId('checked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('checked_at')->nullable();
            $table->timestamps();

            $table->unique(['property_id', 'item']);
        });

        Schema::create('property_status_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('property_id')->constrained()->cascadeOnDelete();
            $table->string('from', 20)->nullable();
            $table->string('to', 20);
            $table->string('reason')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('mandates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('property_id')->constrained()->cascadeOnDelete();
            $table->foreignId('owner_id')->nullable()->constrained('clients')->nullOnDelete();
            $table->string('type', 20);
            $table->date('starts_on');
            $table->date('ends_on')->index();
            $table->string('commission_type', 20);
            // Pourcentage (ex. 5.00) ou montant en francs CFA selon commission_type.
            $table->decimal('commission_value', 14, 2);
            $table->string('status', 20)->default('actif')->index();
            $table->text('conditions')->nullable();
            $table->timestamp('expiry_alerted_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mandates');
        Schema::dropIfExists('property_status_changes');
        Schema::dropIfExists('property_checks');
        Schema::dropIfExists('property_documents');
        Schema::dropIfExists('property_photos');
        Schema::dropIfExists('properties');
    }
};
