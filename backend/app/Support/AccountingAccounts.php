<?php

namespace App\Support;

use App\Models\CompanySetting;

/**
 * Numéros de compte des exports comptables : valeurs par défaut (config/borom.php) remplacées par
 * celles que l'agence a modifiées (company_settings.accounting).
 */
final class AccountingAccounts
{
    /**
     * @return array<string, mixed>
     */
    public static function current(): array
    {
        return array_replace_recursive(config('borom.accounting'), CompanySetting::current()->accounting ?? []);
    }

    /**
     * Garde seulement ce qui diffère des valeurs par défaut.
     *
     * @param  array<string, mixed>  $accounts
     */
    public static function save(array $accounts): void
    {
        CompanySetting::current()->forceFill(['accounting' => self::diff($accounts, config('borom.accounting')) ?: null])->save();
    }

    /** Compte de tiers d'un client ou fournisseur : préfixe + numéro sur 5 chiffres (C00023). */
    public static function tiers(string $prefix, int $id): string
    {
        return $prefix.str_pad((string) $id, 5, '0', STR_PAD_LEFT);
    }

    /**
     * @param  array<string, mixed>  $values
     * @param  array<string, mixed>  $defaults
     * @return array<string, mixed>
     */
    private static function diff(array $values, array $defaults): array
    {
        $out = [];
        foreach ($defaults as $key => $default) {
            if (! array_key_exists($key, $values)) {
                continue;
            }
            if (is_array($default)) {
                $nested = self::diff((array) $values[$key], $default);
                if ($nested) {
                    $out[$key] = $nested;
                }
            } elseif ((string) $values[$key] !== (string) $default) {
                $out[$key] = (string) $values[$key];
            }
        }

        return $out;
    }
}
