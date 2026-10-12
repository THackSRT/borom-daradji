<?php

namespace App\Http\Controllers\Api;

use App\Enums\PropertyStatus;
use App\Enums\PropertyType;
use App\Enums\TransactionType;
use App\Http\Controllers\Controller;
use App\Http\Requests\PropertyRequest;
use App\Http\Resources\PropertyResource;
use App\Models\Property;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class PropertyController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Property::class);

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'type' => ['nullable', Rule::enum(PropertyType::class)],
            'transaction' => ['nullable', Rule::enum(TransactionType::class)],
            'status' => ['nullable', Rule::enum(PropertyStatus::class)],
            'city' => ['nullable', 'string', 'max:100'],
            'neighborhood' => ['nullable', 'string', 'max:100'],
            'agent_id' => ['nullable', 'integer'],
            'price_min' => ['nullable', 'integer', 'min:0'],
            'price_max' => ['nullable', 'integer', 'min:0'],
            'archived' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $base = Property::query()
            ->when($request->boolean('archived'), fn ($q) => $q->onlyTrashed())
            ->when($filters['search'] ?? null, fn ($q, $search) => $q->where(fn ($q) => $q
                ->whereLike('title', "%{$search}%")
                ->orWhereLike('reference', "%{$search}%")))
            ->when($filters['type'] ?? null, fn ($q, $v) => $q->where('type', $v))
            ->when($filters['transaction'] ?? null, fn ($q, $v) => $q->where('transaction', $v))
            ->when($filters['city'] ?? null, fn ($q, $v) => $q->where('city', $v))
            ->when($filters['neighborhood'] ?? null, fn ($q, $v) => $q->where('neighborhood', $v))
            ->when($filters['agent_id'] ?? null, fn ($q, $v) => $q->where('agent_id', $v))
            ->when($filters['price_min'] ?? null, fn ($q, $v) => $q->where('price', '>=', $v))
            ->when($filters['price_max'] ?? null, fn ($q, $v) => $q->where('price', '<=', $v));

        // Compteurs par statut avec les autres filtres appliqués : ils alimentent les filtres rapides de l'écran.
        $statusCounts = (clone $base)->toBase()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        $properties = $base
            ->with(['cover', 'agent:id,name', 'owner:id,name,phone'])
            ->withCount(['checks', 'checks as checks_cleared_count' => fn ($q) => $q->whereIn('status', ['ok', 'sans_objet'])])
            ->when($filters['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->latest()
            ->paginate($request->integer('per_page', 25) ?: 25)
            ->withQueryString();

        return PropertyResource::collection($properties)->additional([
            'status_counts' => collect(PropertyStatus::cases())->mapWithKeys(fn ($s) => [$s->value => (int) ($statusCounts[$s->value] ?? 0)]),
        ]);
    }

    public function store(PropertyRequest $request): PropertyResource
    {
        $user = $request->user();
        $property = new Property($request->validated());
        // Par défaut, l'agent qui saisit le bien en est responsable.
        // Le créateur devient l'agent du bien, sauf le dirigeant qui l'attribue lui-même.
        $property->agent_id ??= $user->isSuperAdmin() ? null : $user->id;
        $property->save();

        return new PropertyResource($property->load(['checks', 'photos', 'agent', 'owner']));
    }

    public function show(Property $property): PropertyResource
    {
        Gate::authorize('view', $property);

        return new PropertyResource($property->load([
            'cover', 'photos', 'checks.checker', 'owner', 'agent', 'statusChanges.user',
        ]));
    }

    public function update(PropertyRequest $request, Property $property): PropertyResource
    {
        $property->update($request->validated());

        return new PropertyResource($property->load(['cover', 'photos', 'checks.checker', 'owner', 'agent']));
    }

    /**
     * Archivage : le bien disparaît des listes et du site, son historique reste.
     */
    public function destroy(Property $property): Response
    {
        Gate::authorize('delete', $property);

        $property->delete();

        return response()->noContent();
    }
}
