<?php

namespace App\Support;

/**
 * Numéros de téléphone : le téléphone sert d'identifiant client, il doit donc être stocké sous une forme
 * unique quelle que soit la saisie.
 *
 * - Numéros sénégalais (« 77 123 45 67 », « 00221 77… », « +221 77… ») → +221XXXXXXXXX.
 * - Numéros étrangers saisis avec l'indicatif (« +33 6 12 34 56 78 », « 0033… ») → +<indicatif><numéro>,
 *   pour les clients de la diaspora.
 */
final class PhoneNumber
{
    private const COUNTRY_CODE = '221';

    /**
     * Renvoie le numéro au format international, ou null si la saisie n'est pas un numéro exploitable.
     */
    public static function normalize(?string $input): ?string
    {
        if ($input === null) {
            return null;
        }

        $trimmed = trim($input);
        $digits = preg_replace('/\D+/', '', $trimmed) ?? '';
        $international = str_starts_with($trimmed, '+');

        if (str_starts_with($digits, '00')) {
            $digits = substr($digits, 2);
            $international = true;
        }

        if ($international || (strlen($digits) === 12 && str_starts_with($digits, self::COUNTRY_CODE))) {
            if (str_starts_with($digits, self::COUNTRY_CODE)) {
                return self::senegalese(substr($digits, 3));
            }

            // Autre pays : 8 à 15 chiffres (norme E.164), sans 0 en tête.
            return $international && preg_match('/^[1-9]\d{7,14}$/', $digits) ? '+'.$digits : null;
        }

        return self::senegalese($digits);
    }

    public static function isValid(?string $input): bool
    {
        return self::normalize($input) !== null;
    }

    /**
     * Mobiles (7X) et fixes (3X) sénégalais : 9 chiffres.
     */
    private static function senegalese(string $digits): ?string
    {
        return preg_match('/^[37]\d{8}$/', $digits) ? '+'.self::COUNTRY_CODE.$digits : null;
    }
}
