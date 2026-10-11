<?php

namespace App\Services;

use App\Enums\Activity;
use App\Enums\LeaseStatus;
use App\Enums\PropertyStatus;
use App\Models\Client;
use App\Models\CompanySetting;
use App\Models\Invoice;
use App\Models\Lease;
use App\Models\OwnerPayout;
use App\Models\Payment;
use App\Models\Property;
use App\Models\RentCall;
use App\Models\User;
use App\Support\PermissionCatalog;
use App\Support\Sequence;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Gestion locative (lot 2) : baux, appels de loyer mensuels, reversements aux propriétaires.
 * Les appels de loyer sont des factures ordinaires (App\Services\Billing) : encaissements, caisse,
 * reçus et relances fonctionnent comme pour toute facture.
 */
class RentService
{
    public function __construct(private readonly PropertyStatusService $statuses) {}

    /**
     * @param  array<string, mixed>  $data  champs validés du bail
     * @param  array{entry_invoice?: bool, agency_fee?: int|null}  $options
     */
    public function createLease(array $data, User $by, array $options = []): Lease
    {
        return DB::transaction(function () use ($data, $by, $options) {
            $property = Property::query()->lockForUpdate()->findOrFail($data['property_id']);

            if (Lease::query()->active()->where('property_id', $property->id)->exists()) {
                throw ValidationException::withMessages(['property_id' => 'Ce bien a déjà un bail en cours : résiliez-le d\'abord.']);
            }

            $start = CarbonImmutable::parse($data['start_date']);
            $lease = new Lease([
                ...$data,
                'owner_id' => $data['owner_id'] ?? $property->owner_id,
                'agent_id' => $data['agent_id'] ?? $property->agent_id,
                'billing_start' => $data['billing_start'] ?? $start->startOfMonth()->toDateString(),
                'created_by' => $by->id,
            ]);
            $lease->reference = sprintf('BAIL-%d-%04d', now()->year, Sequence::next('bail'));
            $lease->save();

            if ($property->status->canTransitionTo(PropertyStatus::Loue)) {
                $this->statuses->transition($property, PropertyStatus::Loue, "Bail {$lease->reference}", $by);
            }

            if ($options['entry_invoice'] ?? false) {
                $lease->entryInvoice()->associate($this->entryInvoice($lease, (int) ($options['agency_fee'] ?? 0), $by))->save();
            }

            return $lease;
        });
    }

    /**
     * Facture d'entrée en brouillon (caution, frais d'agence) : le comptable la vérifie et l'émet.
     * Les mois payés d'avance sont des appels de loyer ordinaires, émis dès la signature (voir
     * entryCalls) : ils reviennent ainsi au propriétaire dans son relevé de gérance.
     */
    public function entryInvoice(Lease $lease, int $agencyFee, User $by): Invoice
    {
        $title = $lease->property->title;
        $lines = [];
        if ($lease->deposit > 0) {
            $lines[] = ['description' => "Caution — {$title} (remboursable en fin de bail)", 'quantity' => 1, 'unit_price' => $lease->deposit, 'vat_rate' => 0];
        }
        if ($agencyFee > 0) {
            $lines[] = ['description' => 'Frais d\'agence', 'quantity' => 1, 'unit_price' => $agencyFee, 'vat_rate' => (float) CompanySetting::current()->vat_rate];
        }
        if (! $lines) {
            throw ValidationException::withMessages(['entry_invoice' => 'Rien à facturer à l\'entrée (ni caution, ni frais d\'agence).']);
        }

        return Billing::saveDraft(new Invoice([
            'client_id' => $lease->tenant_id,
            'property_id' => $lease->property_id,
            'activity' => Activity::Location,
            'notes' => "Entrée dans les lieux — bail {$lease->reference}",
            'created_by' => $by->id,
        ]), [], $lines);
    }

    /**
     * Crée les appels de loyer manquants, du premier mois facturé jusqu'au mois de `$upTo`. Idempotent.
     *
     * @return Collection<int, RentCall>
     */
    public function generateCalls(Lease $lease, ?CarbonImmutable $upTo = null, ?User $by = null): Collection
    {
        $created = collect();
        $upTo = ($upTo ?? CarbonImmutable::today())->startOfMonth();
        $last = $lease->lastBillableMonth();
        $limit = $last && $last->lt($upTo) ? $last : $upTo;
        $existing = $lease->rentCalls()->pluck('period')->map(fn ($p) => $p->toDateString())->all();

        for ($month = $lease->billing_start->startOfMonth(); $month->lte($limit); $month = $month->addMonth()) {
            if (in_array($month->toDateString(), $existing, true)) {
                continue;
            }
            $created->push($this->createCall($lease, $month, $by));
        }

        return $created;
    }

    /**
     * Appels de loyer à la signature : les mois déjà échus (bail saisi après coup) et les mois payés d'avance.
     *
     * @return Collection<int, RentCall>
     */
    public function entryCalls(Lease $lease, ?User $by = null): Collection
    {
        $advanceEnd = $lease->billing_start->startOfMonth()->addMonths(max(1, $lease->advance_months) - 1);
        $today = CarbonImmutable::today()->startOfMonth();

        return $lease->advance_months > 0 || $lease->billing_start->lte($today)
            ? $this->generateCalls($lease, $advanceEnd->gt($today) ? $advanceEnd : $today, $by)
            : collect();
    }

    /**
     * Appels de loyer de tous les baux en cours (tâche planifiée quotidienne).
     */
    public function generateAll(?CarbonImmutable $upTo = null): int
    {
        $count = 0;
        Lease::query()->active()->with(['property', 'rentCalls'])->each(function (Lease $lease) use ($upTo, &$count) {
            $count += $this->generateCalls($lease, $upTo)->count();
        });

        return $count;
    }

    private function createCall(Lease $lease, CarbonImmutable $month, ?User $by): RentCall
    {
        return DB::transaction(function () use ($lease, $month, $by) {
            $label = ucfirst($month->locale('fr')->translatedFormat('F Y'));
            $vat = (float) $lease->rent_vat_rate;
            $lines = [['description' => "Loyer {$label} — {$lease->property->title}", 'quantity' => 1, 'unit' => 'mois', 'unit_price' => $lease->rent, 'vat_rate' => $vat]];
            if ($lease->charges > 0) {
                $lines[] = ['description' => "Charges {$label}", 'quantity' => 1, 'unit' => 'mois', 'unit_price' => $lease->charges, 'vat_rate' => $vat];
            }
            $due = $month->setDay(min($lease->due_day, $month->daysInMonth));

            $invoice = Billing::saveDraft(new Invoice([
                'client_id' => $lease->tenant_id,
                'property_id' => $lease->property_id,
                'activity' => Activity::Location,
                'due_date' => $due->toDateString(),
                'notes' => "Appel de loyer — bail {$lease->reference}",
                'created_by' => $by?->id,
            ]), [], $lines);

            if (config('borom.rent_calls_auto_issue')) {
                $issuer = $by ?? User::query()->active()->withRole(PermissionCatalog::SUPER_ADMIN)->orderBy('id')->first();
                $invoice = Billing::issue($invoice, $issuer ?? throw new \RuntimeException('Aucun compte pour émettre l\'appel de loyer.'));
            }

            return $lease->rentCalls()->create(['period' => $month->toDateString(), 'invoice_id' => $invoice->id]);
        });
    }

    /**
     * Résilie le bail ; avec `$relist`, le bien loué redevient disponible (visible sur le site s'il
     * est vérifié). Si la remise en location est impossible, rien n'est fait.
     */
    public function terminate(Lease $lease, string $date, string $reason, ?User $by = null, bool $relist = false): Lease
    {
        if (! $lease->isActive()) {
            throw ValidationException::withMessages(['lease' => 'Ce bail est déjà résilié.']);
        }
        if (CarbonImmutable::parse($date)->lt($lease->start_date)) {
            throw ValidationException::withMessages(['terminated_on' => 'La date de fin ne peut pas précéder le début du bail.']);
        }

        return DB::transaction(function () use ($lease, $date, $reason, $by, $relist) {
            $lease->forceFill(['status' => LeaseStatus::Resilie, 'terminated_on' => $date, 'termination_reason' => $reason])->save();

            $property = $lease->property;
            if ($relist && $by && $property->status === PropertyStatus::Loue) {
                try {
                    $this->statuses->transition($property, PropertyStatus::Disponible, "Fin du bail {$lease->reference}", $by);
                } catch (ValidationException $e) {
                    throw ValidationException::withMessages([
                        'relist' => 'Remise en location impossible : '.($e->errors()['status'][0] ?? $e->getMessage()).' Décochez la remise en location ou complétez la vérification.',
                    ]);
                }
            }

            return $lease;
        });
    }

    /**
     * Relevé de gérance : loyers encaissés sur les baux gérés du propriétaire, pas encore reversés,
     * jusqu'à la fin du mois `$period` ; commission de l'agence par bail.
     *
     * @return array{owner: Client, period: string, lines: list<array<string, mixed>>, collected: int, commission: int, commission_vat: int, payment_ids: list<int>}
     */
    public function statement(Client $owner, CarbonImmutable $period): array
    {
        $end = $period->endOfMonth();
        $payments = Payment::query()->valid()->whereNull('owner_payout_id')
            ->whereDate('paid_on', '<=', $end)
            ->whereHas('invoice.rentCall.lease', fn ($q) => $q->where('owner_id', $owner->id)->where('managed', true))
            ->with(['invoice.rentCall.lease.property', 'invoice.client'])
            ->orderBy('paid_on')
            ->get();

        $vatRate = (float) config('borom.management_fee_vat_rate');
        $lines = [];
        foreach ($payments as $payment) {
            $call = $payment->invoice->rentCall;
            $rate = (float) $call->lease->commission_rate;
            $commission = (int) round($payment->amount * $rate / 100);
            $lines[] = [
                'payment_id' => $payment->id,
                'receipt' => $payment->number,
                'paid_on' => $payment->paid_on->toDateString(),
                'lease' => $call->lease->reference,
                'property' => $call->lease->property->title,
                'tenant' => $payment->invoice->client->name,
                'month' => ucfirst($call->period->locale('fr')->translatedFormat('F Y')),
                'amount' => $payment->amount,
                'commission_rate' => $rate,
                'commission' => $commission,
            ];
        }

        $collected = array_sum(array_column($lines, 'amount'));
        $commission = array_sum(array_column($lines, 'commission'));

        return [
            'owner' => $owner,
            'period' => $period->startOfMonth()->toDateString(),
            'lines' => $lines,
            'collected' => $collected,
            'commission' => $commission,
            'commission_vat' => (int) round($commission * $vatRate / 100),
            'payment_ids' => array_column($lines, 'payment_id'),
        ];
    }

    /**
     * Fige le relevé et enregistre le versement au propriétaire.
     *
     * @param  array{method: string, reference?: string|null, paid_on: string, note?: string|null, expenses?: list<array{label: string, amount: int}>}  $data
     */
    public function recordPayout(Client $owner, CarbonImmutable $period, array $data, User $by): OwnerPayout
    {
        return DB::transaction(function () use ($owner, $period, $data, $by) {
            $statement = $this->statement($owner, $period);
            if (! $statement['lines']) {
                throw ValidationException::withMessages(['period' => 'Aucun loyer encaissé à reverser pour ce propriétaire.']);
            }

            $expenses = array_values(array_filter($data['expenses'] ?? [], fn ($e) => (int) ($e['amount'] ?? 0) > 0));
            $expensesTotal = array_sum(array_map(fn ($e) => (int) $e['amount'], $expenses));
            $net = $statement['collected'] - $statement['commission'] - $statement['commission_vat'] - $expensesTotal;
            if ($net < 0) {
                throw ValidationException::withMessages(['expenses' => 'Les frais dépassent ce qui revient au propriétaire.']);
            }

            $payout = OwnerPayout::create([
                'number' => sprintf('REV-%d-%04d', now()->year, Sequence::next('reversement')),
                'owner_id' => $owner->id,
                'period' => $statement['period'],
                'collected' => $statement['collected'],
                'commission' => $statement['commission'],
                'commission_vat' => $statement['commission_vat'],
                'expenses' => $expensesTotal,
                'net' => $net,
                'details' => ['lines' => $statement['lines'], 'expenses' => $expenses],
                'method' => $data['method'],
                'reference' => $data['reference'] ?? null,
                'paid_on' => $data['paid_on'],
                'note' => $data['note'] ?? null,
                'created_by' => $by->id,
            ]);

            Payment::query()->whereIn('id', $statement['payment_ids'])->update(['owner_payout_id' => $payout->id]);

            return $payout;
        });
    }

    public function cancelPayout(OwnerPayout $payout, string $reason, User $by): OwnerPayout
    {
        if ($payout->isCancelled()) {
            throw ValidationException::withMessages(['payout' => 'Ce reversement est déjà annulé.']);
        }

        return DB::transaction(function () use ($payout, $reason, $by) {
            $payout->forceFill(['cancelled_at' => now(), 'cancelled_by' => $by->id, 'cancel_reason' => $reason])->save();
            Payment::query()->where('owner_payout_id', $payout->id)->update(['owner_payout_id' => null]);

            return $payout;
        });
    }
}
