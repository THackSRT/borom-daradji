<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lot 5 : numéros de compte SYSCOHADA choisis par l'agence pour les exports comptables (seules les
 * valeurs modifiées ; les autres viennent de config/borom.php).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->json('accounting')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->dropColumn('accounting');
        });
    }
};
