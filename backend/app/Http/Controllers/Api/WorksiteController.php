<?php

namespace App\Http\Controllers\Api;

use App\Enums\WorksiteStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\WorksiteResource;
use App\Models\Worksite;
use App\Models\WorksiteLog;
use App\Models\WorksiteLot;
use App\Models\WorksitePhoto;
use App\Services\WorksiteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class WorksiteController extends Controller
{
    public function __construct(private readonly WorksiteService $worksites) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Worksite::class);

        $query = Worksite::query()->with(['client', 'manager', 'lots']);
        if ($search = trim((string) $request->query('search'))) {
            $query->where(fn ($q) => $q->whereLike('reference', "%{$search}%")->orWhereLike('title', "%{$search}%")
                ->orWhereLike('address', "%{$search}%")
                ->orWhereHas('client', fn ($c) => $c->whereLike('name', "%{$search}%")));
        }
        match ($request->query('state')) {
            'ouverts' => $query->open(),
            'en_retard' => $query->open()->whereDate('planned_end_date', '<', today()),
            default => null,
        };
        foreach (['status', 'client_id', 'manager_id'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->query($filter));
            }
        }
        if ($request->boolean('mine')) {
            $query->where('manager_id', $request->user()->id);
        }

        return WorksiteResource::collection($query->orderByRaw("status = 'en_cours' desc")->latest('id')->paginate(min((int) $request->query('per_page', 25), 100)))
            ->additional(['summary' => [
                'open' => Worksite::query()->open()->count(),
                'in_progress' => Worksite::query()->where('status', WorksiteStatus::EnCours)->count(),
                'late' => Worksite::query()->open()->whereDate('planned_end_date', '<', today())->count(),
            ]]);
    }

    public function store(Request $request): JsonResponse
    {
        Gate::authorize('create', Worksite::class);
        $data = $request->validate([
            'client_id' => ['required', 'integer', 'exists:clients,id'],
            ...$this->headerRules(),
            'title' => ['required', 'string', 'max:255'],
        ], [], $this->attributes());

        $worksite = $this->worksites->create($data, $request->user());

        return (new WorksiteResource($this->loaded($worksite)))->response()->setStatusCode(201);
    }

    public function show(Worksite $worksite): WorksiteResource
    {
        Gate::authorize('view', $worksite);

        return new WorksiteResource($this->loaded($worksite));
    }

    public function update(Request $request, Worksite $worksite): WorksiteResource
    {
        Gate::authorize('update', $worksite);
        $data = $request->validate([
            ...$this->headerRules(),
            'title' => ['sometimes', 'string', 'max:255'],
            'budget_materials' => ['sometimes', 'integer', 'min:0'],
            'budget_labor' => ['sometimes', 'integer', 'min:0'],
            'budget_other' => ['sometimes', 'integer', 'min:0'],
        ], [], $this->attributes());
        if (array_intersect_key($data, array_flip(['budget_materials', 'budget_labor', 'budget_other']))) {
            Gate::authorize('viewCosts', $worksite);
        }
        $worksite->update($data);

        return new WorksiteResource($this->loaded($worksite));
    }

    public function transition(Request $request, Worksite $worksite): WorksiteResource
    {
        Gate::authorize('update', $worksite);
        $data = $request->validate([
            'status' => ['required', Rule::enum(WorksiteStatus::class)],
            'note' => ['nullable', 'string', 'max:1000'],
        ], [], ['status' => 'statut', 'note' => 'note']);

        $this->worksites->transition($worksite, WorksiteStatus::from($data['status']), $request->user(), $data['note'] ?? null);

        return new WorksiteResource($this->loaded($worksite));
    }

    public function progress(Request $request, Worksite $worksite, WorksiteLot $lot): WorksiteResource
    {
        Gate::authorize('update', $worksite);
        abort_unless($lot->worksite_id === $worksite->id, 404);
        $data = $request->validate(['progress' => ['required', 'integer', 'min:0', 'max:100']], [], ['progress' => 'avancement']);

        $this->worksites->setProgress($lot, (int) $data['progress'], $request->user());

        return new WorksiteResource($this->loaded($worksite));
    }

    public function storeLog(Request $request, Worksite $worksite): WorksiteResource
    {
        Gate::authorize('update', $worksite);
        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
            'is_public' => ['sometimes', 'boolean'],
            'logged_on' => ['nullable', 'date', 'before_or_equal:today'],
        ], [], ['body' => 'texte', 'logged_on' => 'date']);

        $this->worksites->log($worksite, $data['body'], $request->user(), 'note', (bool) ($data['is_public'] ?? false), $data['logged_on'] ?? null);

        return new WorksiteResource($this->loaded($worksite));
    }

    public function destroyLog(Worksite $worksite, WorksiteLog $log): WorksiteResource
    {
        Gate::authorize('update', $worksite);
        abort_unless($log->worksite_id === $worksite->id && $log->kind === 'note', 404);
        $log->delete();

        return new WorksiteResource($this->loaded($worksite));
    }

    public function storePhoto(Request $request, Worksite $worksite): JsonResponse
    {
        abort_unless($request->user()->hasPermission('works.manage', 'works.cash'), 403);
        $data = $request->validate([
            'photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
            'worksite_lot_id' => ['nullable', 'integer'],
            'caption' => ['nullable', 'string', 'max:255'],
            'taken_at' => ['nullable', 'date', 'before_or_equal:'.now()->addDay()->toDateString()],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'is_public' => ['sometimes', 'boolean'],
            'client_uuid' => ['nullable', 'uuid'],
        ], [], ['photo' => 'photo', 'caption' => 'légende']);

        $photo = $this->worksites->addPhoto($worksite, $request->file('photo'), [
            ...collect($data)->except('photo')->all(),
            'is_public' => $request->boolean('is_public', true),
        ], $request->user());

        return response()->json(['data' => ['id' => $photo->id, 'client_uuid' => $photo->client_uuid]], $photo->wasRecentlyCreated ? 201 : 200);
    }

    public function photo(Worksite $worksite, WorksitePhoto $photo): StreamedResponse
    {
        Gate::authorize('view', $worksite);
        abort_unless($photo->worksite_id === $worksite->id, 404);

        return Storage::disk('local')->response($photo->path, "photo-{$photo->id}.webp", ['Cache-Control' => 'private, max-age=86400']);
    }

    public function updatePhoto(Request $request, Worksite $worksite, WorksitePhoto $photo): WorksiteResource
    {
        Gate::authorize('update', $worksite);
        abort_unless($photo->worksite_id === $worksite->id, 404);
        $photo->update($request->validate([
            'caption' => ['nullable', 'string', 'max:255'],
            'is_public' => ['sometimes', 'boolean'],
            'worksite_lot_id' => ['nullable', 'integer', Rule::exists('worksite_lots', 'id')->where('worksite_id', $worksite->id)],
        ]));

        return new WorksiteResource($this->loaded($worksite));
    }

    public function destroyPhoto(Worksite $worksite, WorksitePhoto $photo): WorksiteResource
    {
        Gate::authorize('update', $worksite);
        abort_unless($photo->worksite_id === $worksite->id, 404);
        $this->worksites->deletePhoto($photo);

        return new WorksiteResource($this->loaded($worksite));
    }

    public function enableTracking(Worksite $worksite): WorksiteResource
    {
        Gate::authorize('update', $worksite);

        return new WorksiteResource($this->loaded($this->worksites->enableTracking($worksite)));
    }

    public function revokeTracking(Worksite $worksite): WorksiteResource
    {
        Gate::authorize('update', $worksite);

        return new WorksiteResource($this->loaded($this->worksites->revokeTracking($worksite)));
    }

    /**
     * @return array<string, list<mixed>>
     */
    private function headerRules(): array
    {
        return [
            'property_id' => ['nullable', 'integer', 'exists:properties,id'],
            'address' => ['nullable', 'string', 'max:255'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'manager_id' => ['nullable', 'integer', 'exists:users,id'],
            'start_date' => ['nullable', 'date'],
            'planned_end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    private function attributes(): array
    {
        return [
            'client_id' => 'client', 'title' => 'intitulé', 'address' => 'adresse', 'manager_id' => 'chef de chantier',
            'start_date' => 'date de début', 'planned_end_date' => 'fin prévue', 'budget_materials' => 'budget matériaux',
            'budget_labor' => 'budget main-d\'œuvre', 'budget_other' => 'autres dépenses prévues',
        ];
    }

    private function loaded(Worksite $worksite): Worksite
    {
        return $worksite->fresh(['client', 'property', 'quote', 'manager', 'lots', 'logs.user', 'photos']);
    }
}
