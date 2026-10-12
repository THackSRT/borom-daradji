<?php

namespace Tests\Feature\Properties;

use App\Enums\PropertyCheckItem;
use App\Enums\Role;
use App\Models\Property;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PropertyManagementTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return [
            'title' => 'Villa avec piscine aux Almadies',
            'type' => 'villa',
            'transaction' => 'vente',
            'price' => 850_000_000,
            'surface' => 450,
            'rooms' => 8,
            'city' => 'Dakar',
            'neighborhood' => 'Almadies',
            'land_status' => 'titre_foncier',
            'features' => ['Piscine', 'Vue mer'],
            ...$overrides,
        ];
    }

    public function test_agent_creates_a_draft_with_reference_slug_and_land_checklist(): void
    {
        $agent = User::factory()->withRoles(Role::Agent)->create();
        Sanctum::actingAs($agent);

        $response = $this->postJson('/api/properties', $this->payload())->assertCreated();

        $year = now()->year;
        $response->assertJsonPath('data.reference', "BD-{$year}-0001")
            ->assertJsonPath('data.slug', "villa-avec-piscine-aux-almadies-bd-{$year}-0001")
            ->assertJsonPath('data.status.value', 'brouillon')
            ->assertJsonPath('data.agent.id', $agent->id)
            ->assertJsonCount(count(PropertyCheckItem::cases()), 'data.checks');

        $this->postJson('/api/properties', $this->payload(['title' => 'Deuxième bien']))
            ->assertJsonPath('data.reference', "BD-{$year}-0002");

        // La liste suit l'ordre logique de la vérification, pas l'ordre alphabétique des codes.
        $this->getJson("/api/properties/{$response->json('data.id')}")
            ->assertJsonPath('data.checks.0.item.value', PropertyCheckItem::IdentiteProprietaire->value)
            ->assertJsonPath('data.checks.5.item.value', PropertyCheckItem::MandatSigne->value);
    }

    public function test_other_roles_can_read_but_not_write(): void
    {
        $property = Property::factory()->create();

        foreach ([Role::Comptable, Role::ResponsableTravaux, Role::Commercial] as $role) {
            Sanctum::actingAs(User::factory()->withRoles($role)->create());

            $this->getJson("/api/properties/{$property->id}")->assertOk();
            $this->postJson('/api/properties', $this->payload())->assertForbidden();
            $this->putJson("/api/properties/{$property->id}", ['price' => 1])->assertForbidden();
            $this->deleteJson("/api/properties/{$property->id}")->assertForbidden();
        }
    }

    public function test_prices_must_be_whole_cfa_francs(): void
    {
        Sanctum::actingAs(User::factory()->withRoles(Role::Agent)->create());

        $this->postJson('/api/properties', $this->payload(['price' => 1500.5]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('price');
    }

    public function test_archiving_hides_the_property_but_keeps_it(): void
    {
        $property = Property::factory()->create();
        Sanctum::actingAs(User::factory()->withRoles(Role::Agent)->create());

        $this->deleteJson("/api/properties/{$property->id}")->assertNoContent();

        $this->assertSoftDeleted($property);
        $this->getJson('/api/properties')->assertJsonCount(0, 'data');
        $this->getJson('/api/properties?archived=1')->assertJsonCount(1, 'data');
    }

    public function test_list_filters_by_transaction_and_price(): void
    {
        Property::factory()->create(['price' => 90_000_000]);
        Property::factory()->create(['price' => 300_000_000]);
        Property::factory()->forRent()->create();
        Sanctum::actingAs(User::factory()->withRoles(Role::Comptable)->create());

        $this->getJson('/api/properties?transaction=vente&price_max=100000000')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.price', 90_000_000);
    }
}
