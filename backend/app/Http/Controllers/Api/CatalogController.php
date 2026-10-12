<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CatalogItem;
use App\Models\Trade;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Catalogue des travaux : corps de métier et prestations (désignation, unité, prix HT).
 * Lecture pour qui prépare ou consulte des devis ; écriture « works.catalog ».
 */
class CatalogController extends Controller
{
    public function trades(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission('works.view', 'works.quotes', 'works.catalog'), 403);

        $trades = Trade::query()
            ->when(! $request->boolean('all'), fn ($q) => $q->where('is_active', true))
            ->withCount(['items' => fn ($q) => $q->where('is_active', true)])
            ->orderBy('position')->orderBy('name')->get();

        return response()->json(['data' => $trades->map(fn (Trade $t) => [
            'id' => $t->id, 'name' => $t->name, 'position' => $t->position, 'is_active' => $t->is_active, 'items_count' => $t->items_count,
        ])]);
    }

    public function storeTrade(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission('works.catalog'), 403);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80', 'unique:trades,name'],
            'position' => ['nullable', 'integer', 'min:0'],
        ], [], ['name' => 'corps de métier']);

        $trade = Trade::create([...$data, 'position' => $data['position'] ?? ((int) Trade::max('position') + 1)]);

        return response()->json(['data' => $trade->only(['id', 'name', 'position', 'is_active'])], 201);
    }

    public function updateTrade(Request $request, Trade $trade): JsonResponse
    {
        abort_unless($request->user()->hasPermission('works.catalog'), 403);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:80', Rule::unique('trades', 'name')->ignore($trade->id)],
            'position' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ], [], ['name' => 'corps de métier']);
        $trade->update($data);

        return response()->json(['data' => $trade->only(['id', 'name', 'position', 'is_active'])]);
    }

    public function items(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission('works.view', 'works.quotes', 'works.catalog'), 403);

        $items = CatalogItem::query()->with('trade:id,name')
            ->when(! $request->boolean('all'), fn ($q) => $q->where('is_active', true))
            ->when($request->filled('trade_id'), fn ($q) => $q->where('trade_id', $request->query('trade_id')))
            ->when(trim((string) $request->query('search')), fn ($q, $s) => $q->whereLike('designation', "%{$s}%"))
            ->orderBy('designation')
            ->limit(min((int) $request->query('limit', 200), 500))
            ->get();

        return response()->json(['data' => $items->map(fn (CatalogItem $i) => $this->item($i))]);
    }

    public function storeItem(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission('works.catalog'), 403);
        $item = CatalogItem::create($this->validateItem($request));

        return response()->json(['data' => $this->item($item->load('trade:id,name'))], 201);
    }

    public function updateItem(Request $request, CatalogItem $item): JsonResponse
    {
        abort_unless($request->user()->hasPermission('works.catalog'), 403);
        $item->update($this->validateItem($request, partial: true));

        return response()->json(['data' => $this->item($item->load('trade:id,name'))]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validateItem(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'trade_id' => [$required, 'integer', 'exists:trades,id'],
            'designation' => [$required, 'string', 'max:255'],
            'unit' => [$required, 'string', 'max:20'],
            'unit_price' => [$required, 'integer', 'min:0'],
            'vat_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'description' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['sometimes', 'boolean'],
        ], [], ['trade_id' => 'corps de métier', 'designation' => 'désignation', 'unit' => 'unité', 'unit_price' => 'prix unitaire', 'vat_rate' => 'TVA']);
    }

    /**
     * @return array<string, mixed>
     */
    private function item(CatalogItem $i): array
    {
        return [
            'id' => $i->id,
            'trade' => $i->trade ? ['id' => $i->trade->id, 'name' => $i->trade->name] : null,
            'designation' => $i->designation,
            'unit' => $i->unit,
            'unit_price' => $i->unit_price,
            'vat_rate' => $i->vat_rate !== null ? (float) $i->vat_rate : null,
            'description' => $i->description,
            'is_active' => $i->is_active,
        ];
    }
}
