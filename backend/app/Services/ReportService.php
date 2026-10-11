<?php

namespace App\Services;

use App\Enums\Activity;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentMethod;
use App\Models\Article;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Purchase;
use App\Models\Worksite;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Tableau de bord du dirigeant (lot 5). Chiffre d'affaires = factures émises moins avoirs émis, hors
 * taxes, à la date d'émission, par activité. Encaissements = paiements valides à leur date, hors
 * retenues sur caution (ce n'est pas de l'argent reçu). Impayés : reste à payer des factures émises,
 * par ancienneté de l'échéance.
 */
class ReportService
{
    public function __construct(private WorksiteCosts $costs) {}

    /**
     * @return array<string, mixed>
     */
    public function overview(CarbonImmutable $from, CarbonImmutable $to, ?string $preset = 'mois'): array
    {
        [$previousFrom, $previousTo] = self::previousPeriod($from, $to, $preset);

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'previous_period' => ['from' => $previousFrom->toDateString(), 'to' => $previousTo->toDateString()],
            'revenue' => [
                'total' => array_sum($current = $this->revenueByActivity($from, $to)),
                'previous_total' => array_sum($this->revenueByActivity($previousFrom, $previousTo)),
                'by_activity' => collect(Activity::cases())->map(fn (Activity $a) => ['activity' => $a->toOption(), 'amount' => $current[$a->value] ?? 0])->values(),
                'monthly' => $this->monthlyRevenue($to),
            ],
            'collections' => $this->collections($from, $to, $previousFrom, $previousTo),
            'receivables' => $this->receivables($to),
            'rents' => $this->overdueRents(),
            'worksites' => $this->worksites(),
            'stock' => $this->stock(),
            'payables' => $this->payables(),
        ];
    }

    /**
     * Période de comparaison selon le préréglage : mois (et mois précédent) → les mêmes jours le mois
     * d'avant ; trimestre → les mêmes jours au trimestre d'avant ; année → les mêmes dates l'année
     * d'avant ; dates libres → la période de même durée juste avant.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    public static function previousPeriod(CarbonImmutable $from, CarbonImmutable $to, ?string $preset = null): array
    {
        return match ($preset) {
            'mois' => [$from->subMonthNoOverflow(), $to->subMonthNoOverflow()],
            'mois_precedent' => [$from->subMonthNoOverflow()->startOfMonth(), $from->subMonthNoOverflow()->endOfMonth()->startOfDay()],
            'trimestre' => [$from->subMonthsNoOverflow(3), $to->subMonthsNoOverflow(3)],
            'annee', 'annee_precedente' => [$from->subYearNoOverflow(), $to->subYearNoOverflow()],
            default => [$from->subDays((int) $from->diffInDays($to) + 1), $from->subDay()],
        };
    }

    /**
     * @return array<string, int> activité => CA HT
     */
    public function revenueByActivity(CarbonImmutable $from, CarbonImmutable $to): array
    {
        return $this->issued($from, $to)
            ->groupBy(fn (Invoice $i) => $i->activity->value)
            ->map(fn (Collection $rows) => (int) $rows->sum(fn (Invoice $i) => $i->isCreditNote() ? -$i->subtotal : $i->subtotal))
            ->all();
    }

    /**
     * Douze derniers mois (jusqu'au mois de `to`), par activité.
     *
     * @return list<array<string, mixed>>
     */
    private function monthlyRevenue(CarbonImmutable $to): array
    {
        $start = $to->startOfMonth()->subMonths(11);
        $invoices = $this->issued($start, $to->endOfMonth())->groupBy(fn (Invoice $i) => $i->issue_date->format('Y-m'));
        $months = [];
        for ($m = $start; $m <= $to; $m = $m->addMonth()) {
            $key = $m->format('Y-m');
            $row = ['month' => $key, 'label' => ucfirst($m->locale('fr')->translatedFormat('M Y'))];
            foreach (Activity::cases() as $activity) {
                $row[$activity->value] = (int) ($invoices[$key] ?? collect())->where('activity', $activity)
                    ->sum(fn (Invoice $i) => $i->isCreditNote() ? -$i->subtotal : $i->subtotal);
            }
            $months[] = $row;
        }

        return $months;
    }

    /**
     * @return Collection<int, Invoice>
     */
    private function issued(CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        return Invoice::query()->where('status', InvoiceStatus::Emise)
            ->whereDate('issue_date', '>=', $from->toDateString())->whereDate('issue_date', '<=', $to->toDateString())
            ->get(['id', 'type', 'activity', 'subtotal', 'issue_date']);
    }

    /**
     * @return array<string, mixed>
     */
    private function collections(CarbonImmutable $from, CarbonImmutable $to, CarbonImmutable $previousFrom, CarbonImmutable $previousTo): array
    {
        $query = fn (CarbonImmutable $a, CarbonImmutable $b) => Payment::query()->valid()->where('method', '!=', PaymentMethod::Caution)
            ->whereDate('paid_on', '>=', $a->toDateString())->whereDate('paid_on', '<=', $b->toDateString());
        $byMethod = $query($from, $to)->selectRaw('method, sum(amount) as total, count(*) as n')->groupBy('method')->get();

        return [
            'total' => (int) $byMethod->sum('total'),
            'previous_total' => (int) $query($previousFrom, $previousTo)->sum('amount'),
            'count' => (int) $byMethod->sum('n'),
            'by_method' => $byMethod->map(fn ($row) => [
                'method' => PaymentMethod::from($row->method instanceof PaymentMethod ? $row->method->value : $row->method)->toOption(),
                'amount' => (int) $row->total,
            ])->sortByDesc('amount')->values(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function receivables(CarbonImmutable $at): array
    {
        $open = Invoice::query()->outstanding()->with('client:id,name,phone')->get();
        $buckets = ['not_due' => 0, 'd0_30' => 0, 'd31_60' => 0, 'd61_90' => 0, 'over_90' => 0];
        foreach ($open as $invoice) {
            $late = $invoice->due_date && $invoice->due_date->lt($at) ? (int) $invoice->due_date->diffInDays($at) : -1;
            $key = match (true) {
                $late < 0 => 'not_due',
                $late <= 30 => 'd0_30',
                $late <= 60 => 'd31_60',
                $late <= 90 => 'd61_90',
                default => 'over_90',
            };
            $buckets[$key] += $invoice->balance();
        }

        return [
            'total' => array_sum($buckets),
            'overdue' => array_sum($buckets) - $buckets['not_due'],
            'buckets' => $buckets,
            'top_debtors' => $open->groupBy('client_id')->map(fn (Collection $rows) => [
                'client' => ['id' => $rows->first()->client->id, 'name' => $rows->first()->client->name, 'phone' => $rows->first()->client->phone],
                'amount' => (int) $rows->sum(fn (Invoice $i) => $i->balance()),
                'invoices' => $rows->count(),
            ])->sortByDesc('amount')->take(5)->values(),
        ];
    }

    /**
     * @return array<string, int>
     */
    private function overdueRents(): array
    {
        $rents = Invoice::query()->overdue()->whereHas('rentCall')->get();

        return [
            'count' => $rents->count(),
            'amount' => (int) $rents->sum(fn (Invoice $i) => $i->balance()),
            'tenants' => $rents->pluck('client_id')->unique()->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function worksites(): array
    {
        $open = Worksite::query()->open()->with(['client:id,name', 'lots'])->get();
        $rows = $open->map(function (Worksite $w) {
            $summary = $this->costs->summary($w);

            return [
                'id' => $w->id,
                'reference' => $w->reference,
                'title' => $w->title,
                'client' => $w->client?->name,
                'progress' => $w->progress(),
                'planned_end_date' => $w->planned_end_date?->toDateString(),
                'is_late' => $w->planned_end_date?->isPast() === true,
                'over_budget' => $summary['over_budget'],
                'consumed_rate' => $summary['consumed_rate'],
                'margin' => $summary['margin'],
            ];
        });

        return [
            'open' => $open->count(),
            'late' => $rows->where('is_late', true)->count(),
            'over_budget' => $rows->where('over_budget', true)->count(),
            'attention' => $rows->filter(fn ($r) => $r['is_late'] || $r['over_budget'])->values(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function stock(): array
    {
        $active = Article::query()->where('is_active', true);

        return [
            'value' => (int) round((float) (clone $active)->where('quantity', '>', 0)->selectRaw('sum(quantity * average_cost) as v')->value('v')),
            'low_count' => (clone $active)->low()->count(),
            'low' => (clone $active)->low()->orderBy('name')->limit(8)->get(['id', 'reference', 'name', 'unit', 'quantity', 'min_quantity'])
                ->map(fn (Article $a) => ['id' => $a->id, 'reference' => $a->reference, 'name' => $a->name, 'unit' => $a->unit, 'quantity' => $a->quantity, 'min_quantity' => $a->min_quantity]),
        ];
    }

    /**
     * @return array<string, int>
     */
    private function payables(): array
    {
        $unpaid = Purchase::query()->unpaid();

        return [
            'total' => (int) (clone $unpaid)->selectRaw('sum(total - paid_total) as v')->value('v'),
            'overdue' => (int) (clone $unpaid)->whereDate('due_date', '<', today())->selectRaw('sum(total - paid_total) as v')->value('v'),
            'count' => (clone $unpaid)->count(),
        ];
    }
}
