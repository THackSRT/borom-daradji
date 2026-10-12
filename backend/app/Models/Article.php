<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Article en stock (ciment, fer de 10, sable…). La quantité et le coût moyen pondéré ne se modifient
 * jamais à la main : ils suivent les mouvements (App\Services\StockService). Désactivé plutôt que
 * supprimé.
 */
#[Fillable([
    'reference', 'name', 'article_category_id', 'unit', 'sale_price', 'vat_rate', 'min_quantity', 'max_quantity',
    'location', 'supplier_id', 'is_active', 'notes', 'created_by',
])]
class Article extends Model
{
    use LogsActivity;

    protected $attributes = [
        'purchase_price' => 0, 'sale_price' => 0, 'vat_rate' => 18, 'min_quantity' => 0,
        'quantity' => 0, 'average_cost' => 0, 'is_active' => true,
    ];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'purchase_price' => 'integer',
            'sale_price' => 'integer',
            'vat_rate' => 'float',
            'min_quantity' => 'float',
            'max_quantity' => 'float',
            'quantity' => 'float',
            'average_cost' => 'float',
            'is_active' => 'boolean',
            'low_stock_alerted_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<ArticleCategory, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(ArticleCategory::class, 'article_category_id');
    }

    /**
     * @return BelongsTo<Client, $this>
     */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'supplier_id')->withTrashed();
    }

    /**
     * @return HasMany<StockMovement, $this>
     */
    public function movements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    /**
     * @return HasMany<PurchaseLine, $this>
     */
    public function purchaseLines(): HasMany
    {
        return $this->hasMany(PurchaseLine::class);
    }

    /** Valeur du stock au coût moyen pondéré, au franc. */
    public function stockValue(): int
    {
        return (int) round($this->quantity * $this->average_cost);
    }

    public function isLow(): bool
    {
        return $this->min_quantity > 0 && $this->quantity <= $this->min_quantity;
    }

    /**
     * @param  Builder<Article>  $query
     */
    public function scopeLow(Builder $query): void
    {
        $query->where('min_quantity', '>', 0)->whereColumn('quantity', '<=', 'min_quantity');
    }
}
