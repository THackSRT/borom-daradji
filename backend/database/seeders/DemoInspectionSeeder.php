<?php

namespace Database\Seeders;

use App\Enums\ClientCategory;
use App\Enums\InspectionType;
use App\Enums\Role;
use App\Models\Client;
use App\Models\Lease;
use App\Models\LeaseInspection;
use App\Models\Property;
use App\Models\User;
use App\Services\Billing;
use App\Services\InspectionService;
use App\Services\RentService;
use Illuminate\Database\Seeder;

/**
 * Fin de bail de démonstration : état des lieux d'entrée validé sur le bail de Mermoz ; bail du studio
 * du Point E résilié le mois dernier, dernier loyer impayé, états des lieux d'entrée et de sortie
 * validés (deux dégradations) : la caution est prête à être restituée.
 */
class DemoInspectionSeeder extends Seeder
{
    public function run(): void
    {
        $agent = User::withRole(Role::Agent)->firstOrFail();
        $comptable = User::withRole(Role::Comptable)->firstOrFail();
        $inspections = app(InspectionService::class);
        $rent = app(RentService::class);

        $mermoz = Lease::query()->whereHas('property', fn ($q) => $q->where('title', 'like', '%Mermoz%'))->firstOrFail();
        $this->inspect($inspections, $mermoz, InspectionType::Entree, $mermoz->start_date->toDateString(), $agent, [
            'Entrée et séjour|Murs et peinture' => ['neuf', 'Peinture refaite avant l\'entrée'],
            'Cuisine|Évier et robinetterie' => ['usage', 'Robinet un peu dur'],
        ]);

        $studio = Property::query()->where('title', 'like', '%Point E%')->firstOrFail();
        $tenant = Client::create([
            'name' => 'Ndèye Coumba Sarr',
            'phone' => '+221709876543',
            'categories' => [ClientCategory::Locataire],
            'assigned_user_id' => $agent->id,
        ]);
        $start = today()->startOfMonth()->subMonths(8);
        $lease = $rent->createLease([
            'property_id' => $studio->id,
            'tenant_id' => $tenant->id,
            'start_date' => $start->toDateString(),
            'rent' => (int) $studio->price,
            'deposit' => 2 * (int) $studio->price,
            'due_day' => 5,
            'notes' => 'Bail saisi après coup : caution reçue en espèces à l\'entrée.',
        ], $agent);
        $calls = $rent->generateCalls($lease, today()->subMonth()->toImmutable(), $comptable)->sortBy('period')->values();
        foreach ($calls->slice(0, -1) as $i => $call) {
            Billing::recordPayment($call->invoice, ['method' => 'wave', 'amount' => $call->invoice->total, 'reference' => "T_STUDIO_{$i}", 'paid_on' => $call->invoice->due_date->toDateString()], $comptable);
        }
        $rent->terminate($lease, today()->subMonth()->endOfMonth()->toDateString(), 'Départ du locataire (mutation à Saint-Louis)');

        $this->inspect($inspections, $lease, InspectionType::Entree, $start->toDateString(), $agent);
        $this->inspect($inspections, $lease, InspectionType::Sortie, today()->subMonth()->endOfMonth()->toDateString(), $agent, [
            'Chambre|Murs et peinture' => ['mauvais', 'Trous de fixation et traces au-dessus du lit'],
            'Salle de bain|Lavabo et robinetterie' => ['hors_service', 'Lavabo fendu'],
            'Entrée et séjour|Sol' => ['usage', null],
        ]);
    }

    /**
     * @param  array<string, array{0: string, 1: ?string}>  $conditions  « Pièce|Élément » => [état, commentaire] ; « bon » sinon
     */
    private function inspect(InspectionService $service, Lease $lease, InspectionType $type, string $date, User $by, array $conditions = []): LeaseInspection
    {
        $inspection = $service->create($lease, $type, [
            'inspected_on' => $date,
            'electricity_meter' => $type === InspectionType::Entree ? '012480' : '015932',
            'water_meter' => $type === InspectionType::Entree ? '00341' : '00418',
            'keys_count' => 3,
        ], $by);
        foreach ($inspection->items as $item) {
            [$condition, $comment] = $conditions["{$item->room}|{$item->element}"] ?? ['bon', null];
            $item->update(['condition' => $condition, 'comment' => $comment]);
        }

        return $service->validate($inspection, $by);
    }
}
