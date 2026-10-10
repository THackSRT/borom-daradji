<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\CompanySetting;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Données de démonstration pour le développement local. En production, utiliser
 * `php artisan borom:create-director`.
 *
 * Les événements de modèle restent actifs : ils créent les références des biens et leur
 * liste de vérification foncière.
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        CompanySetting::current()->update([
            'legal_name' => 'Borom Daradji SARL',
            'address' => 'Avenue Cheikh Anta Diop',
            'city' => 'Dakar',
            'phone' => '+221771234567',
            'whatsapp' => '+221771234567',
            'email' => 'contact@boromdaradji.sn',
        ]);

        $accounts = [
            ['Dirigeant Démo', 'dirigeant@boromdaradji.test', [Role::Dirigeant]],
            ['Agent Démo', 'agent@boromdaradji.test', [Role::Agent, Role::Commercial]],
            ['Responsable Travaux Démo', 'travaux@boromdaradji.test', [Role::ResponsableTravaux]],
            ['Comptable Démo', 'comptable@boromdaradji.test', [Role::Comptable]],
        ];

        foreach ($accounts as [$name, $email, $roles]) {
            User::factory()->withRoles(...$roles)->create(['name' => $name, 'email' => $email]);
        }

        $this->call([DemoCrmSeeder::class, DemoBillingSeeder::class]);
    }
}
