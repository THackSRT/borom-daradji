<?php

namespace Tests\Feature\Rental;

use App\Enums\Role;
use App\Models\Client;
use App\Models\Lease;
use App\Models\LeaseInspection;
use App\Models\Property;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InspectionTest extends TestCase
{
    use RefreshDatabase;

    private User $agent;

    private Lease $lease;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        User::factory()->dirigeant()->create();
        $this->agent = User::factory()->withRoles(Role::Agent)->create(['name' => 'Ousmane Diop']);
        $property = Property::factory()->forRent(450_000)->published()->create(['agent_id' => $this->agent->id, 'bedrooms' => 2, 'bathrooms' => 1]);
        Sanctum::actingAs($this->agent);

        $id = $this->postJson('/api/leases', [
            'property_id' => $property->id,
            'tenant_id' => Client::factory()->create(['name' => 'Aminata Ba'])->id,
            'start_date' => today()->toDateString(),
            'rent' => 450_000,
            'deposit' => 900_000,
            'due_day' => 5,
        ])->assertCreated()->json('data.id');
        $this->lease = Lease::findOrFail($id);
    }

    /**
     * Note toutes les lignes d'un état des lieux (« bon » par défaut) et renvoie les lignes envoyées.
     *
     * @param  array<string, string>  $conditions  « Pièce|Élément » => état
     * @return list<array<string, mixed>>
     */
    private function rateAll(int $id, array $conditions = []): array
    {
        $items = collect($this->getJson("/api/inspections/{$id}")->json('data.items'))
            ->map(fn (array $item) => [
                'id' => $item['id'],
                'room' => $item['room'],
                'element' => $item['element'],
                'condition' => $conditions["{$item['room']}|{$item['element']}"] ?? 'bon',
                'comment' => null,
            ])->all();
        $this->putJson("/api/inspections/{$id}", ['items' => $items])->assertOk();

        return $items;
    }

    public function test_an_entry_inspection_proposes_rooms_from_the_property(): void
    {
        $response = $this->postJson("/api/leases/{$this->lease->id}/inspections", ['type' => 'entree', 'electricity_meter' => '004512'])
            ->assertCreated()
            ->assertJsonPath('data.type.value', 'entree')
            ->assertJsonPath('data.inspector.name', 'Ousmane Diop')
            ->assertJsonPath('data.electricity_meter', '004512');

        $rooms = collect($response->json('data.items'))->pluck('room')->unique()->values()->all();
        $this->assertSame(['Entrée et séjour', 'Cuisine', 'Chambre 1', 'Chambre 2', 'Salle de bain', 'Extérieur'], $rooms);
    }

    public function test_a_lease_has_one_entry_and_one_exit_inspection_at_most(): void
    {
        $this->postJson("/api/leases/{$this->lease->id}/inspections", ['type' => 'entree'])->assertCreated();

        $this->postJson("/api/leases/{$this->lease->id}/inspections", ['type' => 'entree'])
            ->assertJsonValidationErrors('type');
    }

    public function test_items_are_edited_added_and_removed_until_validation(): void
    {
        $id = $this->postJson("/api/leases/{$this->lease->id}/inspections", ['type' => 'entree'])->json('data.id');
        $first = $this->getJson("/api/inspections/{$id}")->json('data.items.0');

        $this->putJson("/api/inspections/{$id}", [
            'keys_count' => 3,
            'items' => [
                ['id' => $first['id'], 'room' => $first['room'], 'element' => $first['element'], 'condition' => 'neuf', 'comment' => 'Serrure changée'],
                ['room' => 'Garage', 'element' => 'Porte basculante', 'condition' => 'usage'],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('data.keys_count', 3)
            ->assertJsonCount(2, 'data.items')
            ->assertJsonPath('data.items.0.condition.value', 'neuf')
            ->assertJsonPath('data.items.1.room', 'Garage');
    }

    public function test_validation_requires_every_item_rated_then_freezes_the_inspection(): void
    {
        $id = $this->postJson("/api/leases/{$this->lease->id}/inspections", ['type' => 'entree'])->json('data.id');

        $this->postJson("/api/inspections/{$id}/validate")->assertJsonValidationErrors('items');

        $this->rateAll($id);
        $this->postJson("/api/inspections/{$id}/validate")->assertOk()->assertJsonPath('data.can.update', false);
        $this->assertNotNull(LeaseInspection::find($id)->validated_at);

        $this->putJson("/api/inspections/{$id}", ['keys_count' => 2])->assertJsonValidationErrors('inspection');
        $this->deleteJson("/api/inspections/{$id}")->assertJsonValidationErrors('inspection');
        $this->postJson("/api/inspections/{$id}/photos", ['photo' => UploadedFile::fake()->image('mur.jpg')])
            ->assertJsonValidationErrors('inspection');
    }

    public function test_the_exit_inspection_repeats_the_entry_lines_and_flags_degradations(): void
    {
        $entry = $this->postJson("/api/leases/{$this->lease->id}/inspections", ['type' => 'entree'])->json('data.id');
        $this->rateAll($entry, ['Chambre 1|Murs et peinture' => 'neuf', 'Cuisine|Sol' => 'usage']);
        $this->postJson("/api/inspections/{$entry}/validate")->assertOk();

        $exit = $this->postJson("/api/leases/{$this->lease->id}/inspections", ['type' => 'sortie'])->assertCreated()->json('data.id');
        $this->rateAll($exit, [
            'Chambre 1|Murs et peinture' => 'mauvais', // dégradé : à retenir
            'Cuisine|Sol' => 'usage',                  // inchangé
            'Entrée et séjour|Sol' => 'usage',         // usure normale : pas une dégradation
        ]);

        $items = collect($this->getJson("/api/inspections/{$exit}")->json('data.items'))->keyBy(fn ($i) => "{$i['room']}|{$i['element']}");
        $this->assertCount(collect($this->getJson("/api/inspections/{$entry}")->json('data.items'))->count(), $items);
        $this->assertSame('neuf', $items['Chambre 1|Murs et peinture']['entry_condition']['value']);
        $this->assertTrue($items['Chambre 1|Murs et peinture']['degraded']);
        $this->assertFalse($items['Cuisine|Sol']['degraded']);
        $this->assertFalse($items['Entrée et séjour|Sol']['degraded']);

        $this->getJson("/api/leases/{$this->lease->id}/deposit")
            ->assertOk()
            ->assertJsonCount(1, 'data.exit_inspection.degradations')
            ->assertJsonPath('data.exit_inspection.degradations.0.element', 'Murs et peinture');
    }

    public function test_photos_are_private_converted_and_attached_to_an_item(): void
    {
        $id = $this->postJson("/api/leases/{$this->lease->id}/inspections", ['type' => 'entree'])->json('data.id');
        $item = $this->getJson("/api/inspections/{$id}")->json('data.items.0.id');

        $response = $this->postJson("/api/inspections/{$id}/photos", ['photo' => UploadedFile::fake()->image('mur.jpg', 2400, 1600), 'item_id' => $item])
            ->assertOk()
            ->assertJsonCount(1, 'data.photos')
            ->assertJsonPath('data.photos.0.item_id', $item);

        $photo = LeaseInspection::find($id)->photos()->first();
        Storage::disk('local')->assertExists($photo->path);
        $this->assertStringEndsWith('.webp', $photo->path);

        $this->get('/api'.$response->json('data.photos.0.url'))->assertOk();

        // Pas d'accès sans droit sur les baux.
        Sanctum::actingAs(User::factory()->withRoles(Role::ResponsableTravaux)->create());
        $this->get('/api'.$response->json('data.photos.0.url'))->assertForbidden();
    }

    public function test_the_inspection_pdf_is_generated(): void
    {
        $id = $this->postJson("/api/leases/{$this->lease->id}/inspections", ['type' => 'entree'])->json('data.id');
        $this->rateAll($id);

        $this->get("/api/inspections/{$id}/pdf")->assertOk()->assertHeader('content-type', 'application/pdf');
    }

    public function test_only_people_managing_leases_make_inspections(): void
    {
        $id = $this->postJson("/api/leases/{$this->lease->id}/inspections", ['type' => 'entree'])->json('data.id');

        Sanctum::actingAs(User::factory()->withRoles(Role::Commercial)->create());
        $this->getJson("/api/inspections/{$id}")->assertOk()->assertJsonPath('data.can.update', false);
        $this->putJson("/api/inspections/{$id}", ['keys_count' => 1])->assertForbidden();
        $this->postJson("/api/leases/{$this->lease->id}/inspections", ['type' => 'sortie'])->assertForbidden();
    }
}
