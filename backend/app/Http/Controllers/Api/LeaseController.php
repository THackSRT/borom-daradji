<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LeaseRequest;
use App\Http\Resources\LeaseResource;
use App\Models\CompanySetting;
use App\Models\Invoice;
use App\Models\Lease;
use App\Models\RentCall;
use App\Services\RentService;
use App\Support\ActivityLogger;
use App\Support\InvoicePdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class LeaseController extends Controller
{
    public function __construct(private readonly RentService $rent) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Lease::class);

        $query = Lease::query()->with(['property', 'tenant', 'owner', 'rentCalls.invoice']);
        if ($search = trim((string) $request->query('search'))) {
            $query->where(fn ($q) => $q->where('reference', 'like', "%{$search}%")
                ->orWhereHas('tenant', fn ($c) => $c->where('name', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%"))
                ->orWhereHas('property', fn ($p) => $p->where('title', 'like', "%{$search}%")->orWhere('reference', 'like', "%{$search}%")));
        }
        foreach (['status', 'property_id', 'tenant_id', 'owner_id'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->query($filter));
            }
        }
        if ($request->boolean('arrears')) {
            $query->whereHas('rentCalls.invoice', fn ($q) => $q->overdue());
        }

        $overdue = Invoice::query()->overdue()->whereHas('rentCall');

        return LeaseResource::collection($query->orderByRaw("status = 'actif' desc")->latest('start_date')->paginate(min((int) $request->query('per_page', 25), 100)))
            ->additional(['summary' => [
                'active' => Lease::query()->active()->count(),
                'monthly_rent' => (int) Lease::query()->active()->sum(DB::raw('rent + charges')),
                'arrears' => (int) (clone $overdue)->sum(DB::raw('total - credited_total - paid_total')),
                'leases_in_arrears' => Lease::query()->whereHas('rentCalls.invoice', fn ($q) => $q->overdue())->count(),
            ]]);
    }

    /**
     * Valeurs proposées dans le formulaire de bail (paramétrables, voir config/borom.php).
     */
    public function defaults(): JsonResponse
    {
        Gate::authorize('viewAny', Lease::class);

        return response()->json(['data' => [
            'due_day' => (int) config('borom.rent_due_day'),
            'rent_vat_rate' => (float) config('borom.rent_vat_rate'),
            'commission_rate' => (float) config('borom.management_commission_rate'),
            'management_fee_vat_rate' => (float) config('borom.management_fee_vat_rate'),
            'agency_fee_vat_rate' => (float) CompanySetting::current()->vat_rate,
        ]]);
    }

    public function store(LeaseRequest $request): JsonResponse
    {
        $lease = $this->rent->createLease(
            $request->safe()->except(['entry_invoice', 'agency_fee']),
            $request->user(),
            ['entry_invoice' => $request->boolean('entry_invoice'), 'agency_fee' => $request->validated('agency_fee')],
        );
        // Mois déjà échus (bail saisi après coup) et mois payés d'avance : appelés tout de suite.
        $this->rent->entryCalls($lease, $request->user());

        return (new LeaseResource($this->loaded($lease)))->response()->setStatusCode(201);
    }

    public function show(Lease $lease): LeaseResource
    {
        Gate::authorize('view', $lease);

        return new LeaseResource($this->loaded($lease));
    }

    public function update(LeaseRequest $request, Lease $lease): LeaseResource
    {
        if (! $lease->isActive()) {
            throw ValidationException::withMessages(['lease' => 'Un bail résilié ne se modifie plus.']);
        }
        $lease->update($request->validated());

        return new LeaseResource($this->loaded($lease));
    }

    public function terminate(Request $request, Lease $lease): LeaseResource
    {
        Gate::authorize('update', $lease);
        $data = $request->validate([
            'terminated_on' => ['required', 'date'],
            'reason' => ['required', 'string', 'max:500'],
        ], [], ['terminated_on' => 'date de fin', 'reason' => 'motif']);

        $this->rent->terminate($lease, $data['terminated_on'], $data['reason']);

        return new LeaseResource($this->loaded($lease));
    }

    /**
     * Lance tout de suite les appels de loyer manquants (sinon faits chaque matin).
     */
    public function generate(Request $request, Lease $lease): LeaseResource
    {
        Gate::authorize('update', $lease);
        $this->rent->generateCalls($lease, by: $request->user());

        return new LeaseResource($this->loaded($lease));
    }

    /**
     * Quittance de loyer d'un mois entièrement payé.
     */
    public function quittance(Request $request, Lease $lease, RentCall $rentCall): Response
    {
        abort_unless($request->user()->hasPermission('leases.view', 'invoices.view'), 403);
        abort_unless($rentCall->lease_id === $lease->id, 404);

        if (! $rentCall->isPaid()) {
            throw ValidationException::withMessages(['rent_call' => 'La quittance n\'est délivrée qu\'une fois le loyer du mois entièrement payé.']);
        }

        ActivityLogger::log('downloaded', $lease, "Quittance de {$rentCall->period->locale('fr')->translatedFormat('F Y')}");

        return InvoicePdf::quittance($rentCall);
    }

    private function loaded(Lease $lease): Lease
    {
        return $lease->fresh(['property', 'tenant', 'owner', 'agent', 'entryInvoice', 'rentCalls.invoice']);
    }
}
