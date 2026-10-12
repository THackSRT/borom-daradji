<?php

namespace App\Rules;

use App\Support\PhoneNumber;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Numéro sénégalais, ou étranger avec son indicatif (clients de la diaspora). Voir PhoneNumber.
 */
class SenegalPhone implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! PhoneNumber::isValid($value)) {
            $fail('Numéro de téléphone invalide : format sénégalais (77 123 45 67) ou international avec indicatif (+33 6 12 34 56 78).');
        }
    }
}
