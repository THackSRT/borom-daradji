<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $dirigeant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->dirigeant = User::factory()->dirigeant()->create();
    }

    public function test_only_the_dirigeant_can_manage_users(): void
    {
        foreach ([Role::Agent, Role::Comptable, Role::ResponsableTravaux, Role::Commercial] as $role) {
            Sanctum::actingAs(User::factory()->withRoles($role)->create());

            $this->getJson('/api/users')->assertForbidden();
            $this->postJson('/api/users', [])->assertForbidden();
        }
    }

    public function test_dirigeant_lists_and_filters_users_by_role(): void
    {
        User::factory()->withRoles(Role::Comptable)->create(['name' => 'Fatou Comptable']);
        User::factory()->withRoles(Role::Agent, Role::Commercial)->create(['name' => 'Moussa Agent']);
        Sanctum::actingAs($this->dirigeant);

        $this->getJson('/api/users')->assertOk()->assertJsonCount(3, 'data');

        $this->getJson('/api/users?role=commercial')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Moussa Agent');
    }

    public function test_dirigeant_creates_a_user_with_cumulated_roles_and_normalized_phone(): void
    {
        Sanctum::actingAs($this->dirigeant);

        $response = $this->postJson('/api/users', [
            'name' => 'Aminata Ndiaye',
            'email' => 'Aminata@BoromDaradji.sn',
            'phone' => '77 555 66 77',
            'roles' => ['agent', 'commercial'],
            'password' => 'MotDePasse2026',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.email', 'aminata@boromdaradji.sn')
            ->assertJsonPath('data.phone', '+221775556677')
            ->assertJsonPath('data.roles.0.label', 'Agent immobilier')
            ->assertJsonMissingPath('data.password');

        $user = User::where('email', 'aminata@boromdaradji.sn')->firstOrFail();
        $this->assertTrue($user->hasRole(Role::Commercial));
        $this->assertTrue(Hash::check('MotDePasse2026', $user->password));
    }

    public function test_same_phone_typed_differently_is_rejected_as_duplicate(): void
    {
        User::factory()->create(['phone' => '+221775556677']);
        Sanctum::actingAs($this->dirigeant);

        $this->postJson('/api/users', [
            'name' => 'Doublon',
            'email' => 'doublon@example.sn',
            'phone' => '00221 775 55 66 77',
            'roles' => ['agent'],
            'password' => 'MotDePasse2026',
        ])->assertUnprocessable()->assertJsonValidationErrors('phone');
    }

    public function test_invalid_role_phone_and_weak_password_are_rejected(): void
    {
        Sanctum::actingAs($this->dirigeant);

        $this->postJson('/api/users', [
            'name' => 'Test',
            'email' => 'test@example.sn',
            'phone' => '12345',
            'roles' => ['super_admin'],
            'password' => 'court',
        ])->assertUnprocessable()->assertJsonValidationErrors(['phone', 'roles.0', 'password']);
    }

    public function test_dirigeant_updates_roles_of_another_user(): void
    {
        $agent = User::factory()->create();
        Sanctum::actingAs($this->dirigeant);

        $this->putJson("/api/users/{$agent->id}", ['roles' => ['agent', 'comptable']])
            ->assertOk()
            ->assertJsonCount(2, 'data.roles');

        $this->assertTrue($agent->fresh()->hasRole(Role::Comptable));
    }

    public function test_dirigeant_cannot_lock_themself_out(): void
    {
        Sanctum::actingAs($this->dirigeant);

        $this->putJson("/api/users/{$this->dirigeant->id}", ['roles' => ['agent']])
            ->assertUnprocessable()->assertJsonValidationErrors('roles');

        $this->putJson("/api/users/{$this->dirigeant->id}", ['is_active' => false])
            ->assertUnprocessable()->assertJsonValidationErrors('is_active');

        $this->deleteJson("/api/users/{$this->dirigeant->id}")
            ->assertUnprocessable()->assertJsonValidationErrors('user');

        $this->assertTrue($this->dirigeant->fresh()->is_active);
    }

    public function test_deleting_a_user_deactivates_the_account_and_revokes_its_tokens(): void
    {
        $agent = User::factory()->create();
        $agent->createToken('telephone');
        Sanctum::actingAs($this->dirigeant);

        $this->deleteJson("/api/users/{$agent->id}")->assertNoContent();

        $this->assertDatabaseHas(User::class, ['id' => $agent->id, 'is_active' => false]);
        $this->assertSame(0, $agent->tokens()->count());
    }
}
