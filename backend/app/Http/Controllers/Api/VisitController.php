<?php

namespace App\Http\Controllers\Api;

use App\Enums\InteractionChannel;
use App\Enums\PipelineStatus;
use App\Enums\VisitStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\VisitRequest;
use App\Http\Resources\VisitResource;
use App\Models\Task;
use App\Models\Visit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class VisitController extends Controller
{
    /**
     * Planning : par défaut la semaine en cours.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Visit::class);

        $filters = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'agent_id' => ['nullable', 'integer'],
            'mine' => ['nullable', 'boolean'],
            'status' => ['nullable', Rule::enum(VisitStatus::class)],
        ]);

        $from = isset($filters['from']) ? now()->parse($filters['from'])->startOfDay() : now()->startOfWeek();
        $to = isset($filters['to']) ? now()->parse($filters['to'])->endOfDay() : now()->endOfWeek();

        $visits = Visit::query()
            ->with(['property:id,reference,title,neighborhood', 'client:id,name,phone,whatsapp', 'agent:id,name'])
            ->whereBetween('scheduled_at', [$from, $to])
            ->when($filters['agent_id'] ?? null, fn ($q, $v) => $q->where('agent_id', $v))
            ->when($request->boolean('mine'), fn ($q) => $q->where('agent_id', $request->user()->id))
            ->when($filters['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->orderBy('scheduled_at')
            ->get();

        return VisitResource::collection($visits);
    }

    public function store(VisitRequest $request): VisitResource
    {
        $visit = Visit::create([
            ...$request->validated(),
            'agent_id' => $request->input('agent_id', $request->user()->id),
        ]);

        return new VisitResource($visit->load(['property', 'client', 'agent']));
    }

    /**
     * Report, annulation ou compte-rendu. Une visite effectuée est versée au journal des échanges
     * du client et fait avancer le prospect.
     */
    public function update(VisitRequest $request, Visit $visit): VisitResource
    {
        DB::transaction(function () use ($request, $visit) {
            $wasDone = $visit->status === VisitStatus::Effectuee;
            $visit->update($request->validated());

            if ($visit->status !== VisitStatus::Effectuee || $wasDone) {
                return;
            }

            $visit->client->interactions()->create([
                'user_id' => $request->user()->id,
                'property_id' => $visit->property_id,
                'channel' => InteractionChannel::Visite,
                'summary' => trim("Visite de {$visit->property->reference} : {$visit->feedback?->label()}. {$visit->notes}"),
                'occurred_at' => $visit->scheduled_at->isFuture() ? now() : $visit->scheduled_at,
            ]);

            $client = $visit->client->refresh();
            $client->advancePipeline(PipelineStatus::Visite);
            $client->save();

            if ($visit->next_action) {
                Task::create([
                    'user_id' => $visit->agent_id ?? $request->user()->id,
                    'created_by' => $request->user()->id,
                    'client_id' => $visit->client_id,
                    'property_id' => $visit->property_id,
                    'title' => $visit->next_action,
                    'due_at' => now()->addDay(),
                ]);
            }
        });

        return new VisitResource($visit->load(['property', 'client', 'agent']));
    }
}
