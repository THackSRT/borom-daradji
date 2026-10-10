<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ActivityLogTest extends TestCase
{
    use RefreshDatabase;

    public function test_creating_a_user_is_logged_with_its_author_and_without_the_password(): void
    {
        $dirigeant = User::factory()->dirigeant()->create();
        Sanctum::actingAs($dirigeant);

        $this->postJson('/api/users', [
            'name' => 'Ibrahima Fall',
            'email' => 'ibrahima@example.sn',
            'roles' => ['responsable_travaux'],
            'password' => 'MotDePasse2026',
        ])->assertCreated();

        $log = ActivityLog::where('action', 'created')->where('subject_type', 'user')->latest('id')->firstOrFail();
        $this->assertSame($dirigeant->id, $log->user_id);
        $this->assertSame('Ibrahima Fall', $log->changes['name']['new']);
        $this->assertArrayNotHasKey('password', $log->changes);
    }

    public function test_an_update_records_before_and_after_and_masks_the_password(): void
    {
        $agent = User::factory()->create(['name' => 'Ancien Nom']);
        Sanctum::actingAs(User::factory()->dirigeant()->create());

        $this->putJson("/api/users/{$agent->id}", ['name' => 'Nouveau Nom', 'password' => 'MotDePasse2027'])->assertOk();

        $log = ActivityLog::where('action', 'updated')->where('subject_id', $agent->id)->latest('id')->firstOrFail();
        $this->assertSame(['old' => 'Ancien Nom', 'new' => 'Nouveau Nom'], $log->changes['name']);
        $this->assertSame(['old' => null, 'new' => '(modifié)'], $log->changes['password']);
    }

    public function test_only_the_dirigeant_reads_the_log_and_can_filter_it(): void
    {
        $agent = User::factory()->create();
        Sanctum::actingAs($agent);
        $this->getJson('/api/activity-logs')->assertForbidden();

        $dirigeant = User::factory()->dirigeant()->create();
        Sanctum::actingAs($dirigeant);
        $this->putJson("/api/users/{$agent->id}", ['name' => 'Renommé'])->assertOk();

        $this->getJson('/api/activity-logs?action=updated&user_id='.$dirigeant->id)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.user.name', $dirigeant->name)
            ->assertJsonPath('data.0.changes.name.new', 'Renommé');
    }

    public function test_entries_older_than_the_retention_period_are_pruned(): void
    {
        $old = ActivityLog::create(['action' => 'login', 'created_at' => now()->subDays(366)]);
        $recent = ActivityLog::create(['action' => 'login', 'created_at' => now()->subDays(10)]);

        $this->artisan('model:prune', ['--model' => [ActivityLog::class]])->assertSuccessful();

        $this->assertModelMissing($old);
        $this->assertModelExists($recent);
    }
}
