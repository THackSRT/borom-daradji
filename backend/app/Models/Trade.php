<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Corps de métier (maçonnerie, plomberie…) : regroupe les prestations du catalogue et les lots des devis.
 */
#[Fillable(['name', 'position', 'is_active'])]
class Trade extends Model
{
    use LogsActivity;

    protected $attributes = ['is_active' => true, 'position' => 0];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'position' => 'integer'];
    }

    /**
     * @return HasMany<CatalogItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(CatalogItem::class)->orderBy('designation');
    }
}
