<?php

namespace App\Http\Controllers\Api;

use App\Enums\PaymentMethod;
use App\Http\Controllers\Controller;
use App\Http\Resources\DepositSettlementResource;
use App\Models\Lease;
use App\Services\DepositService;
use App\Support\ActivityLogger;
use App\Support\InvoicePdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class DepositSettlementController extends Controller
{
    public function __construct(private readonly DepositService $deposits) {}

    /**
     * Caution du bail : restitution faite, ou éléments pour la préparer.
     */
    public function show(Request $request, Lease $lease): JsonResponse
    {
        Gate::authorize('view', $lease);
        $settlement = $lease->depositSettlement()->with(['balanceInvoice', 'creator'])->first();

        return response()->json(['data' => [
            ...$this->deposits->preview($lease),
            'settlement' => $settlement ? new DepositSettlementResource($settlement) : null,
            'can_settle' => ! $settlement && ! $lease->isActive() && $request->user()->can('settleDeposit', $lease),
        ]]);
    }

    public function store(Request $request, Lease $lease): JsonResponse
    {
        Gate::authorize('settleDeposit', $lease);
        $data = $request->validate([
            'deposit_held' => ['nullable', 'integer', 'min:0'],
            'retain_arrears' => ['sometimes', 'boolean'],
            'deductions' => ['sometimes', 'array', 'max:50'],
            'deductions.*.label' => ['required', 'string', 'max:255'],
            'deductions.*.amount' => ['required', 'integer', 'min:0'],
            'refund_method' => ['nullable', Rule::enum(PaymentMethod::class)->except([PaymentMethod::Caution])],
            'refund_reference' => ['nullable', 'string', 'max:100'],
            'settled_on' => ['nullable', 'date', 'before_or_equal:today'],
            'note' => ['nullable', 'string', 'max:2000'],
        ], [], [
            'deposit_held' => 'caution encaissée', 'deductions.*.label' => 'libellé de la retenue', 'deductions.*.amount' => 'montant de la retenue',
            'refund_method' => 'mode de remboursement', 'refund_reference' => 'référence', 'settled_on' => 'date', 'note' => 'note',
        ]);

        $settlement = $this->deposits->settle($lease, $data, $request->user());

        return (new DepositSettlementResource($settlement->fresh(['balanceInvoice', 'creator'])))->response()->setStatusCode(201);
    }

    public function pdf(Lease $lease): Response
    {
        Gate::authorize('view', $lease);
        $settlement = $lease->depositSettlement()->firstOrFail();
        ActivityLogger::log('downloaded', $settlement, "Décompte de caution {$settlement->number}");

        return InvoicePdf::depositSettlement($settlement);
    }
}
