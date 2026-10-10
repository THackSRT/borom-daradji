<?php

namespace App\Support;

/**
 * Numéros sénégalais : le téléphone sert d'identifiant client, il doit donc
 * être stocké sous une forme unique (+221XXXXXXXXX) quelle que soit la saisie.
 */
final class PhoneNumber
{
    private const COUNTRY_CODE = '221';

    /**
     * Normalise une saisie libre (« 77 123 45 67 », « 00221771234567 »…) en +221XXXXXXXXX.
     * Renvoie null si la saisie ne ressemble pas à un numéro sénégalais.
     */
    public static function normalize(?string $input): ?string
    {
        if ($input === null) {
            return null;
        }

        $digits = preg_replace('/\D+/', '', $input) ?? '';

        if (str_starts_with($digits, '00'.self::COUNTRY_CODE)) {
            $digits = substr($digits, 5);
        } elseif (strlen($digits) === 12 && str_starts_with($digits, self::COUNTRY_CODE)) {
            $digits = substr($digits, 3);
        }

        // Mobiles (7X) et fixes (3X) : 9 chiffres.
        if (! preg_match('/^[37]\d{8}$/', $digits)) {
            return null;
        }

        return '+'.self::COUNTRY_CODE.$digits;
    }

    public static function isValid(?string $input): bool
    {
        return self::normalize($input) !== null;
    }
}
