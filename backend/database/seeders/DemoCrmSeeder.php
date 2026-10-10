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
    }
}
