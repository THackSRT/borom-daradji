<?php

namespace Tests\Feature\Crm;

use App\Enums\Role;
use App\Models\ActivityLog;
use App\Models\Client;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ClientTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_internal_role_can_create_a_client_assigned_to_themself(): void
    {
        $comptable = User::factory()->withRoles(Role::Comptable)->create();
        Sanctum::actingAs($comptable);

        $this->postJson('/api/clients', [
            'name' => 'Ousmane Sarr',
            'phone' => '77 111 22 33',
            'categories' => ['fournisseur'],
        ])
            ->assertCreated()
            ->assertJsonPath('data.phone', '+221771112233')
            ->assertJsonPath('data.whatsapp_url', 'https://wa.me/221771112233')
            ->assertJsonPath('data.pipeline_status.value', 'nouveau')
            ->assertJsonPath('data.assigned_user.id', $comptable->id);
    }

    public function test_a_known_phone_returns_the_existing_client_instead_of_a_duplicate(): void
    {
        $existing = Client::factory()->create(['name' => 'Awa Diallo', 'phone' => '+221771234567']);
        Sanctum::actingAs(User::factory()->withRoles(Role::Agent)->create());

        $this->postJson('/api/clients', ['name' => 'A. Diallo', 'phone' => '00221 77 123 45 67'])
            ->assertConflict()
            ->assertJsonPath('client.id', $existing->id)
            ->assertJsonPath('message', 'Ce numéro appartient déjà à Awa Diallo.');

        $this->assertSame(1, Client::count());
    }

    public function test_search_finds_a_client_by_phone_typed_in_local_format(): void
    {
        Client::factory()->create(['name' => 'Awa Diallo', 'phone' => '+221771234567']);
        Client::factory()->create(['name' => 'Moussa Ba']);
        Sanctum::actingAs(User::factory()->withRoles(Role::Agent)->create());

        $this->getJson('/api/clients?search=77 123 45 67')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Awa Diallo');
    }

    public function test_search_finds_a_client_from_the_first_digits_of_their_phone(): void
    {
        Client::factory()->create(['name' => 'Khady Ndiaye', 'phone' => '+221775550001']);
        Client::factory()->create(['name' => 'Autre', 'phone' => '+221781234567']);
        Sanctum::actingAs(User::factory()->withRoles(Role::Agent)->create());

        $this->getJson('/api/clients?search=77 555')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Khady Ndiaye');
    }

    public function test_search_by_name_ignores_case(): void
    {
        // PostgreSQL : « like » distingue les majuscules, la recherche doit les ignorer.
        Client::factory()->create(['name' => 'Fatou Sow']);
        Client::factory()->create(['name' => 'Moussa Ba']);
        Sanctum::actingAs(User::factory()->withRoles(Role::Agent)->create());

        $this->getJson('/api/clients?search=fatou')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Fatou Sow');
    }

    public function test_private_notes_are_only_visible_to_the_assigned_user_and_the_dirigeant(): void
    {
        $assigned = User::factory()->withRoles(Role::Agent)->create();
        $client = Client::factory()->create(['assigned_user_id' => $assigned->id, 'private_notes' => 'Budget réel plus élevé']);

        Sanctum::actingAs($assigned);
        $this->getJson("/api/clients/{$client->id}")->assertJsonPath('data.private_notes', 'Budget réel plus élevé');

        Sanctum::actingAs(User::factory()->dirigeant()->create());
        $this->getJson("/api/clients/{$client->id}")->assertJsonPath('data.private_notes', 'Budget réel plus élevé');

        Sanctum::actingAs(User::factory()->withRoles(Role::Agent)->create());
        $this->getJson("/api/clients/{$client->id}")->assertJsonMissingPath('data.private_notes');
    }

    public function test_only_the_dirigeant_archives_a_client(): void
    {
        $client = Client::factory()->create();

        Sanctum::actingAs(User::factory()->withRoles(Role::Agent)->create());
        $this->deleteJson("/api/clients/{$client->id}")->assertForbidden();

        Sanctum::actingAs(User::factory()->dirigeant()->create());
        $this->deleteJson("/api/clients/{$client->id}")->assertNoContent();
        $this->assertSoftDeleted($client);
    }

    public function test_identity_documents_are_restricted_and_each_consultation_is_logged(): void
    {
        Storage::fake('local');
        $assigned = User::factory()->withRoles(Role::Agent)->create();
        $client = Client::factory()->create(['assigned_user_id' => $assigned->id]);

        Sanctum::actingAs($assigned);
        $id = $this->post("/api/clients/{$client->id}/documents", [
            'type' => 'cni',
            'document' => UploadedFile::fake()->image('cni.jpg'),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.id');

        $this->get("/api/clients/{$client->id}/documents/{$id}")->assertOk();
        $this->assertDatabaseHas(ActivityLog::class, ['action' => 'downloaded', 'subject_type' => 'client_document', 'user_id' => $assigned->id]);

        Sanctum::actingAs(User::factory()->withRoles(Role::Agent)->create());
        $this->getJson("/api/clients/{$client->id}/documents")->assertForbidden();
        $this->get("/api/clients/{$client->id}/documents/{$id}")->assertForbidden();
    }
}
