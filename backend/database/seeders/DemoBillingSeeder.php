<?php

namespace Database\Seeders;

use App\Enums\ClientCategory;
use App\Enums\Role;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Property;
use App\Models\User;
use App\Services\Billing;
use App\Services\RentService;
use Illuminate\Database\Seeder;

/**
 * Factures de démonstration : une payée, une en partie, une en retard, un brouillon.
 */
class DemoBillingSeeder extends Seeder
{
    public function run(): void
    {
        $comptable = User::withRole(Role::Comptable)->firstOrFail();
        $agent = User::withRole(Role::Agent)->firstOrFail();
        $owner = Client::where('name', 'Mamadou Ndiaye')->firstOrFail();
        $rental = Property::where('transaction', 'location')->where('status', 'disponible')->firstOrFail();

        $tenant = Client::create([
            'name' => 'Aminata Ba',
            'phone' => '+221776543210',
            'categories' => [ClientCategory::Locataire],
            'assigned_user_id' => $agent->id,
        ]);
        $company = Client::create([
            'kind' => 'entreprise',
            'name' => 'Teranga BTP SARL',
            'phone' => '+221338201020',
            'categories' => [ClientCategory::Fournisseur],
        ]);

        $draft = fn (Client $client, string $activity, array $lines, array $extra = []) => Billing::saveDraft(
            new Invoice(['client_id' => $client->id, 'activity' => $activity, 'created_by' => $comptable->id, ...$extra]),
            [],
            $lines,
        );

        // Bail en gestion : entrée il y a deux mois avec un mois d'avance (payé avec la caution),
        // le mois dernier payé par Wave, celui-ci en partie en espèces à l'agent.
        $rentService = app(RentService::class);
        $lease = $rentService->createLease([
            'property_id' => $rental->id,
            'tenant_id' => $tenant->id,
            'start_date' => today()->startOfMonth()->subMonths(2)->toDateString(),
            'rent' => (int) $rental->price,
            'charges' => 25_000,
            'deposit' => 2 * (int) $rental->price,
            'advance_months' => 1,
            'due_day' => 5,
            'managed' => true,
            'commission_rate' => 10,
        ], $agent, ['entry_invoice' => true, 'agency_fee' => (int) $rental->price]);
        $entry = Billing::issue($lease->entryInvoice, $comptable);
        Billing::recordPayment($entry, ['method' => 'virement', 'amount' => $entry->total, 'reference' => 'VIR-ENTREE-01', 'paid_on' => today()->subMonths(2)->startOfMonth()->toDateString()], $comptable);
        [$current, $previous, $first] = $rentService->entryCalls($lease, $comptable)->sortByDesc('period')->values()->all();
        Billing::recordPayment($first->invoice, ['method' => 'virement', 'amount' => $first->invoice->total, 'reference' => 'VIR-ENTREE-02', 'paid_on' => today()->subMonths(2)->startOfMonth()->toDateString()], $comptable);
        Billing::recordPayment($previous->invoice, ['method' => 'wave', 'amount' => $previous->invoice->total, 'reference' => 'T_LOYER_M1', 'paid_on' => $previous->invoice->due_date->toDateString()], $comptable);
        Billing::recordPayment($current->invoice, ['method' => 'especes', 'amount' => 200_000], $agent);

        // Commission de vente : en retard, pas encore réglée.
        Billing::issue($draft($owner, 'immobilier', [
            ['description' => 'Commission sur la vente de la villa des Almadies (5 %)', 'quantity' => 1, 'unit_price' => 2_500_000, 'vat_rate' => 18],
        ], ['issue_date' => today()->subDays(30)->toDateString()]), $comptable);

        // Frais de gestion : payés par Wave.
        $fees = Billing::issue($draft($owner, 'location', [
            ['description' => 'Frais de gestion locative — septembre', 'quantity' => 1, 'unit_price' => 45_000, 'vat_rate' => 18],
            ['description' => 'État des lieux de sortie', 'quantity' => 1, 'unit_price' => 25_000, 'vat_rate' => 18],
        ], ['issue_date' => today()->subDays(12)->toDateString()]), $comptable);
        Billing::recordPayment($fees, ['method' => 'wave', 'amount' => $fees->total, 'reference' => 'T_7HX2K9QD'], $comptable);

        // Brouillon en préparation.
        $draft($company, 'negoce', [
            ['description' => 'Ciment CEM II 42,5 (sac de 50 kg)', 'quantity' => 120, 'unit' => 'sac', 'unit_price' => 4_250, 'vat_rate' => 18],
            ['description' => 'Fer à béton HA 10 (barre de 12 m)', 'quantity' => 60, 'unit' => 'barre', 'unit_price' => 3_900, 'vat_rate' => 18],
            ['description' => 'Livraison sur chantier — Diamniadio', 'quantity' => 1, 'unit_price' => 35_000, 'vat_rate' => 18],
        ]);
    }
}
