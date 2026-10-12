<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Ligne d'achat : article, quantité reçue, prix d'achat unitaire HT. Sert aussi d'historique des prix
 * d'achat de l'article.
 */
#[Fillable(['article_id', 'quantity', 'unit_cost', 'vat_rate', 'amount', 'vat_amount'])]
class PurchaseLine extends Model
{
    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return ['quantity' => 'float', 'unit_cost' => 'integer', 'vat_rate' => 'float', 'amount' => 'integer', 'vat_amount' => 'integer'];
    }

    /**
     * @return BelongsTo<Purchase, $this>
     */
    public function purchase(): BelongsTo
    {
        return $this->belongsTo(Purchase::class);
    }

    /**
     * @return BelongsTo<Article, $this>
     */
    public function article(): BelongsTo
    {
        return $this->belongsTo(Article::class);
    }
}
