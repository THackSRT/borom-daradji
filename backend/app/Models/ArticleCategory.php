<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Catégorie d'articles (ciment, fers, agrégats…). Désactivée plutôt que supprimée.
 */
#[Fillable(['name', 'position', 'is_active'])]
class ArticleCategory extends Model
{
    use LogsActivity;

    protected $attributes = ['position' => 0, 'is_active' => true];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'position' => 'integer'];
    }

    /**
     * @return HasMany<Article, $this>
     */
    public function articles(): HasMany
    {
        return $this->hasMany(Article::class);
    }
}
