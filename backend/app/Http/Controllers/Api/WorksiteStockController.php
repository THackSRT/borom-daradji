<?php

namespace App\Http\Controllers\Api;

use App\Enums\StockMovementType;
use App\Http\Controllers\Controller;
use App\Http\Resources\StockMovementResource;
use App\Models\Article;
use App\Models\StockMovement;
use App\Models\Worksite;
use App\Services\StockOperations;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Matériaux d'un chantier venant du stock : bons de sortie (« stock.issue »), retours, et ce qui est
 * parti sur le chantier (valeurs avec « stock.costs » ou « works.costs »).
 */
class WorksiteStockController extends Controller
{
    public function __construct(private readonly StockOperations $operations) {}

    public function index(Request $request, Worksite $worksite): JsonResponse
    {
        Gate::authorize('view', $worksite);
        abort_unless($request->user()->hasPermission('stock.view', 'stock.issue', 'works.costs'), 403);
        $costs = $request->user()->hasPermission('stock.costs', 'works.costs');
        $types = [StockMovementType::SortieChantier, StockMovementType::RetourChantier];

        $articles = StockMovement::query()->where('worksite_id', $worksite->id)->whereIn('type', $types)
            ->selectRaw('article_id, sum(quantity) as qty, sum(value) as val')->groupBy('article_id')->get();
        $names = Article::query()->whereIn('id', $articles->pluck('article_id'))->get()->keyBy('id');

        return response()->json(['data' => [
            'articles' => $articles->map(fn ($row) => [
                'article' => ['id' => $row->article_id, 'reference' => $names[$row->article_id]->reference, 'name' => $names[$row->article_id]->name, 'unit' => $names[$row->article_id]->unit],
                'quantity' => round(-(float) $row->qty, 2),
                'value' => $costs ? -(int) $row->val : null,
            ])->filter(fn ($a) => $a['quantity'] != 0)->sortBy('article.name')->values(),
            'total' => $costs ? -(int) $articles->sum('val') : null,
            'movements' => StockMovementResource::collection(
                StockMovement::query()->where('worksite_id', $worksite->id)->whereIn('type', $types)->with(['article', 'author'])->latest('id')->limit(100)->get()
            )->toArray($request),
            'can' => ['issue' => $request->user()->hasPermission('stock.issue')],
        ]]);
    }

    public function store(Request $request, Worksite $worksite): JsonResponse
    {
        abort_unless($request->user()->hasPermission('stock.issue'), 403);
        $data = $request->validate([
            'moved_on' => ['nullable', 'date', 'before_or_equal:today'],
            'note' => ['nullable', 'string', 'max:255'],
            'lines' => ['required', 'array', 'min:1', 'max:100'],
            'lines.*.article_id' => ['required', 'integer', 'distinct', Rule::exists('articles', 'id')],
            'lines.*.quantity' => ['required', 'numeric', 'gt:0'],
        ], [], ['lines' => 'articles', 'lines.*.article_id' => 'article', 'lines.*.quantity' => 'quantité', 'moved_on' => 'date']);

        $movements = $this->operations->toWorksite($worksite, $data['lines'], $data['moved_on'] ?? null, $data['note'] ?? null, $request->user());

        return response()->json(['data' => collect($movements)->map(fn ($m) => (new StockMovementResource($m->load('article')))->toArray($request))], 201);
    }

    public function return(Request $request, Worksite $worksite): JsonResponse
    {
        abort_unless($request->user()->hasPermission('stock.issue'), 403);
        $data = $request->validate([
            'article_id' => ['required', 'integer', 'exists:articles,id'],
            'quantity' => ['required', 'numeric', 'gt:0'],
            'note' => ['nullable', 'string', 'max:255'],
        ], [], ['article_id' => 'article', 'quantity' => 'quantité']);

        $movement = $this->operations->returnFromWorksite($worksite, Article::findOrFail($data['article_id']), (float) $data['quantity'], $data['note'] ?? null, $request->user());

        return response()->json(['data' => (new StockMovementResource($movement->load('article')))->toArray($request)], 201);
    }
}
