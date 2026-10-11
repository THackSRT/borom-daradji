<?php

namespace Database\Factories;

use App\Enums\ClientCategory;
use App\Enums\LeadSource;
use App\Models\Client;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Client>
 */
class ClientFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'phone' => '+2217'.fake()->unique()->numerify('########'),
            'email' => fake()->optional()->safeEmail(),
            'categories' => [ClientCategory::Acheteur],
            'city' => 'Dakar',
            'source' => LeadSource::Whatsapp,
            'tags' => [],
        ];
    }

    public function owner(): static
    {
        return $this->state(fn () => ['categories' => [ClientCategory::Proprietaire]]);
    }
}
