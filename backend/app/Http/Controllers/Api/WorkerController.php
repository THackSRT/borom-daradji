<?php

namespace App\Http\Controllers\Api;

use App\Enums\PaymentMethod;
use App\Http\Controllers\Controller;
use App\Http\Resources\WorkerPaymentResource;
use App\Http\Resources\WorkerResource;
use App\Models\Worker;
use App\Models\WorkerPayment;
use App\Models\WorkerTask;
use App\Models\Worksite;
use App\Models\WorksiteAttendance;
use App\Rules\SenegalPhone;
use App\Services\WorksiteTeam;
use App\Support\PhoneNumber;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/**
 * Tâcherons : fiche, historique (journées, tâches, avances et paiements) et solde.
 */
class WorkerController extends Controller
{
    public function __construct(private readonly WorksiteTeam $team) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->hasPermission('works.view', 'works.team', 'works.payments'), 403);

        $query = Worker::query()->with('trade');
        if ($search = trim((string) $request->query('search'))) {
            $query->where(fn ($q) => $q->whereLike('name', "%{$search}%")->orWhereLike('phone', "%{$search}%"));
        }
        if ($request->filled('trade_id')) {
            $query->where('trade_id', $request->query('trade_id'));
        }
        if (! $request->boolean('all')) {
            $query->where('is_active', true);
        }

        return WorkerResource::collection($query->orderBy('name')->paginate(min((int) $request->query('per_page', 50), 200)));
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission('works.team'), 403);
        $worker = Worker::create([...$this->validated($request), 'created_by' => $request->user()->id]);

        return (new WorkerResource($worker->load('trade')))->response()->setStatusCode(201);
    }

    public function show(Request $request, Worker $worker): JsonResponse
    {
        abort_unless($request->user()->hasPermission('works.team', 'works.payments'), 403);
        $worker->load('trade');

        $worksites = Worksite::query()->withTrashed()
            ->whereIn('id', $worker->attendances()->select('worksite_id'))
            ->orWhereIn('id', $worker->tasks()->select('worksite_id'))
            ->orWhereIn('id', $worker->payments()->whereNotNull('worksite_id')->select('worksite_id'))
            ->latest('id')->get()
            ->map(fn (Worksite $w) => [
                'id' => $w->id, 'reference' => $w->reference, 'title' => $w->title, 'status' => $w->status->toOption(),
                'days' => (float) $worker->attendances()->where('worksite_id', $w->id)->sum('days'),
                'earned' => $worker->earned($w->id),
                'paid' => $worker->paid($w->id),
            ]);

        return response()->json(['data' => [
            ...(new WorkerResource($worker))->toArray($request),
            'worksites' => $worksites,
            'attendances' => $worker->attendances()->with('worksite:id,reference,title')->latest('worked_on')->limit(60)->get()
                ->map(fn (WorksiteAttendance $a) => [
                    'id' => $a->id, 'worked_on' => $a->worked_on->toDateString(), 'days' => $a->days, 'amount' => $a->amount,
                    'worksite' => ['id' => $a->worksite->id, 'reference' => $a->worksite->reference],
                ]),
            'tasks' => $worker->tasks()->with('worksite:id,reference,title')->latest('id')->get()
                ->map(fn (WorkerTask $t) => [
                    'id' => $t->id, 'description' => $t->description, 'amount' => $t->amount, 'status' => $t->status,
                    'completed_on' => $t->completed_on?->toDateString(),
                    'worksite' => ['id' => $t->worksite->id, 'reference' => $t->worksite->reference],
                ]),
            'payments' => WorkerPaymentResource::collection($worker->payments()->with(['worksite', 'payer'])->latest('paid_on')->latest('id')->get()),
            'can' => ['pay' => $request->user()->hasPermission('works.payments'), 'update' => $request->user()->hasPermission('works.team')],
        ]]);
    }

    public function update(Request $request, Worker $worker): WorkerResource
    {
        abort_unless($request->user()->hasPermission('works.team'), 403);
        $worker->update($this->validated($request, $worker));

        return new WorkerResource($worker->load('trade'));
    }

    public function storePayment(Request $request, Worker $worker): JsonResponse
    {
        abort_unless($request->user()->hasPermission('works.payments'), 403);
        $data = $request->validate([
            'kind' => ['required', Rule::in(['avance', 'paiement'])],
            'amount' => ['required', 'integer', 'min:1'],
            'paid_on' => ['nullable', 'date', 'before_or_equal:today'],
            'method' => ['required', Rule::enum(PaymentMethod::class)->only(PaymentMethod::manual())],
            'reference' => ['nullable', 'string', 'max:100'],
            'note' => ['nullable', 'string', 'max:255'],
            'worksite_id' => ['nullable', 'integer', 'exists:worksites,id'],
            'from_site_cash' => ['sometimes', 'boolean'],
        ], [], ['kind' => 'type', 'amount' => 'montant', 'paid_on' => 'date', 'method' => 'mode de paiement', 'worksite_id' => 'chantier']);

        $payment = $this->team->pay($worker, [...$data, 'from_site_cash' => $request->boolean('from_site_cash')], $request->user());

        return (new WorkerPaymentResource($payment->load(['worksite', 'payer'])))->response()->setStatusCode(201);
    }

    public function cancelPayment(Request $request, Worker $worker, WorkerPayment $payment): WorkerPaymentResource
    {
        abort_unless($request->user()->hasPermission('works.payments'), 403);
        abort_unless($payment->worker_id === $worker->id, 404);
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']], [], ['reason' => 'motif']);

        return new WorkerPaymentResource($this->team->cancelPayment($payment, $data['reason'], $request->user())->load(['worksite', 'payer']));
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Worker $worker = null): array
    {
        $required = $worker ? 'sometimes' : 'required';
        if ($request->filled('phone')) {
            $request->merge(['phone' => PhoneNumber::normalize($request->input('phone')) ?? $request->input('phone')]);
        }

        return $request->validate([
            'name' => [$required, 'string', 'max:120'],
            'phone' => ['nullable', new SenegalPhone, Rule::unique('workers', 'phone')->ignore($worker)],
            'trade_id' => ['nullable', 'integer', 'exists:trades,id'],
            'pay_type' => [$required, Rule::in(array_keys(WorkerResource::PAY_TYPES))],
            'daily_rate' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ], [], ['name' => 'nom', 'phone' => 'téléphone', 'trade_id' => 'corps de métier', 'pay_type' => 'mode de rémunération', 'daily_rate' => 'tarif journalier']);
    }
}
