<?php

namespace Database\Factories;

use App\Enums\CheckStatus;
use App\Enums\LandStatus;
use App\Enums\PropertyStatus;
use App\Enums\PropertyType;
use App\Enums\TransactionType;
use App\Models\Property;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Property>
 */
class PropertyFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'title' => 'Appartement '.fake()->numberBetween(2, 5).' pièces',
            'type' => PropertyType::Appartement,
            'transaction' => TransactionType::Vente,
            'price' => 150_000_000,
            'surface' => 120,
            'rooms' => 4,
            'bedrooms' => 3,
            'bathrooms' => 2,
            'features' => ['Climatisation', 'Parking'],
            'city' => 'Dakar',
            'neighborhood' => 'Mermoz',
            'land_status' => LandStatus::TitreFoncier,
        ];
    }

    public function forRent(int $monthlyRent = 450_000): static
    {
        return $this->state(fn () => ['transaction' => TransactionType::Location, 'price' => $monthlyRent]);
    }

    /**
     * Vérification foncière complète et bien publié.
     */
    public function published(): static
    {
        return $this->verified()->afterCreating(function (Property $property) {
            $property->forceFill(['status' => PropertyStatus::Disponible, 'published_at' => now()])->saveQuietly();
        });
    }

    public function verified(): static
    {
        return $this->afterCreating(function (Property $property) {
            $property->checks()->update(['status' => CheckStatus::Ok->value, 'checked_at' => now()]);
        });
    }
}
