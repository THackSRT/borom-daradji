<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clients', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 20)->default('particulier');
            $table->string('name');
            $table->string('phone', 20)->nullable()->unique();
            $table->string('whatsapp', 20)->nullable();
            $table->string('email')->nullable()->index();
            $table->json('categories');
            $table->string('city')->nullable();
            $table->string('address')->nullable();
            $table->string('source', 30)->nullable();
            $table->string('pipeline_status', 20)->default('nouveau')->index();
            $table->char('solvency', 1)->nullable();
            $table->json('tags');
            $table->foreignId('assigned_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('last_contact_at')->nullable()->index();
            $table->text('private_notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('client_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->string('type', 30);
            $table->string('path');
            $table->string('original_name');
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('search_criteria', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->string('transaction', 20);
            $table->json('types');
            $table->unsignedBigInteger('budget_min')->nullable();
            $table->unsignedBigInteger('budget_max')->nullable();
            $table->json('cities');
            $table->json('neighborhoods');
            $table->unsignedTinyInteger('rooms_min')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('search_criteria');
        Schema::dropIfExists('client_documents');
        Schema::dropIfExists('clients');
    }
};
