<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SiteCashEntryResource;
use App\Models\SiteCashEntry;
use App\Models\WorkerTask;
use App\Models\Worksite;
use App\Models\WorksiteAttendance;
use App\Services\SiteCash;
use App\Services\WorksiteCosts;
use App\Services\WorksiteTeam;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Argent et main-d'œuvre d'un chantier : pointage (« works.team »), travaux à la tâche (« works.team »),
 * caisse de chantier (dépenses « works.cash », approvisionnements et retours « works.payments »),
 * budget prévu/réel (« works.costs »).
 */
class WorksiteCostController extends Controller
{
    public function __construct(
        private readonly WorksiteTeam $team,
        private readonly SiteCash $cash,
        private readonly WorksiteCosts $costs,
    ) {}

    /** Équipe du chantier : tâcherons passés par ce chantier, pointage du jour demandé, tâches. */
    public function team(Request $request, Worksite $worksite): JsonResponse
    {
        Gate::authorize('view', $worksite);
        $this->allow($request, 'works.team', 'works.payments', 'works.costs');
        $date = $request->date('date')?->toDateString() ?? today()->toDateString();

        return response()->json(['data' => [
            'date' => $date,
            'crew' => $this->team->crew($worksite),
            'attendances' => $worksite->attendances()->with('worker')->whereDate('worked_on', $date)->orderBy('id')->get()
                ->map(fn (WorksiteAttendance $a) => $this->attendance($a)),
            'tasks' => $worksite->workerTasks()->with('worker')->orderByRaw("status = 'en_cours' desc")->latest('id')->get()
                ->map(fn (WorkerTask $t) => $this->task($t)),
            'can' => ['team' => $request->user()->hasPermission('works.team'), 'pay' => $request->user()->hasPermission('works.payments')],
        ]]);
    }

    public function storeAttendance(Request $request, Worksite $worksite): JsonResponse
    {
        Gate::authorize('view', $worksite);
        $this->allow($request, 'works.team');
        $data = $request->validate([
            'worked_on' => ['required', 'date'],
            'entries' => ['required', 'array', 'min:1', 'max:100'],
            'entries.*.worker_id' => ['required', 'integer', 'distinct', 'exists:workers,id'],
            'entries.*.days' => ['required', 'numeric', Rule::in([0.5, 1])],
            'entries.*.daily_rate' => ['nullable', 'integer', 'min:0'],
            'entries.*.note' => ['nullable', 'string', 'max:255'],
            'entries.*.client_uuid' => ['nullable', 'uuid'],
        ], [], ['worked_on' => 'date', 'entries' => 'pointage', 'entries.*.worker_id' => 'tâcheron', 'entries.*.days' => 'durée']);

        $lines = $this->team->recordAttendance($worksite, $request->date('worked_on')->toDateString(), array_map(
            fn (array $e) => [...$e, 'days' => (float) $e['days']],
            $data['entries'],
        ), $request->user());

        return response()->json(['data' => collect($lines)->map(fn (WorksiteAttendance $a) => $this->attendance($a->load('worker')))], 201);
    }

    public function destroyAttendance(Request $request, Worksite $worksite, WorksiteAttendance $attendance): JsonResponse
    {
        $this->allow($request, 'works.team');
        abort_unless($attendance->worksite_id === $worksite->id, 404);
        $this->team->removeAttendance($attendance);

        return response()->json(null, 204);
    }

    public function storeTask(Request $request, Worksite $worksite): JsonResponse
    {
        $this->allow($request, 'works.team');
        $data = $request->validate([
            'worker_id' => ['required', 'integer', Rule::exists('workers', 'id')->where('is_active', true)],
            'description' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'integer', 'min:1'],
        ], [], ['worker_id' => 'tâcheron', 'amount' => 'montant']);

        return response()->json(['data' => $this->task($this->team->createTask($worksite, $data, $request->user())->load('worker'))], 201);
    }

    public function updateTask(Request $request, Worksite $worksite, WorkerTask $task): JsonResponse
    {
        $this->allow($request, 'works.team');
        abort_unless($task->worksite_id === $worksite->id, 404);
        $data = $request->validate([
            'action' => ['sometimes', Rule::in(['terminer', 'annuler'])],
            'description' => ['sometimes', 'string', 'max:255'],
            'amount' => ['sometimes', 'integer', 'min:1'],
            'completed_on' => ['nullable', 'date', 'before_or_equal:today'],
        ], [], ['amount' => 'montant']);

        $task = match ($data['action'] ?? null) {
            'terminer' => $this->team->completeTask($task, $data['completed_on'] ?? null),
            'annuler' => $this->team->cancelTask($task),
            default => $this->team->updateTask($task, collect($data)->only(['description', 'amount'])->all()),
        };

        return response()->json(['data' => $this->task($task->load('worker'))]);
    }

    /** Caisse du chantier : mouvements, totaux par nature, solde, dépenses sans reçu. */
    public function cash(Request $request, Worksite $worksite): JsonResponse
    {
        Gate::authorize('view', $worksite);
        $this->allow($request, 'works.cash', 'works.payments', 'works.costs');

        return response()->json(['data' => [
            'totals' => $this->cash->totals($worksite),
            'entries' => SiteCashEntryResource::collection($worksite->cashEntries()->with('author')->latest('spent_on')->latest('id')->get()),
            'categories' => collect(SiteCashEntry::CATEGORIES)->map(fn ($label, $value) => ['value' => $value, 'label' => $label])->values(),
            'can' => ['spend' => $request->user()->hasPermission('works.cash'), 'supply' => $request->user()->hasPermission('works.payments')],
        ]]);
    }

    public function storeCashEntry(Request $request, Worksite $worksite): JsonResponse
    {
        Gate::authorize('view', $worksite);
        $kind = $request->validate(['kind' => ['required', Rule::in(['approvisionnement', 'depense', 'retour'])]], [], ['kind' => 'type de mouvement'])['kind'];
        $this->allow($request, $kind === 'depense' ? 'works.cash' : 'works.payments');

        $common = [
            'amount' => ['required', 'integer', 'min:1'],
            'spent_on' => ['nullable', 'date', 'before_or_equal:today'],
        ];
        $attributes = ['amount' => 'montant', 'spent_on' => 'date', 'label' => 'libellé', 'category' => 'catégorie', 'receipt' => 'reçu'];

        if ($kind === 'depense') {
            $data = $request->validate([
                ...$common,
                'category' => ['required', Rule::in(array_keys(SiteCashEntry::CATEGORIES))],
                'label' => ['required', 'string', 'max:255'],
                'receipt' => ['nullable', 'image', 'max:10240'],
                'client_uuid' => ['nullable', 'uuid'],
            ], [], $attributes);
            $entry = $this->cash->spend($worksite, collect($data)->except('receipt')->all(), $request->file('receipt'), $request->user());
        } elseif ($kind === 'approvisionnement') {
            $data = $request->validate([
                ...$common,
                'label' => ['nullable', 'string', 'max:255'],
                'holder_id' => ['nullable', 'integer', 'exists:users,id'],
                'from_cash_register' => ['sometimes', 'boolean'],
            ], [], $attributes);
            $entry = $this->cash->supply($worksite, [...$data, 'from_cash_register' => $request->boolean('from_cash_register')], $request->user());
        } else {
            $data = $request->validate([
                ...$common,
                'label' => ['nullable', 'string', 'max:255'],
                'to_cash_register' => ['sometimes', 'boolean'],
            ], [], $attributes);
            $entry = $this->cash->giveBack($worksite, [...$data, 'to_cash_register' => $request->boolean('to_cash_register')], $request->user());
        }

        return (new SiteCashEntryResource($entry->load('author')))->response()->setStatusCode($entry->wasRecentlyCreated ? 201 : 200);
    }

    public function attachReceipt(Request $request, Worksite $worksite, SiteCashEntry $entry): SiteCashEntryResource
    {
        $this->allow($request, 'works.cash');
        abort_unless($entry->worksite_id === $worksite->id, 404);
        $request->validate(['receipt' => ['required', 'image', 'max:10240']], [], ['receipt' => 'reçu']);

        return new SiteCashEntryResource($this->cash->attachReceipt($entry, $request->file('receipt'))->load('author'));
    }

    public function receipt(Request $request, Worksite $worksite, SiteCashEntry $entry): StreamedResponse
    {
        $this->allow($request, 'works.cash', 'works.payments', 'works.costs');
        abort_unless($entry->worksite_id === $worksite->id && $entry->receipt_path, 404);

        return Storage::disk('local')->response($entry->receipt_path, "recu-{$entry->id}.webp", ['Cache-Control' => 'private, max-age=86400']);
    }

    public function cancelCashEntry(Request $request, Worksite $worksite, SiteCashEntry $entry): SiteCashEntryResource
    {
        abort_unless($entry->worksite_id === $worksite->id, 404);
        $this->allow($request, $entry->kind === 'depense' ? 'works.cash' : 'works.payments');
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']], [], ['reason' => 'motif']);

        return new SiteCashEntryResource($this->cash->cancel($entry, $data['reason'], $request->user())->load('author'));
    }

    public function budget(Request $request, Worksite $worksite): JsonResponse
    {
        Gate::authorize('viewCosts', $worksite);

        return response()->json(['data' => [...$this->costs->summary($worksite), 'cash_balance' => $this->cash->balance($worksite)]]);
    }

    private function allow(Request $request, string ...$permissions): void
    {
        abort_unless($request->user()->hasPermission(...$permissions), 403);
    }

    /**
     * @return array<string, mixed>
     */
    private function attendance(WorksiteAttendance $a): array
    {
        return [
            'id' => $a->id,
            'worker' => ['id' => $a->worker->id, 'name' => $a->worker->name],
            'worked_on' => $a->worked_on->toDateString(),
            'days' => $a->days,
            'daily_rate' => $a->daily_rate,
            'amount' => $a->amount,
            'note' => $a->note,
            'client_uuid' => $a->client_uuid,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function task(WorkerTask $t): array
    {
        return [
            'id' => $t->id,
            'worker' => ['id' => $t->worker->id, 'name' => $t->worker->name],
            'description' => $t->description,
            'amount' => $t->amount,
            'status' => ['value' => $t->status, 'label' => ['en_cours' => 'En cours', 'terminee' => 'Terminée', 'annulee' => 'Annulée'][$t->status] ?? $t->status],
            'completed_on' => $t->completed_on?->toDateString(),
        ];
    }
}
