<?php

namespace Tests\Feature\Crm;

use App\Enums\PipelineStatus;
use App\Enums\Role;
use App\Models\Client;
use App\Models\Property;
use App\Models\Task;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProspectionTest extends TestCase
{
    use RefreshDatabase;

    private User $agent;

    protected function setUp(): void
    {
        parent::setUp();

        $this->agent = User::factory()->withRoles(Role::Agent)->create();
        Sanctum::actingAs($this->agent);
    }

    public function test_a_first_exchange_marks_the_prospect_as_contacted(): void
    {
        $client = Client::factory()->create();

        $this->postJson("/api/clients/{$client->id}/interactions", [
            'channel' => 'whatsapp',
            'summary' => 'Cherche un F4 à Mermoz, budget 200 millions',
        ])->assertCreated()->assertJsonPath('data.user.id', $this->agent->id);

        $client->refresh();
        $this->assertSame(PipelineStatus::Contacte, $client->pipeline_status);
        $this->assertNotNull($client->last_contact_at);
    }

    public function test_an_exchange_never_moves_a_prospect_backwards(): void
    {
        $client = Client::factory()->create(['pipeline_status' => PipelineStatus::Negociation]);

        $this->postJson("/api/clients/{$client->id}/interactions", ['channel' => 'appel', 'summary' => 'Relance prix'])->assertCreated();

        $this->assertSame(PipelineStatus::Negociation, $client->fresh()->pipeline_status);
    }

    public function test_the_site_form_channel_is_reserved_to_the_public_api(): void
    {
        $client = Client::factory()->create();

        $this->postJson("/api/clients/{$client->id}/interactions", ['channel' => 'formulaire_site', 'summary' => 'x'])
            ->assertUnprocessable()->assertJsonValidationErrors('channel');
    }

    public function test_a_completed_visit_feeds_the_client_history_and_creates_the_next_action(): void
    {
        $visit = Visit::factory()->create(['agent_id' => $this->agent->id, 'scheduled_at' => now()->subHour()]);

        $this->putJson("/api/visits/{$visit->id}", ['status' => 'effectuee'])
            ->assertUnprocessable()->assertJsonValidationErrors('feedback');

        $this->putJson("/api/visits/{$visit->id}", [
            'status' => 'effectuee',
            'feedback' => 'interesse',
            'notes' => 'Veut revoir avec son épouse',
            'next_action' => 'Organiser une 2e visite',
        ])->assertOk()->assertJsonPath('data.status.value', 'effectuee');

        $client = $visit->client->fresh();
        $this->assertSame(PipelineStatus::Visite, $client->pipeline_status);
        $this->assertSame('visite', $client->interactions()->first()->channel->value);
        $this->assertDatabaseHas(Task::class, ['title' => 'Organiser une 2e visite', 'user_id' => $this->agent->id, 'client_id' => $client->id]);

        // Renvoyer le même compte-rendu ne crée pas de doublon.
        $this->putJson("/api/visits/{$visit->id}", ['status' => 'effectuee', 'feedback' => 'interesse'])->assertOk();
        $this->assertSame(1, $client->interactions()->count());
    }

    public function test_the_weekly_planning_lists_visits_with_a_whatsapp_confirmation_link(): void
    {
        $client = Client::factory()->create(['name' => 'Awa', 'phone' => '+221771234567']);
        $property = Property::factory()->create();

        $this->postJson('/api/visits', [
            'property_id' => $property->id,
            'client_id' => $client->id,
            'scheduled_at' => now()->startOfWeek()->addDays(2)->setTime(10, 30)->toIso8601String(),
        ])->assertCreated()->assertJsonPath('data.agent.id', $this->agent->id);

        $url = $this->getJson('/api/visits')->assertOk()->assertJsonCount(1, 'data')->json('data.0.client.whatsapp_url');
        $this->assertStringStartsWith('https://wa.me/221771234567?text=Bonjour%20Awa', $url);
    }

    public function test_accounting_and_works_roles_do_not_plan_visits(): void
    {
        Sanctum::actingAs(User::factory()->withRoles(Role::Comptable, Role::ResponsableTravaux)->create());

        $this->getJson('/api/visits')->assertForbidden();
        $this->postJson('/api/visits', [])->assertForbidden();
    }

    public function test_tasks_are_personal_and_the_dirigeant_sees_everyone(): void
    {
        $colleague = User::factory()->withRoles(Role::Agent)->create();
        Task::create(['user_id' => $this->agent->id, 'title' => 'Ma tâche', 'due_at' => now()]);
        $other = Task::create(['user_id' => $colleague->id, 'title' => 'Tâche du collègue', 'due_at' => now()]);

        $this->getJson('/api/tasks?all=1')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.title', 'Ma tâche');
        $this->putJson("/api/tasks/{$other->id}", ['done' => true])->assertForbidden();

        Sanctum::actingAs(User::factory()->dirigeant()->create());
        $this->getJson('/api/tasks?all=1')->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_a_task_is_marked_done_and_leaves_the_open_list(): void
    {
        $task = $this->postJson('/api/tasks', ['title' => 'Rappeler M. Diop', 'due_at' => now()->addHour()->toIso8601String()])
            ->assertCreated()->json('data');

        $this->putJson("/api/tasks/{$task['id']}", ['done' => true])->assertOk()->assertJsonPath('data.done_at', fn ($v) => $v !== null);

        $this->getJson('/api/tasks')->assertJsonCount(0, 'data');
        $this->getJson('/api/tasks?state=done')->assertJsonCount(1, 'data');
    }
}
