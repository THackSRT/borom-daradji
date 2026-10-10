<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

/**
 * Paramètres de l'entreprise : une seule ligne, utilisée sur les factures,
 * quittances, devis et le site vitrine.
 */
#[Fillable([
    'trade_name', 'legal_name', 'ninea', 'rccm', 'address', 'city', 'phone', 'whatsapp',
    'email', 'website', 'bank_name', 'bank_account', 'vat_rate', 'invoice_footer',
])]
class CompanySetting extends Model
{
    use LogsActivity;

    protected $attributes = [
        'trade_name' => 'Borom Daradji',
        'city' => 'Dakar',
        'vat_rate' => 18,
        'currency' => 'XOF',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'vat_rate' => 'decimal:2',
        ];
    }

    public static function current(): self
    {
        $settings = static::query()->firstOrCreate([]);

        // La ligne est créée à la première lecture : ce n'est pas une création côté API (pas de 201).
        $settings->wasRecentlyCreated = false;

        return $settings;
    }

    public function logoUrl(): ?string
    {
        return $this->logo_path ? Storage::disk('public')->url($this->logo_path) : null;
    }
}
