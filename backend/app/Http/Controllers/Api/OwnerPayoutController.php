<?php

namespace App\Http\Controllers\Api;

use App\Enums\PaymentMethod;
use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\OwnerPayout;
use App\Services\RentService;
use App\Support\InvoicePdf;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Relevés de gérance et reversements aux propriétaires.
 */
class OwnerPayoutController extends Controller
{
    public function __construct(private readonly RentService $rent) {}

    /**
     * Propriétaires en gestion, avec ce qui reste à leur reverser.
     */
    public function owners(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', OwnerPayout::class);
        $period = $this->period($request);

        $owners = Client::query()
            ->whereHas('ownedLeases', fn ($q) => $q->where('managed', true))
            ->withCount(['ownedLeases as managed_leases_count' => fn ($q) => $q->where('managed', true)->where('status', 'actif')])
            ->orderBy('name')->get()
            ->map(function (Client $owner) use ($period) {
                $statement = $this->rent->statement($owner, $period);
                $last = OwnerPayout::query()->where('owner_id', $owner->id)->whereNull('cancelled_at')->latest('paid_on')->first();

                return [
                    'id' => $owner->id,
                    'name' => $owner->name,
                    'phone' => $owner->phone,
                    'managed_leases' => $owner->managed_leases_count,
                    'pending_collected' => $statement['collected'],
                    'pending_net' => $statement['collected'] - $statement['commission'] - $statement['commission_vat'],
                    'last_payout' => $last ? ['number' => $last->number, 'paid_on' => $last->paid_on->toDateString(), 'net' => $last->net] : null,
                ];
            });

        return response()->json(['data' => $owners, 'period' => $period->toDateString()]);
    }

    public function statement(Request $request, Client $client): JsonResponse
    {
        Gate::authorize('viewAny', OwnerPayout::class);
        $statement = $this->rent->statement($client, $this->period($request));

        return response()->json(['data' => [
            'owner' => ['id' => $client->id, 'name' => $client->name, 'phone' => $client->phone],
            'period' => $statement['period'],
            'lines' => $statement['lines'],
            'collected' => $statement['collected'],
            'commission' => $statement['commission'],
            'commission_vat' => $statement['commission_vat'],
            'net_before_expenses' => $statement['collected'] - $statement['commission'] - $statement['commission_vat'],
        ]]);
    }

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', OwnerPayout::class);
        $payouts = OwnerPayout::query()->with('owner')
            ->when($request->filled('owner_id'), fn ($q) => $q->where('owner_id', $request->query('owner_id')))
            ->latest('paid_on')->latest('id')->paginate(25);

        return response()->json([
            'data' => $payouts->getCollection()->map(fn (OwnerPayout $p) => $this->present($p)),
            'meta' => ['current_page' => $payouts->currentPage(), 'last_page' => $payouts->lastPage(), 'total' => $payouts->total()],
        ]);
    }

    public function store(Request $request, Client $client): JsonResponse
    {
        Gate::authorize('create', OwnerPayout::class);
        $data = $request->validate([
            'period' => ['required', 'date_format:Y-m'],
            'method' => ['required', Rule::enum(PaymentMethod::class)],
            'reference' => ['nullable', 'string', 'max:100'],
            'paid_on' => ['required', 'date', 'before_or_equal:today'],
            'note' => ['nullable', 'string', 'max:1000'],
            'expenses' => ['nullable', 'array', 'max:20'],
            'expenses.*.label' => ['required', 'string', 'max:200'],
            'expenses.*.amount' => ['required', 'integer', 'min:0'],
        ], [], ['method' => 'mode de versement', 'paid_on' => 'date du versement', 'expenses.*.label' => 'libellé du frais', 'expenses.*.amount' => 'montant du frais']);

        $payout = $this->rent->recordPayout($client, CarbonImmutable::createFromFormat('Y-m', $data['period'])->startOfMonth(), $data, $request->user());

        return response()->json(['data' => $this->present($payout->load('owner'))], 201);
    }

    public function cancel(Request $request, OwnerPayout $ownerPayout): JsonResponse
    {
        Gate::authorize('cancel', $ownerPayout);
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']], [], ['reason' => 'motif']);

        return response()->json(['data' => $this->present($this->rent->cancelPayout($ownerPayout, $data['reason'], $request->user())->load('owner'))]);
    }

    public function pdf(OwnerPayout $ownerPayout): Response
    {
        Gate::authorize('view', $ownerPayout);

        return InvoicePdf::ownerStatement($ownerPayout->load('owner'));
    }

    private function period(Request $request): CarbonImmutable
    {
        $value = (string) $request->query('period', '');

        return preg_match('/^\d{4}-\d{2}$/', $value)
            ? CarbonImmutable::createFromFormat('Y-m', $value)->startOfMonth()
            : CarbonImmutable::today()->startOfMonth();
    }

    /**
     * @return array<string, mixed>
     */
    private function present(OwnerPayout $payout): array
    {
        return [
            'id' => $payout->id,
            'number' => $payout->number,
            'owner' => ['id' => $payout->owner->id, 'name' => $payout->owner->name],
            'period' => $payout->period->toDateString(),
            'collected' => $payout->collected,
            'commission' => $payout->commission,
            'commission_vat' => $payout->commission_vat,
            'expenses' => $payout->expenses,
            'net' => $payout->net,
            'details' => $payout->details,
            'method' => $payout->method->toOption(),
            'reference' => $payout->reference,
            'paid_on' => $payout->paid_on->toDateString(),
            'note' => $payout->note,
            'cancelled_at' => $payout->cancelled_at?->toIso8601String(),
            'cancel_reason' => $payout->cancel_reason,
        ];
    }
}
