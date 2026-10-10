<?php

namespace App\Services;

use App\Enums\Activity;
use App\Enums\CashMovementType;
use App\Enums\InspectionType;
use App\Enums\PaymentMethod;
use App\Models\DepositSettlement;
use App\Models\Invoice;
use App\Models\Lease;
use App\Models\RentCall;
use App\Models\User;
use App\Support\Sequence;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Restitution de la caution en fin de bail (lot 2). Dans l'ordre, la caution encaissée sert à :
 *  1. solder les loyers impayés (encaissements « retenue sur caution » sur les appels de loyer : le
 *     mois est payé, la quittance devient possible et, pour un bail géré, le loyer revient au propriétaire) ;
 *  2. couvrir les réparations retenues (dégradations de l'état des lieux de sortie, saisies à la main) ;
 *  3. le reste est rendu au locataire ; en espèces, il sort de la caisse du jour de la personne qui rend.
 * Si les retenues dépassent la caution, le reste dû est facturé au locataire (brouillon pour le comptable).
 */
class DepositService
{
    public function __construct(private readonly InspectionService $inspections) {}

    /**
     * Ce qu'il faut savoir pour préparer la restitution : caution, impayés, dégradations relevées.
     *
     * @return array<string, mixed>
     */
    public function preview(Lease $lease): array
    {
        $exit = $lease->inspections()->where('type', InspectionType::Sortie)->with(['items', 'lease'])->first();
        $unpaid = $lease->unpaidCalls();

        return [
            'deposit' => $lease->deposit,
            'deposit_collected' => $lease->depositCollected(),
            'unpaid_calls' => $unpaid->map(fn (RentCall $call) => [
                'id' => $call->id,
                'period' => $call->period->toDateString(),
                'label' => ucfirst($call->period->locale('fr')->translatedFormat('F Y')),
                'invoice_number' => $call->invoice->number,
                'balance' => $call->invoice->balance(),
            ])->all(),
            'arrears_total' => (int) $unpaid->sum(fn (RentCall $call) => $call->invoice->balance()),
            'exit_inspection' => $exit ? [
                'id' => $exit->id,
                'inspected_on' => $exit->inspected_on->toDateString(),
                'validated' => $exit->isValidated(),
                'degradations' => $this->inspections->degradations($exit)->all(),
            ] : null,
        ];
    }

    /**
     * @param  array{deposit_held?: int|null, retain_arrears?: bool, deductions?: list<array{label: string, amount: int}>, refund_method?: string|null, refund_reference?: string|null, settled_on?: string|null, note?: string|null}  $data
     */
    public function settle(Lease $lease, array $data, User $by): DepositSettlement
    {
        return DB::transaction(function () use ($lease, $data, $by) {
            $lease = Lease::query()->lockForUpdate()->findOrFail($lease->id);

            if ($lease->isActive()) {
                throw ValidationException::withMessages(['lease' => 'Résiliez d\'abord le bail : la caution se restitue au départ du locataire.']);
            }
            if ($lease->depositSettlement()->exists()) {
                throw ValidationException::withMessages(['lease' => 'La caution de ce bail a déjà été restituée.']);
            }

            $held = (int) ($data['deposit_held'] ?? $lease->depositCollected());
            $deductions = array_values(array_map(
                fn (array $d) => ['label' => trim($d['label']), 'amount' => (int) $d['amount']],
                array_filter($data['deductions'] ?? [], fn (array $d) => (int) ($d['amount'] ?? 0) > 0),
            ));
            $deductionsTotal = array_sum(array_column($deductions, 'amount'));

            $unpaid = $lease->unpaidCalls();
            $arrears = (int) $unpaid->sum(fn (RentCall $call) => $call->invoice->balance());
            $arrearsRetained = ($data['retain_arrears'] ?? true) ? min($held, $arrears) : 0;
            $deductionsCovered = min($held - $arrearsRetained, $deductionsTotal);
            $balanceDue = $deductionsTotal - $deductionsCovered;
            $refund = $held - $arrearsRetained - $deductionsCovered;
            $settledOn = $data['settled_on'] ?? today()->toDateString();

            $method = null;
            $session = null;
            $reference = isset($data['refund_reference']) ? trim((string) $data['refund_reference']) : null;
            if ($refund > 0) {
                $method = isset($data['refund_method']) ? PaymentMethod::from($data['refund_method']) : null;
                if (! $method || $method === PaymentMethod::Caution) {
                    throw ValidationException::withMessages(['refund_method' => 'Indiquez comment les '.Billing::money($refund).' sont rendus au locataire.']);
                }
                if ($method->requiresReference() && ! $reference) {
                    throw ValidationException::withMessages(['refund_reference' => 'Référence obligatoire pour ce mode (identifiant de transaction, numéro de chèque…).']);
                }
                if ($method === PaymentMethod::Especes) {
                    $session = Billing::todaySession($by);
                    if ($session->isClosed()) {
                        throw ValidationException::withMessages(['refund_method' => 'Votre caisse du jour est clôturée : impossible d\'en sortir des espèces.']);
                    }
                    if ($refund > $session->expected()) {
                        throw ValidationException::withMessages(['refund_method' => 'Il n\'y a que '.Billing::money($session->expected()).' dans votre caisse.']);
                    }
                }
            }

            $exit = $lease->inspections()->where('type', InspectionType::Sortie)->whereNotNull('validated_at')->first();
            $settlement = DepositSettlement::create([
                'number' => sprintf('CAU-%d-%04d', now()->year, Sequence::next('caution')),
                'lease_id' => $lease->id,
                'exit_inspection_id' => $exit?->id,
                'deposit_held' => $held,
                'arrears_retained' => $arrearsRetained,
                'deductions_total' => $deductionsTotal,
                'deductions' => $deductions,
                'refund' => $refund,
                'balance_due' => $balanceDue,
                'refund_method' => $method,
                'refund_reference' => $method ? ($reference ?: null) : null,
                'settled_on' => $settledOn,
                'note' => $data['note'] ?? null,
                'created_by' => $by->id,
            ]);

            // 1. Loyers impayés, du plus ancien au plus récent.
            $remaining = $arrearsRetained;
            foreach ($unpaid as $call) {
                if ($remaining <= 0) {
                    break;
                }
                $amount = min($remaining, $call->invoice->balance());
                Billing::recordPayment($call->invoice, [
                    'method' => PaymentMethod::Caution->value,
                    'amount' => $amount,
                    'paid_on' => $settledOn,
                    'note' => "Retenue sur la caution — {$settlement->number}",
                ], $by)->forceFill(['deposit_settlement_id' => $settlement->id])->save();
                $remaining -= $amount;
            }

            // 2. Retenues au-delà de la caution : facturées au locataire.
            if ($balanceDue > 0) {
                $invoice = Billing::saveDraft(new Invoice([
                    'client_id' => $lease->tenant_id,
                    'property_id' => $lease->property_id,
                    'activity' => Activity::Location,
                    'notes' => "Reste dû après restitution de la caution — {$settlement->number}, bail {$lease->reference}",
                    'created_by' => $by->id,
                ]), [], [[
                    'description' => 'Remise en état après l\'état des lieux de sortie (au-delà de la caution)',
                    'quantity' => 1,
                    'unit_price' => $balanceDue,
                    'vat_rate' => 0,
                ]]);
                $settlement->forceFill(['balance_invoice_id' => $invoice->id])->save();
            }

            // 3. Remboursement en espèces : sortie de caisse.
            if ($session) {
                $movement = $session->movements()->create([
                    'type' => CashMovementType::RestitutionCaution,
                    'amount' => $refund,
                    'label' => "Restitution caution {$lease->reference} — {$lease->tenant->name}",
                    'created_by' => $by->id,
                ]);
                $settlement->forceFill(['cash_movement_id' => $movement->id])->save();
            }

            return $settlement;
        });
    }
}
