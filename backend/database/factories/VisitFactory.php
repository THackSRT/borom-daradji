<?php

namespace Database\Factories;

use App\Models\Client;
use App\Models\Property;
use App\Models\Visit;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Visit>
 */
class VisitFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'property_id' => Property::factory(),
            'client_id' => Client::factory(),
            'scheduled_at' => now()->addDay()->setTime(10, 0),
        ];
    }
}
