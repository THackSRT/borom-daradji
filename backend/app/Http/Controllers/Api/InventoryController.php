<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Inventory;
use App\Models\InventoryLine;
use App\Services\InventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Inventaires physiques (« stock.inventory ») : comptage, validation (ajustements), historique.
 */
class InventoryController extends Controller
{
    public function __construct(private readonly InventoryService $inventories) {}

    public function index(Request $request): JsonResponse
    {
        $this->allow($request);
        $list = Inventory::query()->with(['category', 'author', 'validator'])->withCount([
            'lines', 'lines as counted_count' => fn ($q) => $q->whereNotNull('counted_quantity'),
        ])->latest('id')->limit(50)->get();

        return response()->json(['data' => $list->map(fn (Inventory $i) => $this->summary($i, $request))]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->allow($request);
        $data = $request->validate([
            'counted_on' => ['nullable', 'date', 'before_or_equal:today'],
            'article_category_id' => ['nullable', 'integer', 'exists:article_categories,id'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ], [], ['counted_on' => 'date', 'article_category_id' => 'catégorie']);

        return response()->json(['data' => $this->detailed($this->inventories->start($data, $request->user()), $request)], 201);
    }

    public function show(Request $request, Inventory $inventory): JsonResponse
    {
        $this->allow($request);

        return response()->json(['data' => $this->detailed($inventory, $request)]);
    }

    public function update(Request $request, Inventory $inventory): JsonResponse
    {
        $this->allow($request);
        $data = $request->validate([
            'counts' => ['required', 'array', 'min:1'],
            'counts.*.article_id' => ['required', 'integer'],
            'counts.*.counted_quantity' => ['nullable', 'numeric', 'min:0'],
            'counts.*.note' => ['nullable', 'string', 'max:255'],
        ], [], ['counts.*.counted_quantity' => 'quantité comptée']);
        $this->inventories->count($inventory, $data['counts']);

        return response()->json(['data' => $this->detailed($inventory, $request)]);
    }

    public function validateCount(Request $request, Inventory $inventory): JsonResponse
    {
        $this->allow($request);

        return response()->json(['data' => $this->detailed($this->inventories->validate($inventory, $request->user()), $request)]);
    }

    public function destroy(Request $request, Inventory $inventory): JsonResponse
    {
        $this->allow($request);
        $this->inventories->discard($inventory);

        return response()->json(null, 204);
    }

    private function allow(Request $request): void
    {
        abort_unless($request->user()->hasPermission('stock.inventory'), 403);
    }

    /**
     * @return array<string, mixed>
     */
    private function summary(Inventory $inventory, Request $request): array
    {
        $costs = $request->user()->hasPermission('stock.costs');

        return [
            'id' => $inventory->id,
            'number' => $inventory->number,
            'counted_on' => $inventory->counted_on->toDateString(),
            'status' => ['value' => $inventory->status, 'label' => $inventory->isValidated() ? 'Validé' : 'En cours'],
            'category' => $inventory->category ? ['id' => $inventory->category->id, 'name' => $inventory->category->name] : null,
            'notes' => $inventory->notes,
            'lines_count' => $inventory->lines_count ?? $inventory->lines()->count(),
            'counted_count' => $inventory->counted_count ?? $inventory->lines()->whereNotNull('counted_quantity')->count(),
            'value_difference' => $costs ? $inventory->value_difference : null,
            'author' => $inventory->author?->only(['id', 'name']),
            'validated_at' => $inventory->validated_at?->toIso8601String(),
            'validator' => $inventory->validator?->only(['id', 'name']),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function detailed(Inventory $inventory, Request $request): array
    {
        $inventory->load(['category', 'author', 'validator']);
        $costs = $request->user()->hasPermission('stock.costs');
        $lines = $inventory->lines()->with('article.category')->get()->sortBy(fn (InventoryLine $l) => [$l->article->category?->name ?? 'zzz', $l->article->name])->values();

        return [
            ...$this->summary($inventory, $request),
            'lines' => $lines->map(fn (InventoryLine $l) => [
                'article' => [
                    'id' => $l->article->id, 'reference' => $l->article->reference, 'name' => $l->article->name, 'unit' => $l->article->unit,
                    'location' => $l->article->location, 'category' => $l->article->category?->name,
                    // Stock théorique affiché seulement après validation : on compte sans se laisser influencer.
                    'quantity' => $inventory->isValidated() ? null : ($request->boolean('show_expected') ? $l->article->quantity : null),
                ],
                'counted_quantity' => $l->counted_quantity,
                'expected_quantity' => $l->expected_quantity,
                'difference' => $l->difference,
                'value_difference' => $costs ? $l->value_difference : null,
                'note' => $l->note,
            ]),
        ];
    }
}
