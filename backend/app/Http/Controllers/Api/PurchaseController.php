<?php

namespace App\Http\Controllers\Api;

use App\Enums\PaymentMethod;
use App\Http\Controllers\Controller;
use App\Http\Resources\PurchaseResource;
use App\Models\Purchase;
use App\Models\SupplierPayment;
use App\Services\PurchaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Achats aux fournisseurs (« stock.purchases ») : entrée en stock, paiements, annulation.
 */
class PurchaseController extends Controller
{
    public function __construct(private readonly PurchaseService $purchases) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->allow($request);
        $query = Purchase::query()->with('supplier');
        if ($search = trim((string) $request->query('search'))) {
            $query->where(fn ($q) => $q->whereLike('number', "%{$search}%")->orWhereLike('supplier_reference', "%{$search}%")
                ->orWhereHas('supplier', fn ($c) => $c->whereLike('name', "%{$search}%")));
        }
        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->query('supplier_id'));
        }
        match ($request->query('state')) {
            'a_payer' => $query->unpaid(),
            'en_retard' => $query->unpaid()->whereDate('due_date', '<', today()),
            'annules' => $query->whereNotNull('cancelled_at'),
            default => null,
        };

        $unpaid = Purchase::query()->unpaid();

        return PurchaseResource::collection($query->latest('received_on')->latest('id')->paginate(min((int) $request->query('per_page', 25), 100)))
            ->additional(['summary' => [
                'unpaid_count' => (clone $unpaid)->count(),
                'unpaid_total' => (int) (clone $unpaid)->selectRaw('sum(total - paid_total) as v')->value('v'),
                'overdue_count' => (clone $unpaid)->whereDate('due_date', '<', today())->count(),
                'month_total' => (int) Purchase::query()->valid()->whereBetween('received_on', [today()->startOfMonth()->toDateString(), today()->toDateString()])->sum('total'),
            ]]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->allow($request);
        $data = $request->validate([
            'supplier_id' => ['required', 'integer', 'exists:clients,id'],
            'supplier_reference' => ['nullable', 'string', 'max:100'],
            'received_on' => ['nullable', 'date', 'before_or_equal:today'],
            'due_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'lines' => ['required', 'array', 'min:1', 'max:100'],
            'lines.*.article_id' => ['required', 'integer', 'distinct', Rule::exists('articles', 'id')->where('is_active', true)],
            'lines.*.quantity' => ['required', 'numeric', 'gt:0'],
            'lines.*.unit_cost' => ['required', 'integer', 'min:0'],
            'lines.*.vat_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'payment' => ['nullable', 'array'],
            'payment.amount' => ['required_with:payment', 'integer', 'min:1'],
            'payment.method' => ['required_with:payment', Rule::enum(PaymentMethod::class)->only(PaymentMethod::manual())],
            'payment.reference' => ['nullable', 'string', 'max:100'],
        ], [], [
            'supplier_id' => 'fournisseur', 'supplier_reference' => 'référence du fournisseur', 'received_on' => 'date de réception',
            'lines' => 'articles', 'lines.*.article_id' => 'article', 'lines.*.quantity' => 'quantité', 'lines.*.unit_cost' => 'prix d\'achat',
            'payment.amount' => 'montant payé', 'payment.method' => 'mode de paiement',
        ]);
        $lines = $data['lines'];
        $payment = $data['payment'] ?? null;
        unset($data['lines'], $data['payment']);

        $purchase = DB::transaction(function () use ($data, $lines, $payment, $request) {
            $purchase = $this->purchases->record($data, $lines, $request->user());
            if ($payment) {
                $this->purchases->pay($purchase, [...$payment, 'paid_on' => $purchase->received_on->toDateString()], $request->user());
            }

            return $purchase;
        });

        return (new PurchaseResource($this->loaded($purchase)))->response()->setStatusCode(201);
    }

    public function show(Request $request, Purchase $purchase): PurchaseResource
    {
        $this->allow($request);

        return new PurchaseResource($this->loaded($purchase));
    }

    public function update(Request $request, Purchase $purchase): PurchaseResource
    {
        $this->allow($request);
        // Seules les informations administratives changent ; les lignes sont entrées en stock.
        $purchase->update($request->validate([
            'supplier_reference' => ['nullable', 'string', 'max:100'],
            'due_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]));

        return new PurchaseResource($this->loaded($purchase));
    }

    public function cancel(Request $request, Purchase $purchase): PurchaseResource
    {
        $this->allow($request);
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']], [], ['reason' => 'motif']);

        return new PurchaseResource($this->loaded($this->purchases->cancel($purchase, $data['reason'], $request->user())));
    }

    public function storePayment(Request $request, Purchase $purchase): JsonResponse
    {
        $this->allow($request);
        $data = $request->validate([
            'amount' => ['required', 'integer', 'min:1'],
            'method' => ['required', Rule::enum(PaymentMethod::class)->only(PaymentMethod::manual())],
            'paid_on' => ['nullable', 'date', 'before_or_equal:today'],
            'reference' => ['nullable', 'string', 'max:100'],
            'note' => ['nullable', 'string', 'max:255'],
        ], [], ['amount' => 'montant', 'method' => 'mode de paiement', 'paid_on' => 'date']);
        $this->purchases->pay($purchase, $data, $request->user());

        return (new PurchaseResource($this->loaded($purchase->fresh())))->response()->setStatusCode(201);
    }

    public function cancelPayment(Request $request, Purchase $purchase, SupplierPayment $payment): PurchaseResource
    {
        $this->allow($request);
        abort_unless($payment->purchase_id === $purchase->id, 404);
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']], [], ['reason' => 'motif']);
        $this->purchases->cancelPayment($payment, $data['reason'], $request->user());

        return new PurchaseResource($this->loaded($purchase->fresh()));
    }

    private function allow(Request $request): void
    {
        abort_unless($request->user()->hasPermission('stock.purchases'), 403);
    }

    private function loaded(Purchase $purchase): Purchase
    {
        return $purchase->load(['supplier', 'lines.article', 'payments.payer', 'author']);
    }
}
