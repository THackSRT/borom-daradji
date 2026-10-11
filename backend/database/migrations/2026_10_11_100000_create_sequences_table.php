<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Compteurs par clé et par année (références de biens, puis numéros de facture au lot 2).
     */
    public function up(): void
    {
        Schema::create('sequences', function (Blueprint $table) {
            $table->id();
            $table->string('key', 50);
            $table->unsignedSmallInteger('year');
            $table->unsignedInteger('last_value')->default(0);
            $table->timestamps();

            $table->unique(['key', 'year']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sequences');
    }
};
