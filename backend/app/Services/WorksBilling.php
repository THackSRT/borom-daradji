<?php

namespace App\Services;

use App\Enums\Activity;
use App\Enums\QuoteStatus;
use App\Enums\WorksiteStatus;
use App\Models\CompanySetting;
use App\Models\Invoice;
use App\Models\QuoteLine;
use App\Models\User;
use App\Models\Worksite;
use App\Models\WorksiteInvoice;
use App\Models\WorksiteLot;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Facturation des travaux (lot 3), à partir du marché (devis acceptés) et de l'avancement des lots :
 *
 *  - acompte : un pourcentage du marché HT, avant la première situation ;
 *  - situation n : pour chaque lot, valeur réalisée en cumul (montant du lot × avancement) moins ce qui
 *    est déjà facturé ; l'acompte est déduit au prorata de l'avancement global ;
 *  - solde : chantier terminé, tous les lots à 100 % et le reste de l'acompte déduit ; le chantier
 *    passe en « facturé ».
 *
 * Les factures sont des brouillons ordinaires (App\Services\Billing), que le comptable vérifie et
 * émet. La TVA suit celle des lignes du devis (répartie par taux s'il y en a plusieurs).
 */
class WorksBilling
{
    public const KINDS = ['acompte' => 'Acompte', 'situation' => 'Situation', 'solde' => 'Solde'];

    public function __construct(private readonly WorksiteService $worksites) {}

    /**
     * @return array<string, mixed>
     */
    public function summary(Worksite $worksite): array
    {
        $history = $this->history($worksite);
        $invoices = $history->map->invoice;
        $lastWork = $history->whereIn('kind', ['situation', 'solde'])->last();
        $deposits = (int) $history->where('kind', 'acompte')->sum('deposit_ht');

        return [
            'contract_ht' => $worksite->contract_ht,
            'contract_total' => $worksite->contract_total,
            'billed_work_ht' => $lastWork?->cumulative_ht ?? 0,
            'remaining_ht' => max(0, $worksite->contract_ht - ($lastWork?->cumulative_ht ?? 0)),
            'deposits_ht' => $deposits,
            'deposits_deducted_ht' => (int) $history->sum('deposit_deducted_ht'),
            'invoiced_total' => (int) $invoices->sum('total'),
            'paid_total' => (int) $invoices->sum('paid_total'),
            'balance' => (int) $invoices->sum(fn (Invoice $i) => max(0, $i->balance())),
            'default_deposit_rate' => (float) ($worksite->quote?->deposit_rate ?? config('borom.quote_deposit_rate')),
            'invoices' => $history->map(fn (WorksiteInvoice $wi) => [
                'id' => $wi->invoice->id,
                'kind' => ['value' => $wi->kind, 'label' => self::KINDS[$wi->kind].($wi->kind === 'situation' ? " n° {$wi->sequence}" : '')],
                'number' => $wi->invoice->number,
                'status' => $wi->invoice->status->toOption(),
                'issue_date' => $wi->invoice->issue_date?->toDateString(),
                'total' => $wi->invoice->total,
                'paid_total' => $wi->invoice->paid_total,
                'balance' => $wi->invoice->balance(),
            ])->values()->all(),
            'blocking_draft' => $invoices->first(fn (Invoice $i) => $i->isDraft())?->only(['id', 'number']),
        ];
    }

    /**
     * Factures du chantier qui comptent (ni supprimées ni annulées par avoir), dans l'ordre.
     *
     * @return Collection<int, WorksiteInvoice>
     */
    public function history(Worksite $worksite): Collection
    {
        return $worksite->worksiteInvoices()->with('invoice')->get()->filter->counts()->values();
    }

    /**
     * Lignes de la prochaine facture, sans rien enregistrer.
     *
     * @return array{kind: string, sequence: int, lines: list<array<string, mixed>>, cumulative_ht: int, deposit_ht: int, deposit_deducted_ht: int, lots: list<array<string, mixed>>, total_ht: int}
     */
    public function preview(Worksite $worksite, string $kind, ?float $depositRate = null): array
    {
        if ($worksite->contract_ht <= 0) {
            throw ValidationException::withMessages(['kind' => 'Pas de marché sur ce chantier : un devis accepté est nécessaire pour facturer.']);
        }
        if ($worksite->status === WorksiteStatus::Facture) {
            throw ValidationException::withMessages(['kind' => 'Ce chantier est entièrement facturé.']);
        }
        $history = $this->history($worksite);
        if ($draft = $history->map->invoice->first(fn (Invoice $i) => $i->isDraft())) {
            throw ValidationException::withMessages(['kind' => 'Une facture du chantier est encore en brouillon : émettez-la ou supprimez-la d\'abord.']);
        }

        return match ($kind) {
            'acompte' => $this->depositPreview($worksite, $history, $depositRate),
            'situation', 'solde' => $this->workPreview($worksite, $history, $kind),
            default => throw ValidationException::withMessages(['kind' => 'Type de facture inconnu.']),
        };
    }

    public function create(Worksite $worksite, string $kind, User $by, ?float $depositRate = null): Invoice
    {
        return DB::transaction(function () use ($worksite, $kind, $by, $depositRate) {
            $worksite = Worksite::query()->lockForUpdate()->findOrFail($worksite->id);
            $preview = $this->preview($worksite, $kind, $depositRate);
            if ($preview['total_ht'] <= 0) {
                throw ValidationException::withMessages(['kind' => 'Rien à facturer.']);
            }

            $label = self::KINDS[$kind].($kind === 'situation' ? " n° {$preview['sequence']}" : '');
            $invoice = Billing::saveDraft(new Invoice([
                'client_id' => $worksite->client_id,
                'property_id' => $worksite->property_id,
                'activity' => Activity::Travaux,
                'notes' => "{$label} — chantier {$worksite->reference} « {$worksite->title} »"
                    .($worksite->quote ? ", devis {$worksite->quote->number}" : '').'.',
                'created_by' => $by->id,
            ]), [], $preview['lines']);

            $worksite->worksiteInvoices()->create([
                'invoice_id' => $invoice->id,
                'kind' => $kind,
                'sequence' => $preview['sequence'],
                'cumulative_ht' => $preview['cumulative_ht'],
                'deposit_ht' => $preview['deposit_ht'],
                'deposit_deducted_ht' => $preview['deposit_deducted_ht'],
                'lots' => $preview['lots'],
                'created_by' => $by->id,
            ]);

            if ($kind === 'solde') {
                $this->worksites->transition($worksite, WorksiteStatus::Facture, $by, "Facture de solde préparée ({$this->money($invoice->total)} TTC).");
            }

            return $invoice;
        });
    }

    /**
     * @param  Collection<int, WorksiteInvoice>  $history
     * @return array<string, mixed>
     */
    private function depositPreview(Worksite $worksite, Collection $history, ?float $rate): array
    {
        if ($history->whereIn('kind', ['situation', 'solde'])->isNotEmpty()) {
            throw ValidationException::withMessages(['kind' => 'L\'acompte se facture avant la première situation.']);
        }
        $rate ??= (float) ($worksite->quote?->deposit_rate ?? config('borom.quote_deposit_rate'));
        if ($rate <= 0 || $rate > 100) {
            throw ValidationException::withMessages(['deposit_rate' => 'Indiquez un pourcentage d\'acompte entre 1 et 100.']);
        }
        $already = (int) $history->where('kind', 'acompte')->sum('deposit_ht');
        $amount = (int) round($worksite->contract_ht * $rate / 100);
        if ($already + $amount > $worksite->contract_ht) {
            throw ValidationException::withMessages(['deposit_rate' => 'Les acomptes dépasseraient le montant du marché.']);
        }

        $label = rtrim(rtrim(number_format($rate, 2, ',', ''), '0'), ',');
        $lines = [];
        foreach ($this->split($amount, $this->contractRates($worksite)) as $vat => $share) {
            $lines[] = ['description' => "Acompte de {$label} % sur le marché de {$this->money($worksite->contract_ht)} HT", 'quantity' => 1, 'unit_price' => $share, 'vat_rate' => (float) $vat];
        }

        return [
            'kind' => 'acompte', 'sequence' => 0, 'lines' => $lines, 'cumulative_ht' => 0,
            'deposit_ht' => $amount, 'deposit_deducted_ht' => 0, 'lots' => [], 'total_ht' => $amount,
        ];
    }

    /**
     * @param  Collection<int, WorksiteInvoice>  $history
     * @return array<string, mixed>
     */
    private function workPreview(Worksite $worksite, Collection $history, string $kind): array
    {
        if ($kind === 'solde' && $worksite->status !== WorksiteStatus::Termine) {
            throw ValidationException::withMessages(['kind' => 'Le solde se facture quand le chantier est terminé.']);
        }
        $works = $history->whereIn('kind', ['situation', 'solde']);
        $previous = collect($works->last()?->lots ?? [])->keyBy('lot_id');
        $deposits = (int) $history->where('kind', 'acompte')->sum('deposit_ht');
        $deducted = (int) $history->sum('deposit_deducted_ht');

        $lines = [];
        $snapshot = [];
        $cumulative = 0;
        foreach ($worksite->lots()->get() as $lot) {
            $progress = $kind === 'solde' ? 100 : $lot->progress;
            $value = (int) round($lot->amount_ht * $progress / 100);
            $billed = (int) ($previous[$lot->id]['cumulative_ht'] ?? 0);
            if ($value < $billed) {
                throw ValidationException::withMessages(['kind' => "{$lot->title} : l'avancement ({$progress} %) est inférieur à ce qui est déjà facturé."]);
            }
            if ($value > $billed) {
                foreach ($this->split($value - $billed, $this->lotRates($lot, $worksite)) as $vat => $share) {
                    $lines[] = [
                        'description' => "{$lot->title} : avancement {$progress} % (cumul {$this->money($value)}, déjà facturé {$this->money($billed)})",
                        'quantity' => 1, 'unit_price' => $share, 'vat_rate' => (float) $vat,
                    ];
                }
            }
            $snapshot[] = ['lot_id' => $lot->id, 'title' => $lot->title, 'progress' => $progress, 'cumulative_ht' => $value];
            $cumulative += $value;
        }
        if (! $lines) {
            throw ValidationException::withMessages(['kind' => $kind === 'solde'
                ? 'Tout est déjà facturé.'
                : 'Rien de nouveau à facturer : mettez d\'abord à jour l\'avancement des lots.']);
        }

        $workHt = array_sum(array_column($lines, 'unit_price'));
        $deduction = 0;
        if ($deposits > 0) {
            $target = $kind === 'solde' ? $deposits : (int) round($deposits * min(1, $cumulative / $worksite->contract_ht));
            $deduction = max(0, $target - $deducted);
            foreach ($this->split($deduction, $this->contractRates($worksite)) as $vat => $share) {
                $lines[] = ['description' => 'Déduction de l\'acompte, au prorata de l\'avancement', 'quantity' => 1, 'unit_price' => -$share, 'vat_rate' => (float) $vat];
            }
        }

        return [
            'kind' => $kind,
            'sequence' => $kind === 'situation' ? $works->where('kind', 'situation')->count() + 1 : 0,
            'lines' => $lines,
            'cumulative_ht' => $cumulative,
            'deposit_ht' => 0,
            'deposit_deducted_ht' => $deduction,
            'lots' => $snapshot,
            'total_ht' => $workHt - $deduction,
        ];
    }

    /**
     * Montant HT du marché par taux de TVA (lignes des devis acceptés du chantier).
     *
     * @return array<string, int>
     */
    private function contractRates(Worksite $worksite): array
    {
        $rates = QuoteLine::query()
            ->whereHas('lot.quote', fn ($q) => $q->where('worksite_id', $worksite->id)->where('status', QuoteStatus::Accepte))
            ->get()
            ->groupBy(fn (QuoteLine $l) => (string) (float) $l->vat_rate)
            ->map(fn ($lines) => (int) $lines->sum('net_amount'))
            ->filter()
            ->all();

        return $rates ?: [(string) (float) CompanySetting::current()->vat_rate => 1];
    }

    /**
     * @return array<string, int>
     */
    private function lotRates(WorksiteLot $lot, Worksite $worksite): array
    {
        if (! $lot->quote_lot_id) {
            return $this->contractRates($worksite);
        }
        $rates = QuoteLine::query()->where('quote_lot_id', $lot->quote_lot_id)->get()
            ->groupBy(fn (QuoteLine $l) => (string) (float) $l->vat_rate)
            ->map(fn ($lines) => (int) $lines->sum('net_amount'))
            ->filter()
            ->all();

        return $rates ?: $this->contractRates($worksite);
    }

    /**
     * Répartit un montant au prorata des poids, au franc près (le reste va à la plus grosse part).
     *
     * @param  array<string, int>  $weights
     * @return array<string, int>
     */
    private function split(int $amount, array $weights): array
    {
        if ($amount === 0) {
            return [];
        }
        $total = array_sum($weights);
        $parts = [];
        foreach ($weights as $key => $weight) {
            $parts[$key] = (int) floor($amount * $weight / $total);
        }
        arsort($weights);
        $parts[array_key_first($weights)] += $amount - array_sum($parts);

        return array_filter($parts);
    }

    private function money(int $amount): string
    {
        return Billing::money($amount);
    }
}
