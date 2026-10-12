<?php

namespace Database\Seeders;

use App\Enums\CheckStatus;
use App\Enums\ClientCategory;
use App\Enums\LandStatus;
use App\Enums\LeadSource;
use App\Enums\PipelineStatus;
use App\Enums\PropertyStatus;
use App\Enums\Role;
use App\Enums\TaskPriority;
use App\Models\Client;
use App\Models\Property;
use App\Models\Task;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Database\Seeder;

/**
 * Biens de l'ancien site vitrine (12, photos Unsplash) et quelques prospects, pour le développement local.
 */
class DemoCrmSeeder extends Seeder
{
    public function run(): void
    {
        $agent = User::withRole(Role::Agent)->firstOrFail();

        $owner = Client::create([
            'name' => 'Mamadou Ndiaye',
            'phone' => '+221770000101',
            'categories' => [ClientCategory::Proprietaire],
            'source' => LeadSource::Recommandation,
            'assigned_user_id' => $agent->id,
        ]);

        $rows = json_decode(file_get_contents(__DIR__.'/data/demo_properties.json'), true);

        foreach ($rows as $index => $row) {
            $property = Property::create([
                'title' => $row['title'],
                'type' => $row['type'],
                'transaction' => $row['transaction'],
                'price' => $row['price'],
                'surface' => $row['surface'],
                'rooms' => $row['rooms'] ?: null,
                'bedrooms' => $row['bedrooms'] ?: null,
                'bathrooms' => $row['bathrooms'] ?: null,
                'city' => $row['city'],
                'neighborhood' => $row['neighborhood'],
                'description' => $row['description'],
                'features' => $row['features'],
                'is_featured' => $row['featured'],
                'land_status' => LandStatus::TitreFoncier,
                'owner_id' => $owner->id,
                'agent_id' => $agent->id,
                'deposit_months' => $row['transaction'] === 'location' ? 2 : null,
                'advance_months' => $row['transaction'] === 'location' ? 1 : null,
            ]);

            foreach ($row['images'] as $position => $url) {
                $property->photos()->create(['path' => $url, 'position' => $position + 1, 'is_cover' => $position === 0]);
            }

            // Les deux derniers restent en brouillon pour montrer la vérification foncière en cours.
            if ($index < count($rows) - 2) {
                $property->checks()->update(['status' => CheckStatus::Ok->value, 'checked_by' => $agent->id, 'checked_at' => now()]);
                $property->forceFill(['status' => PropertyStatus::Disponible, 'published_at' => now()->subDays(30 - $index)])->saveQuietly();
            }
        }

        $prospects = [
            ['Awa Diallo', '+221771234567', PipelineStatus::Contacte, ['transaction' => 'vente', 'types' => ['appartement'], 'budget_max' => 200_000_000, 'cities' => ['Dakar']]],
            ['Ibrahima Fall', '+221781112233', PipelineStatus::Visite, ['transaction' => 'location', 'budget_max' => 500_000, 'neighborhoods' => ['Mermoz', 'Point E']]],
            ['Fatou Sow (diaspora)', '+221765554433', PipelineStatus::Nouveau, ['transaction' => 'vente', 'types' => ['terrain'], 'budget_max' => 30_000_000]],
        ];

        foreach ($prospects as [$name, $phone, $status, $criteria]) {
            $client = Client::create([
                'name' => $name,
                'phone' => $phone,
                'categories' => [$criteria['transaction'] === 'location' ? ClientCategory::Locataire : ClientCategory::Acheteur],
                'source' => LeadSource::Whatsapp,
                'pipeline_status' => $status,
                'assigned_user_id' => $agent->id,
            ]);
            $client->searchCriteria()->create($criteria);
        }

        $rental = Property::where('transaction', 'location')->where('neighborhood', 'Mermoz')->first();
        $ibrahima = Client::where('phone', '+221781112233')->first();

        if ($rental && $ibrahima) {
            Visit::create([
                'property_id' => $rental->id,
                'client_id' => $ibrahima->id,
                'agent_id' => $agent->id,
                'scheduled_at' => now()->addDay()->setTime(11, 0),
            ]);
        }

        Task::create([
            'user_id' => $agent->id,
            'client_id' => Client::where('phone', '+221765554433')->value('id'),
            'title' => 'Rappeler Fatou Sow (décalage horaire : après 18 h)',
            'due_at' => now()->setTime(18, 30),
            'priority' => TaskPriority::Haute,
        ]);

        $this->seedPipeline($agent);
    }

    /**
     * Prospects à toutes les étapes, échanges, visites du jour et tâches : de quoi remplir l'accueil et le pipeline.
     */
    private function seedPipeline(User $agent): void
    {
        $dirigeant = User::withRole(Role::Dirigeant)->firstOrFail();
        $properties = Property::published()->get();

        $people = [
            ['Khady Ndiaye', '+221775550001', PipelineStatus::Nouveau, LeadSource::Site, 'Bonjour, le F3 de Mermoz est-il toujours disponible ? Je peux visiter samedi.'],
            ['Ousmane Ba', '+221775550002', PipelineStatus::Nouveau, LeadSource::ReseauxSociaux, 'Vu votre annonce sur Facebook, je cherche un terrain à Diamniadio.'],
            ['Mariama Cissé', '+221775550003', PipelineStatus::Contacte, LeadSource::Whatsapp, 'Cherche une villa avec piscine, budget 600 millions. Rappeler lundi.'],
            ['Cheikh Gueye', '+221775550004', PipelineStatus::Visite, LeadSource::Recommandation, 'A visité la maison de Sacré-Cœur, intéressé mais trouve le prix élevé.'],
            ['Aïssatou Diop', '+221775550005', PipelineStatus::Negociation, LeadSource::Agence, 'Offre à 300 millions pour la maison de Sacré-Cœur, en attente du propriétaire.'],
            ['Pape Sarr', '+221775550006', PipelineStatus::Gagne, LeadSource::Site, 'Bail signé pour le local de Grand Yoff.'],
            ['Ndèye Faye', '+221775550007', PipelineStatus::Perdu, LeadSource::Appel, 'A trouvé ailleurs, moins cher.'],
        ];

        foreach ($people as $i => [$name, $phone, $status, $source, $summary]) {
            $client = Client::create([
                'name' => $name,
                'phone' => $phone,
                'categories' => [ClientCategory::Acheteur],
                'source' => $source,
                'pipeline_status' => $status,
                'assigned_user_id' => $i % 3 === 2 ? $dirigeant->id : $agent->id,
                'tags' => $i === 2 ? ['VIP'] : [],
            ]);

            $client->interactions()->create([
                'user_id' => $source === LeadSource::Site ? null : $agent->id,
                'channel' => $source === LeadSource::Site ? 'formulaire_site' : 'whatsapp',
                'summary' => $summary,
                'occurred_at' => now()->subDays(7 - $i)->setTime(10 + $i, 15),
                'property_id' => $properties->get($i % max(1, $properties->count()))?->id,
            ]);
        }

        $today = [[$properties->get(0), 'Mariama Cissé', 10], [$properties->get(3), 'Cheikh Gueye', 15]];
        foreach ($today as [$property, $name, $hour]) {
            if ($property) {
                Visit::create([
                    'property_id' => $property->id,
                    'client_id' => Client::where('name', $name)->value('id'),
                    'agent_id' => $agent->id,
                    'scheduled_at' => now()->setTime($hour, 30),
                ]);
            }
        }

        $tasks = [
            [$agent, 'Rappeler Khady Ndiaye (demande du site)', now()->subHours(3), TaskPriority::Haute, 'Khady Ndiaye'],
            [$agent, 'Relancer le propriétaire sur l\'offre d\'Aïssatou Diop', now()->subDay(), TaskPriority::Haute, 'Aïssatou Diop'],
            [$agent, 'Envoyer les photos de la villa des Almadies à Mariama', now()->setTime(17, 0), TaskPriority::Normale, 'Mariama Cissé'],
            [$agent, 'Demander l\'état des droits réels pour le studio du Point E', now()->addDay()->setTime(9, 0), TaskPriority::Normale, null],
            [$dirigeant, 'Valider la commission du bail de Grand Yoff', now()->setTime(11, 0), TaskPriority::Normale, 'Pape Sarr'],
            [$dirigeant, 'Point hebdomadaire avec les agents', now()->addDays(2)->setTime(8, 30), TaskPriority::Basse, null],
        ];
        foreach ($tasks as [$user, $title, $due, $priority, $clientName]) {
            Task::create([
                'user_id' => $user->id,
                'title' => $title,
                'due_at' => $due,
                'priority' => $priority,
                'client_id' => $clientName ? Client::where('name', $clientName)->value('id') : null,
            ]);
        }
    }
}
