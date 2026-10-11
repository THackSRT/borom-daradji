<?php

namespace App\Http\Controllers\Api;

use App\Enums\StockMovementType;
use App\Http\Controllers\Controller;
use App\Http\Resources\ArticleResource;
use App\Http\Resources\StockMovementResource;
use App\Models\Article;
use App\Models\ArticleCategory;
use App\Models\PurchaseLine;
use App\Models\StockMovement;
use App\Services\StockOperations;
use App\Services\StockService;
use App\Support\Sequence;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/**
 * Articles du stock et catégories ; journal des mouvements ; pertes et corrections.
 */
class ArticleController extends Controller
{
    public function __construct(private readonly StockOperations $operations) {}

    public function categories(Request $request): JsonResponse
    {
        $this->allow($request, 'stock.view', 'stock.sell', 'stock.purchases');
        $query = ArticleCategory::query()->withCount(['articles' => fn ($q) => $q->where('is_active', true)])->orderBy('position')->orderBy('name');
        if (! $request->boolean('all')) {
            $query->where('is_active', true);
        }

        return response()->json(['data' => $query->get()->map(fn (ArticleCategory $c) => [
            'id' => $c->id, 'name' => $c->name, 'position' => $c->position, 'is_active' => $c->is_active, 'articles_count' => $c->articles_count,
        ])]);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $this->allow($request, 'stock.manage');
        $data = $request->validate(['name' => ['required', 'string', 'max:100', 'unique:article_categories,name']], [], ['name' => 'nom']);
        $category = ArticleCategory::create([...$data, 'position' => (int) ArticleCategory::max('position') + 1]);

        return response()->json(['data' => $category->only(['id', 'name', 'position', 'is_active'])], 201);
    }

    public function updateCategory(Request $request, ArticleCategory $category): JsonResponse
    {
        $this->allow($request, 'stock.manage');
        $category->update($request->validate([
            'name' => ['sometimes', 'string', 'max:100', Rule::unique('article_categories', 'name')->ignore($category)],
            'position' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ], [], ['name' => 'nom']));

        return response()->json(['data' => $category->only(['id', 'name', 'position', 'is_active'])]);
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->allow($request, 'stock.view', 'stock.sell', 'stock.purchases');
        $query = Article::query()->with(['category', 'supplier']);
        if ($search = trim((string) $request->query('search'))) {
            $query->where(fn ($q) => $q->whereLike('name', "%{$search}%")->orWhereLike('reference', "%{$search}%")->orWhereLike('location', "%{$search}%"));
        }
        if ($request->filled('category_id')) {
            $query->where('article_category_id', $request->query('category_id'));
        }
        if ($request->boolean('low')) {
            $query->low();
        }
        if ($request->boolean('in_stock')) {
            $query->where('quantity', '>', 0);
        }
        if (! $request->boolean('all')) {
            $query->where('is_active', true);
        }

        $active = Article::query()->where('is_active', true);
        $summary = [
            'articles' => (clone $active)->count(),
            'low' => (clone $active)->low()->count(),
            'out_of_stock' => (clone $active)->where('quantity', '<=', 0)->count(),
        ];
        if ($request->user()->hasPermission('stock.costs')) {
            $summary['stock_value'] = (int) round((float) (clone $active)->where('quantity', '>', 0)->selectRaw('sum(quantity * average_cost) as v')->value('v'));
        }

        return ArticleResource::collection($query->orderBy('name')->paginate(min((int) $request->query('per_page', 50), 500)))
            ->additional(['summary' => $summary]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->allow($request, 'stock.manage');
        $data = $this->validated($request);
        $data['reference'] = trim((string) ($data['reference'] ?? '')) ?: sprintf('ART-%04d', Sequence::next('article', 0));
        $article = Article::create([...$data, 'created_by' => $request->user()->id]);

        return (new ArticleResource($article->load(['category', 'supplier'])))->response()->setStatusCode(201);
    }

    public function show(Request $request, Article $article): JsonResponse
    {
        $this->allow($request, 'stock.view', 'stock.sell', 'stock.purchases');
        $article->load(['category', 'supplier']);
        $costs = $request->user()->hasPermission('stock.costs');

        return response()->json(['data' => [
            ...(new ArticleResource($article))->toArray($request),
            'movements' => StockMovementResource::collection(
                $article->movements()->with(['worksite', 'purchase', 'invoice', 'author'])->latest('id')->limit((int) $request->query('limit', 100))->get()
            )->toArray($request),
            // Historique des prix d'achat (achats valides).
            'purchase_prices' => ! $costs ? null : PurchaseLine::query()->where('article_id', $article->id)
                ->whereHas('purchase', fn ($q) => $q->whereNull('cancelled_at'))
                ->with('purchase.supplier')->latest('id')->limit(30)->get()
                ->map(fn (PurchaseLine $l) => [
                    'purchase' => ['id' => $l->purchase->id, 'number' => $l->purchase->number],
                    'received_on' => $l->purchase->received_on->toDateString(),
                    'supplier' => $l->purchase->supplier->name,
                    'quantity' => $l->quantity,
                    'unit_cost' => $l->unit_cost,
                ]),
            'can' => [
                'manage' => $request->user()->hasPermission('stock.manage'),
                'issue' => $request->user()->hasPermission('stock.issue'),
                'inventory' => $request->user()->hasPermission('stock.inventory'),
            ],
        ]]);
    }

    public function update(Request $request, Article $article): ArticleResource
    {
        $this->allow($request, 'stock.manage');
        $article->update($this->validated($request, $article));
        app(StockService::class)->checkLowStock($article->fresh());

        return new ArticleResource($article->fresh()->load(['category', 'supplier']));
    }

    /** Perte ou casse : motif obligatoire. */
    public function loss(Request $request, Article $article): JsonResponse
    {
        $this->allow($request, 'stock.issue');
        $data = $request->validate([
            'quantity' => ['required', 'numeric', 'gt:0'],
            'reason' => ['required', 'string', 'max:255'],
            'moved_on' => ['nullable', 'date', 'before_or_equal:today'],
        ], [], ['quantity' => 'quantité', 'reason' => 'motif']);
        $movement = $this->operations->loss($article, (float) $data['quantity'], $data['reason'], $data['moved_on'] ?? null, $request->user());

        return response()->json(['data' => (new StockMovementResource($movement->load('article')))->toArray($request)], 201);
    }

    /** Correction ponctuelle à la quantité constatée, motif obligatoire. */
    public function correction(Request $request, Article $article): JsonResponse
    {
        $this->allow($request, 'stock.inventory');
        $data = $request->validate([
            'counted_quantity' => ['required', 'numeric', 'min:0'],
            'reason' => ['required', 'string', 'max:255'],
        ], [], ['counted_quantity' => 'quantité constatée', 'reason' => 'motif']);
        $movement = $this->operations->correct($article, (float) $data['counted_quantity'], $data['reason'], $request->user());
        if (! $movement) {
            return response()->json(['message' => 'Aucun écart : le stock est déjà à cette quantité.', 'errors' => ['counted_quantity' => ['Aucun écart : le stock est déjà à cette quantité.']]], 422);
        }

        return response()->json(['data' => (new StockMovementResource($movement->load('article')))->toArray($request)], 201);
    }

    /** Journal des mouvements, tous articles. */
    public function movements(Request $request): AnonymousResourceCollection
    {
        $this->allow($request, 'stock.view');
        $filters = $request->validate([
            'type' => ['nullable', Rule::enum(StockMovementType::class)],
            'article_id' => ['nullable', 'integer'],
            'worksite_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);
        $query = StockMovement::query()->with(['article', 'worksite', 'purchase', 'invoice', 'author'])
            ->when($filters['type'] ?? null, fn ($q, $v) => $q->where('type', $v))
            ->when($filters['article_id'] ?? null, fn ($q, $v) => $q->where('article_id', $v))
            ->when($filters['worksite_id'] ?? null, fn ($q, $v) => $q->where('worksite_id', $v))
            ->when($filters['from'] ?? null, fn ($q, $v) => $q->whereDate('moved_on', '>=', $v))
            ->when($filters['to'] ?? null, fn ($q, $v) => $q->whereDate('moved_on', '<=', $v));

        return StockMovementResource::collection($query->latest('moved_on')->latest('id')->paginate(min((int) $request->query('per_page', 50), 200)));
    }

    private function allow(Request $request, string ...$permissions): void
    {
        abort_unless($request->user()->hasPermission(...$permissions), 403);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Article $article = null): array
    {
        $required = $article ? 'sometimes' : 'required';

        return $request->validate([
            'reference' => ['nullable', 'string', 'max:30', Rule::unique('articles', 'reference')->ignore($article)],
            'name' => [$required, 'string', 'max:160'],
            'article_category_id' => ['nullable', 'integer', 'exists:article_categories,id'],
            'unit' => [$required, 'string', 'max:20'],
            'sale_price' => ['sometimes', 'integer', 'min:0'],
            'vat_rate' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'min_quantity' => ['sometimes', 'numeric', 'min:0'],
            'max_quantity' => ['nullable', 'numeric', 'min:0', 'gte:min_quantity'],
            'location' => ['nullable', 'string', 'max:100'],
            'supplier_id' => ['nullable', 'integer', 'exists:clients,id'],
            'is_active' => ['sometimes', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ], [], [
            'reference' => 'référence', 'name' => 'désignation', 'article_category_id' => 'catégorie', 'unit' => 'unité', 'sale_price' => 'prix de vente',
            'vat_rate' => 'TVA', 'min_quantity' => 'seuil d\'alerte', 'max_quantity' => 'stock maximum', 'location' => 'emplacement', 'supplier_id' => 'fournisseur',
        ]);
    }
}
