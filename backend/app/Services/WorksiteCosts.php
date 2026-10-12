<?php

namespace App\Services;

use App\Enums\Role;
use App\Enums\StockMovementType;
use App\Enums\TaskPriority;
use App\Models\SiteCashEntry;
use App\Models\StockMovement;
use App\Models\Task;
use App\Models\User;
use App\Models\WorkerTask;
use App\Models\Worksite;
use App\Models\WorksiteAttendance;
use App\Support\PermissionCatalog;

/**
 * Budget prévu et coût réel d'un chantier. Coût réel = main-d'œuvre des tâcherons (journées pointées et
 * tâches terminées, qu'elles soient déjà payées ou non) + matériaux sortis du stock (au CMUP, retours
 * déduits) + dépenses de la caisse de chantier. Les paiements
 * des tâcherons ne s'ajoutent pas : ils règlent un travail déjà compté. Au-delà du budget plus la
 * tolérance (10 %), une tâche d'alerte, une seule fois tant que le budget ne change pas.
 */
class WorksiteCosts
{
    /** Catégorie de dépense de caisse → poste du budget. */
    private const BUDGET_LINE = [
        'materiaux' => 'materials',
        'main_oeuvre' => 'labor',
        'transport' => 'other',
        'outillage' => 'other',
        'divers' => 'other',
    ];

    /**
     * @return array<string, mixed>
     */
    public function summary(Worksite $worksite): array
    {
        $attendances = (int) WorksiteAttendance::query()->where('worksite_id', $worksite->id)->sum('amount');
        $days = (float) WorksiteAttendance::query()->where('worksite_id', $worksite->id)->sum('days');
        $tasks = (int) WorkerTask::query()->where('worksite_id', $worksite->id)->where('status', 'terminee')->sum('amount');

        $expenses = SiteCashEntry::query()->valid()->where('worksite_id', $worksite->id)->where('kind', 'depense')
            ->selectRaw('category, sum(amount) as total')->groupBy('category')->pluck('total', 'category')
            ->map(fn ($v) => (int) $v);
        // Matériaux sortis du stock vers ce chantier, retours déduits (valeurs signées des mouvements).
        $stock = -(int) StockMovement::query()->where('worksite_id', $worksite->id)
            ->whereIn('type', [StockMovementType::SortieChantier, StockMovementType::RetourChantier])->sum('value');
        $actual = ['materials' => $stock, 'labor' => $attendances + $tasks, 'other' => 0];
        foreach ($expenses as $category => $total) {
            $actual[self::BUDGET_LINE[$category] ?? 'other'] += $total;
        }
        $actualTotal = array_sum($actual);
        $planned = $worksite->budgetTotal();
        $tolerance = (float) config('borom.budget_alert_tolerance');

        return [
            'planned' => [
                'materials' => $worksite->budget_materials,
                'labor' => $worksite->budget_labor,
                'other' => $worksite->budget_other,
                'total' => $planned,
            ],
            'actual' => [...$actual, 'total' => $actualTotal],
            'labor_detail' => ['days' => $days, 'attendances' => $attendances, 'tasks' => $tasks],
            'materials_detail' => ['stock' => $stock, 'cash' => (int) ($expenses['materiaux'] ?? 0)],
            'expenses_by_category' => collect(SiteCashEntry::CATEGORIES)
                ->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label, 'total' => $expenses[$key] ?? 0])
                ->values(),
            'consumed_rate' => $planned > 0 ? round($actualTotal * 100 / $planned, 1) : null,
            'tolerance' => $tolerance,
            'over_budget' => $this->isOver($planned, $actualTotal),
            'contract_ht' => $worksite->contract_ht,
            'margin' => $worksite->contract_ht - $actualTotal,
            'alerted_at' => $worksite->budget_alerted_at?->toIso8601String(),
        ];
    }

    public function actualTotal(Worksite $worksite): int
    {
        return $this->summary($worksite)['actual']['total'];
    }

    /**
     * À appeler après tout ce qui fait monter le coût (pointage, tâche terminée, dépense) ou change le
     * budget : crée la tâche d'alerte au premier dépassement.
     */
    public function checkAlert(Worksite $worksite): bool
    {
        $worksite->refresh();
        if ($worksite->budget_alerted_at || ! $this->isOver($worksite->budgetTotal(), $actual = $this->actualTotal($worksite))) {
            return false;
        }

        $planned = $worksite->budgetTotal();
        Task::create([
            'user_id' => $this->assignee($worksite)?->id,
            'client_id' => $worksite->client_id,
            'property_id' => $worksite->property_id,
            'title' => "Chantier {$worksite->reference} : budget dépassé de ".round(($actual - $planned) * 100 / $planned).' %',
            'details' => "{$worksite->title}. Coût réel ".Billing::money($actual).' pour un budget de '.Billing::money($planned)
                .".\nVérifier les dépenses et la main-d'œuvre, ajuster le budget ou prévoir un avenant au devis.",
            'due_at' => now(),
            'priority' => TaskPriority::Haute,
        ]);
        $worksite->forceFill(['budget_alerted_at' => now()])->saveQuietly();

        return true;
    }

    /** Budget modifié : l'alerte pourra se déclencher à nouveau sur le nouveau montant. */
    public function budgetChanged(Worksite $worksite): void
    {
        $worksite->forceFill(['budget_alerted_at' => null])->saveQuietly();
        $this->checkAlert($worksite);
    }

    private function isOver(int $planned, int $actual): bool
    {
        // Pas de budget saisi : pas d'alerte (rien à comparer).
        return $planned > 0 && $actual * 100 > $planned * (100 + (float) config('borom.budget_alert_tolerance'));
    }

    private function assignee(Worksite $worksite): ?User
    {
        return ($worksite->manager_id ? User::query()->active()->find($worksite->manager_id) : null)
            ?? User::query()->active()->withRole(Role::ResponsableTravaux->value)->orderBy('id')->first()
            ?? User::query()->active()->withRole(PermissionCatalog::SUPER_ADMIN)->orderBy('id')->first();
    }
}
