<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Client;
use App\Models\Property;
use App\Models\Task;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_agent_sees_only_their_own_portfolio_and_today_actions(): void
    {
        $agent = User::factory()->withRoles(Role::Agent)->create();
        $colleague = User::factory()->withRoles(Role::Agent)->create();

        Property::factory()->published()->create(['agent_id' => $agent->id]);
        Property::factory()->create(['agent_id' => $agent->id]);
        Property::factory()->published()->create(['agent_id' => $colleague->id]);
        Client::factory()->create(['assigned_user_id' => $agent->id, 'name' => 'Prospect à moi']);
        Client::factory()->create(['assigned_user_id' => $colleague->id]);
        Visit::factory()->create(['agent_id' => $agent->id, 'scheduled_at' => now()->setTime(23, 0)]);
        Visit::factory()->create(['agent_id' => $agent->id, 'scheduled_at' => now()->addDays(8)]);
        Task::create(['user_id' => $agent->id, 'title' => 'En retard', 'due_at' => now()->subDay()]);
        Task::create(['user_id' => $agent->id, 'title' => 'Plus tard', 'due_at' => now()->addWeek()]);
        Sanctum::actingAs($agent);

        $this->getJson('/api/dashboard')
            ->assertOk()
            ->assertJsonPath('data.kpis.published', 1)
            ->assertJsonPath('data.kpis.drafts', 1)
            ->assertJsonPath('data.kpis.new_leads', 1)
            ->assertJsonPath('data.kpis.visits_today', 1)
            ->assertJsonPath('data.kpis.tasks_overdue', 1)
            ->assertJsonPath('data.kpis.tasks_today', 1)
            ->assertJsonCount(1, 'data.visits_today')
            ->assertJsonPath('data.new_leads.0.name', 'Prospect à moi')
            ->assertJsonPath('data.drafts.0.checks_progress.total', 6)
            ->assertJsonPath('data.tasks.0.title', 'En retard');
    }

    public function test_the_dirigeant_sees_the_whole_agency(): void
    {
        Property::factory()->published()->count(3)->create();
        Sanctum::actingAs(User::factory()->dirigeant()->create());

        $this->getJson('/api/dashboard')->assertOk()->assertJsonPath('data.kpis.published', 3);
    }

    public function test_property_list_returns_status_counts_and_check_progress(): void
    {
        Property::factory()->published()->count(2)->create();
        Property::factory()->create();
        Sanctum::actingAs(User::factory()->withRoles(Role::Agent)->create());

        $this->getJson('/api/properties?status=brouillon')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('status_counts.disponible', 2)
            ->assertJsonPath('status_counts.brouillon', 1)
            ->assertJsonPath('data.0.checks_progress', ['cleared' => 0, 'total' => 6]);
    }
}
