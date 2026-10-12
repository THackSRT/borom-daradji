<?php

namespace App\Http\Controllers\Api;

use App\Enums\InspectionType;
use App\Enums\ItemCondition;
use App\Http\Controllers\Controller;
use App\Http\Resources\LeaseInspectionResource;
use App\Models\Lease;
use App\Models\LeaseInspection;
use App\Models\LeaseInspectionPhoto;
use App\Services\InspectionService;
use App\Support\ActivityLogger;
use App\Support\InvoicePdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class LeaseInspectionController extends Controller
{
    public function __construct(private readonly InspectionService $inspections) {}

    public function store(Request $request, Lease $lease): JsonResponse
    {
        Gate::authorize('update', $lease);
        $data = $request->validate([
            'type' => ['required', Rule::enum(InspectionType::class)],
            'inspected_on' => ['nullable', 'date'],
            ...$this->headerRules(),
        ], [], $this->attributes());

        $inspection = $this->inspections->create($lease, InspectionType::from($data['type']), collect($data)->except('type')->all(), $request->user());

        return (new LeaseInspectionResource($this->loaded($inspection)))->response()->setStatusCode(201);
    }

    public function show(LeaseInspection $inspection): LeaseInspectionResource
    {
        Gate::authorize('view', $inspection->lease);

        return new LeaseInspectionResource($this->loaded($inspection));
    }

    public function update(Request $request, LeaseInspection $inspection): LeaseInspectionResource
    {
        Gate::authorize('update', $inspection->lease);
        $data = $request->validate([
            'inspected_on' => ['sometimes', 'date'],
            ...$this->headerRules(),
            'items' => ['sometimes', 'array', 'max:300'],
            'items.*.id' => ['nullable', 'integer'],
            'items.*.room' => ['required', 'string', 'max:80'],
            'items.*.element' => ['required', 'string', 'max:80'],
            'items.*.condition' => ['nullable', Rule::enum(ItemCondition::class)],
            'items.*.comment' => ['nullable', 'string', 'max:1000'],
        ], [], $this->attributes());

        $this->inspections->update($inspection, collect($data)->except('items')->all(), $data['items'] ?? null);

        return new LeaseInspectionResource($this->loaded($inspection));
    }

    public function validateInspection(Request $request, LeaseInspection $inspection): LeaseInspectionResource
    {
        Gate::authorize('update', $inspection->lease);
        $this->inspections->validate($inspection, $request->user());

        return new LeaseInspectionResource($this->loaded($inspection));
    }

    public function destroy(LeaseInspection $inspection): Response
    {
        Gate::authorize('update', $inspection->lease);
        $this->inspections->delete($inspection);

        return response()->noContent();
    }

    public function storePhoto(Request $request, LeaseInspection $inspection): LeaseInspectionResource
    {
        Gate::authorize('update', $inspection->lease);
        $data = $request->validate([
            'photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
            'item_id' => ['nullable', 'integer'],
        ], [], ['photo' => 'photo', 'item_id' => 'élément']);

        $this->inspections->addPhoto($inspection, $request->file('photo'), isset($data['item_id']) ? (int) $data['item_id'] : null, $request->user());

        return new LeaseInspectionResource($this->loaded($inspection));
    }

    public function photo(LeaseInspection $inspection, LeaseInspectionPhoto $photo): StreamedResponse
    {
        Gate::authorize('view', $inspection->lease);
        abort_unless($photo->lease_inspection_id === $inspection->id, 404);

        return Storage::disk('local')->response($photo->path, "photo-{$photo->id}.webp", [
            'Cache-Control' => 'private, max-age=86400',
        ]);
    }

    public function destroyPhoto(LeaseInspection $inspection, LeaseInspectionPhoto $photo): LeaseInspectionResource
    {
        Gate::authorize('update', $inspection->lease);
        abort_unless($photo->lease_inspection_id === $inspection->id, 404);
        $this->inspections->deletePhoto($inspection, $photo);

        return new LeaseInspectionResource($this->loaded($inspection));
    }

    public function pdf(LeaseInspection $inspection): Response
    {
        Gate::authorize('view', $inspection->lease);
        ActivityLogger::log('downloaded', $inspection, "{$inspection->type->label()} du bail {$inspection->lease->reference}");

        return InvoicePdf::inspection($this->loaded($inspection), $this->inspections->comparison($inspection));
    }

    /**
     * @return array<string, list<mixed>>
     */
    private function headerRules(): array
    {
        return [
            'inspector_id' => ['nullable', 'integer', 'exists:users,id'],
            'tenant_present' => ['sometimes', 'boolean'],
            'electricity_meter' => ['nullable', 'string', 'max:40'],
            'water_meter' => ['nullable', 'string', 'max:40'],
            'keys_count' => ['nullable', 'integer', 'min:0', 'max:100'],
            'general_comment' => ['nullable', 'string', 'max:5000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    private function attributes(): array
    {
        return [
            'type' => 'type', 'inspected_on' => 'date', 'inspector_id' => 'personne qui fait l\'état des lieux',
            'electricity_meter' => 'compteur d\'électricité', 'water_meter' => 'compteur d\'eau', 'keys_count' => 'nombre de clés',
            'general_comment' => 'observations', 'items.*.room' => 'pièce', 'items.*.element' => 'élément',
            'items.*.condition' => 'état', 'items.*.comment' => 'commentaire',
        ];
    }

    private function loaded(LeaseInspection $inspection): LeaseInspection
    {
        return $inspection->fresh(['lease.property', 'lease.tenant', 'inspector', 'validator', 'items', 'photos']);
    }
}
