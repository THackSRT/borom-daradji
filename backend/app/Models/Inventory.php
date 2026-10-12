<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Inventaire physique (`INV-AAAA-001`) : on compte, puis la validation ajuste le stock des écarts.
 * Figé une fois validé.
 */
#[Fillable(['counted_on', 'article_category_id', 'notes', 'created_by'])]
class Inventory extends Model
{
    use LogsActivity;

    protected $attributes = ['status' => 'en_cours', 'value_difference' => 0];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return ['counted_on' => 'immutable_date', 'value_difference' => 'integer', 'validated_at' => 'datetime'];
    }

    /**
     * @return HasMany<InventoryLine, $this>
     */
    public function lines(): HasMany
    {
        return $this->hasMany(InventoryLine::class);
    }

    /**
     * @return BelongsTo<ArticleCategory, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(ArticleCategory::class, 'article_category_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function validator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'validated_by');
    }

    public function isValidated(): bool
    {
        return $this->status === 'valide';
    }
}
