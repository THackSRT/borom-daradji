<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\Storage;

/**
 * Image du site : une adresse https, ou un fichier envoyé depuis « Site internet » (dossier site/).
 */
class SiteImage implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || strlen($value) > 500) {
            $fail('Image invalide.');

            return;
        }

        if (str_starts_with($value, 'https://') && filter_var($value, FILTER_VALIDATE_URL)) {
            return;
        }

        if (! preg_match('#^site/[A-Za-z0-9-]+\.webp$#', $value) || ! Storage::disk('public')->exists($value)) {
            $fail('Image introuvable : envoyez-la de nouveau.');
        }
    }
}
