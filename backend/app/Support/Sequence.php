<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * Compteurs annuels sans trou ni doublon (références de biens, numéros de facture…).
 * La ligne du compteur est verrouillée pendant l'incrément.
 */
final class Sequence
{
    public static function next(string $key, ?int $year = null): int
    {
        $year ??= (int) now()->year;

        return DB::transaction(function () use ($key, $year) {
            DB::table('sequences')->insertOrIgnore([
                'key' => $key,
                'year' => $year,
                'last_value' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $row = DB::table('sequences')->where('key', $key)->where('year', $year)->lockForUpdate()->first();
            $next = $row->last_value + 1;

            DB::table('sequences')->where('id', $row->id)->update(['last_value' => $next, 'updated_at' => now()]);

            return $next;
        });
    }
}
