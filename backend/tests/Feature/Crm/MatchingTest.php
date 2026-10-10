<?php

namespace Tests\Feature\Crm;

use App\Enums\Role;
use App\Models\Client;
use App\Models\Property;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MatchingTest extends TestCase
{
    use RefreshDatabase;

    private User $agent;

    protected function setUp(): void
    {
        parent::setUp();

        $this->agent = User::factory()->withRoles(Role::Agent)->create();
        Sanctum::actingAs($this->agent);
    }

    private function prospect(string $name, array $criteria, ?User $assigned = null): Client
    {
        $client = Client::factory()->create(['name' => $name, 'assigned_user_id' => $assigned?->id]);
        $this->postJson("/api/clients/{$client->id}/search-criteria", $criteria)->assertCreated();

        return $client;
    }

    public function test_publishing_a_property_creates_a_task_for_each_matching_prospect(): void
    {
        $commercial = User::factory()->withRoles(Role::Commercial)->create();
        $property = Property::factory()->verified()->create([
            'type' => 'appartement', 'price' => 200_000_000, 'rooms' => 4, 'neighborhood' => 'Sacré-Cœur 3',
        ]);

        $match = $this->prospect('Awa', ['transaction' => 'vente', 'types' => ['appartement'], 'budget_max' => 190_000_000, 'neighborhoods' => ['Sacré-Cœur']], $commercial);
        $this->prospect('Budget trop bas', ['transaction' => 'vente', 'budget_max' => 150_000_000]);
        $this->prospect('Cherche une villa', ['transaction' => 'vente', 'types' => ['villa']]);
        $this->prospect('Cherche à louer', ['transaction' => 'location']);
        $this->prospect('Autre quartier', ['transaction' => 'vente', 'neighborhoods' => ['Almadies']]);
        $inactive = $this->prospect('Plus en recherche', ['transaction' => 'vente', 'is_active' => false]);

        $this->postJson("/api/properties/{$property->id}/status", ['status' => 'disponible'])->assertOk();

        $tasks = Task::where('property_id', $property->id)->get();
        $this->assertCount(1, $tasks);
        $this->assertSame($match->id, $tasks->first()->client_id);
        $this->assertSame($commercial->id, $tasks->first()->user_id);
        $this->assertStringContainsString($property->reference, $tasks->first()->title);
        $this->assertFalse($tasks->contains('client_id', $inactive->id));
    }

    public function test_republishing_does_not_notify_twice(): void
    {
        $property = Property::factory()->verified()->create();
        $this->prospect('Awa', ['transaction' => 'vente']);

        $this->postJson("/api/properties/{$property->id}/status", ['status' => 'disponible'])->assertOk();
        $this->postJson("/api/properties/{$property->id}/status", ['status' => 'retire', 'reason' => 'Pause'])->assertOk();
        $this->postJson("/api/properties/{$property->id}/status", ['status' => 'disponible'])->assertOk();

        $this->assertSame(1, Task::where('property_id', $property->id)->count());
    }

    public function test_a_client_page_lists_the_published_properties_matching_their_criteria(): void
    {
        $client = $this->prospect('Awa', ['transaction' => 'location', 'budget_max' => 500_000]);
        Property::factory()->forRent(450_000)->published()->create(['title' => 'F3 Mermoz']);
        Property::factory()->forRent(900_000)->published()->create(['title' => 'Villa trop chère']);
        Property::factory()->forRent(400_000)->create(['title' => 'Brouillon']);

        $this->getJson("/api/clients/{$client->id}/matches")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'F3 Mermoz');
    }

    public function test_accounting_cannot_edit_search_criteria(): void
    {
        $client = Client::factory()->create();
        Sanctum::actingAs(User::factory()->withRoles(Role::Comptable)->create());

        $this->postJson("/api/clients/{$client->id}/search-criteria", ['transaction' => 'vente'])->assertForbidden();
    }
}
