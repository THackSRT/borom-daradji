<?php

namespace App\Services;

use App\Enums\Role;
use App\Enums\TaskPriority;
use App\Models\Invoice;
use App\Models\Lease;
use App\Models\Task;
use App\Models\User;
use App\Support\PermissionCatalog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Relances et alertes de la gestion locative et de la facturation (lot 2), lancées chaque matin.
 * Rien n'est envoyé au client : une tâche arrive chez la personne qui le suit, avec le reste à payer ;
 * elle relance par téléphone ou WhatsApp (lien pré-rempli sur la fiche de la facture ou du bail).
 */
class ReminderService
{
    /**
     * Factures émises en retard qui atteignent un nouveau palier (J+3, J+15, J+30 par défaut) :
     * une tâche par client et par personne, au palier le plus haut atteint.
     *
     * @return int nombre de tâches créées
     */
    public function remindOverdue(?CarbonImmutable $today = null): int
    {
        $today = ($today ?? CarbonImmutable::today())->startOfDay();
        $thresholds = collect(config('borom.reminder_days'))->filter(fn (int $d) => $d > 0)->sort()->values();
        if ($thresholds->isEmpty()) {
            return 0;
        }

        $due = Invoice::query()->overdue()
            ->with(['client', 'property', 'rentCall.lease'])
            ->whereDate('due_date', '<=', $today->subDays($thresholds->first()))
            ->get()
            ->map(function (Invoice $invoice) use ($today, $thresholds) {
                $late = (int) $invoice->due_date->startOfDay()->diffInDays($today);
                $level = $thresholds->filter(fn (int $d) => $late >= $d)->count();

                return $level > $invoice->reminder_level ? ['invoice' => $invoice, 'late' => $late, 'level' => $level] : null;
            })
            ->filter()
            ->groupBy(fn (array $row) => $this->assigneeFor($row['invoice'])?->id.'|'.$row['invoice']->client_id);

        DB::transaction(function () use ($due, $today, $thresholds) {
            foreach ($due as $rows) {
                $this->createReminderTask($rows, $today, $thresholds);
            }
        });

        return $due->count();
    }

    /**
     * Baux dont la fin prévue approche : une alerte, une seule fois, à l'agent du bail.
     *
     * @return int nombre d'alertes créées
     */
    public function alertLeaseEnds(?CarbonImmutable $today = null): int
    {
        $today = ($today ?? CarbonImmutable::today())->startOfDay();
        $leases = Lease::query()->active()->with(['property', 'tenant'])
            ->whereNull('end_alerted_at')
            ->whereNotNull('end_date')
            ->whereDate('end_date', '<=', $today->addDays((int) config('borom.lease_end_alert_days')))
            ->get();

        foreach ($leases as $lease) {
            Task::create([
                'user_id' => $lease->agent_id ?? $lease->property->agent_id ?? $this->fallbackUser()?->id,
                'client_id' => $lease->tenant_id,
                'property_id' => $lease->property_id,
                'title' => "Bail {$lease->reference} : fin prévue le {$lease->end_date->format('d/m/Y')}",
                'details' => "{$lease->tenant->name} — {$lease->property->title}. Renouveler le bail, ou préparer le départ : "
                    .'confirmer le préavis, fixer l\'état des lieux de sortie, prévoir la restitution de la caution.',
                'due_at' => $today->setTime(9, 0),
                'priority' => TaskPriority::Haute,
            ]);
            $lease->forceFill(['end_alerted_at' => now()])->saveQuietly();
        }

        return $leases->count();
    }

    /**
     * @param  Collection<int, array{invoice: Invoice, late: int, level: int}>  $rows
     * @param  Collection<int, int>  $thresholds
     */
    private function createReminderTask(Collection $rows, CarbonImmutable $today, Collection $thresholds): void
    {
        $first = $rows->first()['invoice'];
        $client = $first->client;
        $level = $rows->max('level');
        $total = (int) $rows->sum(fn (array $r) => $r['invoice']->balance());
        $labels = $rows->map(fn (array $r) => '— '.$this->describe($r['invoice']).' : '.Billing::money($r['invoice']->balance())." (échue depuis {$r['late']} jours)");
        $what = match (true) {
            $rows->count() > 1 => "{$rows->count()} factures impayées",
            $first->rentCall !== null => $this->describe($first).' impayé',
            default => $this->describe($first).' impayée',
        };

        Task::create([
            'user_id' => $this->assigneeFor($first)?->id,
            'client_id' => $client->id,
            'property_id' => $rows->count() === 1 ? $first->property_id : null,
            'title' => "Relancer {$client->name} : {$what}, J+{$thresholds[$level - 1]}",
            'details' => 'Reste à payer : '.Billing::money($total).".\n".$labels->join("\n")
                ."\nRelancer par téléphone ou WhatsApp (lien sur la fiche de la facture ou du bail).",
            'due_at' => $today->setTime(9, 0),
            'priority' => $level >= 2 ? TaskPriority::Haute : TaskPriority::Normale,
        ]);

        foreach ($rows as $row) {
            $row['invoice']->forceFill(['reminder_level' => $row['level'], 'last_reminded_at' => now()])->saveQuietly();
        }
    }

    private function describe(Invoice $invoice): string
    {
        $call = $invoice->rentCall;

        if (! $call) {
            return "facture {$invoice->number}";
        }
        $month = $call->period->locale('fr')->translatedFormat('F Y');

        return 'loyer '.(in_array(mb_substr($month, 0, 1), ['a', 'o'], true) ? "d'" : 'de ').$month;
    }

    /**
     * Qui relance : l'agent du bail, sinon celui du bien, sinon la personne qui suit le client,
     * sinon un comptable, sinon le dirigeant.
     */
    private function assigneeFor(Invoice $invoice): ?User
    {
        $id = $invoice->rentCall?->lease?->agent_id
            ?? $invoice->property?->agent_id
            ?? $invoice->client?->assigned_user_id;

        return ($id ? User::query()->active()->find($id) : null) ?? $this->fallbackUser();
    }

    private function fallbackUser(): ?User
    {
        return User::query()->active()->withRole(Role::Comptable->value)->orderBy('id')->first()
            ?? User::query()->active()->withRole(PermissionCatalog::SUPER_ADMIN)->orderBy('id')->first();
    }
}
