<?php

namespace Tests\Feature;

use App\Enums\Role as SystemRole;
use App\Models\ActivityLog;
use App\Models\Client;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Support\PermissionCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RbacTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsDirigeant(): User
    {
        $user = User::factory()->dirigeant()->create();
        Sanctum::actingAs($user);

        return $user;
    }

    public function test_default_roles_and_the_full_catalogue_are_installed(): void
    {
        $this->actingAsDirigeant();

        $this->getJson('/api/roles')
            ->assertOk()
            ->assertJsonCount(5, 'data')
            ->assertJsonFragment(['name' => 'comptable', 'label' => 'Comptable', 'is_system' => true]);

        $modules = $this->getJson('/api/permissions')->assertOk()->json('data');
        $this->assertSame(count(PermissionCatalog::names()), collect($modules)->sum(fn ($m) => count($m['permissions'])));
        $this->assertSame(count(PermissionCatalog::names()), Permission::count());
    }

    public function test_dirigeant_holds_every_permission_including_future_ones(): void
    {
        $dirigeant = $this->actingAsDirigeant();

        $this->getJson('/api/auth/me')->assertJsonPath('data.is_super_admin', true)
            ->assertJsonPath('data.permissions', PermissionCatalog::names());
        $this->assertTrue($dirigeant->can('une.permission.qui.n.existe.pas.encore'));
    }

    public function test_a_custom_role_grants_exactly_its_permissions(): void
    {
        $this->actingAsDirigeant();
        $this->postJson('/api/roles', [
            'label' => 'Assistante d\'agence',
            'description' => 'Accueil et standard',
            'permissions' => ['clients.view', 'clients.create', 'properties.view'],
        ])->assertCreated()->assertJsonPath('data.name', 'assistante_dagence');

        $assistant = User::factory()->withRoles('assistante_dagence')->create();
        Sanctum::actingAs($assistant);

        $this->getJson('/api/clients')->assertOk();
        $this->getJson('/api/properties')->assertOk();
        $this->postJson('/api/properties', [])->assertForbidden();
        $this->getJson('/api/invoices')->assertForbidden();
        $this->getJson('/api/auth/me')->assertJsonPath('data.permissions', ['clients.create', 'clients.view', 'properties.view']);
    }

    public function test_changing_a_role_takes_effect_immediately(): void
    {
        $this->actingAsDirigeant();
        $agent = User::factory()->withRoles(SystemRole::Agent)->create();
        $role = Role::findByName('agent');

        Sanctum::actingAs($agent);
        $this->getJson('/api/invoices')->assertOk();

        $this->actingAsDirigeant();
        $this->putJson("/api/roles/{$role->id}", ['permissions' => array_values(array_diff($role->permissionNames(), ['invoices.view']))])->assertOk();

        Sanctum::actingAs($agent->fresh());
        $this->getJson('/api/invoices')->assertForbidden();
    }

    public function test_a_user_can_receive_individual_permissions_on_top_of_roles(): void
    {
        $this->actingAsDirigeant();
        $user = User::factory()->withRoles(SystemRole::Commercial)->create();

        $this->putJson("/api/users/{$user->id}", ['permissions' => ['invoices.issue']])
            ->assertOk()
            ->assertJsonPath('data.direct_permissions', ['invoices.issue'])
            ->assertJsonFragment(['permissions' => $user->fresh()->effectivePermissions()]);

        $this->assertTrue($user->fresh()->hasPermission('invoices.issue'));
        $this->assertTrue($user->fresh()->hasPermission('visits.manage'));
    }

    public function test_viewing_accounts_and_managing_them_are_separate_rights(): void
    {
        $viewer = User::factory()->withPermissions('users.view')->create();
        Sanctum::actingAs($viewer);

        $this->getJson('/api/users')->assertOk();
        $this->getJson('/api/roles')->assertOk();
        $this->postJson('/api/users', [])->assertForbidden();
        $this->postJson('/api/roles', ['label' => 'X', 'permissions' => []])->assertForbidden();
    }

    public function test_default_roles_cannot_be_deleted_and_assigned_roles_must_be_freed_first(): void
    {
        $this->actingAsDirigeant();
        $this->deleteJson('/api/roles/'.Role::findByName('agent')->id)->assertJsonValidationErrors('role');

        $id = $this->postJson('/api/roles', ['label' => 'Stagiaire', 'permissions' => ['properties.view']])->json('data.id');
        $intern = User::factory()->withRoles('stagiaire')->create();

        $this->deleteJson("/api/roles/{$id}")->assertJsonValidationErrors('role');

        $intern->syncRoles(['agent']);
        $this->deleteJson("/api/roles/{$id}")->assertNoContent();
        $this->assertNull(Role::find($id));
    }

    public function test_the_dirigeant_role_cannot_be_modified(): void
    {
        $this->actingAsDirigeant();

        $this->putJson('/api/roles/'.Role::findByName('dirigeant')->id, ['permissions' => ['properties.view']])
            ->assertJsonValidationErrors('role');
    }

    public function test_a_role_can_be_duplicated(): void
    {
        $this->actingAsDirigeant();
        $source = Role::findByName('comptable');

        $this->postJson("/api/roles/{$source->id}/duplicate")
            ->assertCreated()
            ->assertJsonPath('data.label', 'Copie de Comptable')
            ->assertJsonPath('data.is_system', false)
            ->assertJsonPath('data.permissions', $source->permissionNames());
    }

    public function test_managers_cannot_grant_rights_they_do_not_have(): void
    {
        $manager = User::factory()->withPermissions('users.view', 'users.manage', 'roles.manage', 'clients.view', 'clients.create')->create();
        Sanctum::actingAs($manager);

        // Rôle avec une permission que le gestionnaire n'a pas.
        $this->postJson('/api/roles', ['label' => 'Caissier', 'permissions' => ['clients.view', 'payments.cancel']])
            ->assertJsonValidationErrors('permissions');
        $this->postJson('/api/roles', ['label' => 'Accueil', 'permissions' => ['clients.view']])->assertCreated();

        // Compte avec le rôle comptable (droits qu'il n'a pas), ou dirigeant.
        $payload = ['name' => 'Awa', 'email' => 'awa@borom.test', 'password' => 'MotDePasse2026'];
        $this->postJson('/api/users', [...$payload, 'roles' => ['comptable']])->assertJsonValidationErrors('roles');
        $this->postJson('/api/users', [...$payload, 'roles' => ['dirigeant']])->assertJsonValidationErrors('roles');
        $this->postJson('/api/users', [...$payload, 'roles' => ['accueil']])->assertCreated();

        // Ses propres droits.
        $this->putJson("/api/users/{$manager->id}", ['permissions' => ['users.view', 'users.manage', 'roles.manage', 'clients.view', 'clients.create', 'invoices.view']])
            ->assertJsonValidationErrors('roles');

        // Le compte d'un dirigeant.
        $dirigeant = User::factory()->dirigeant()->create();
        $this->putJson("/api/users/{$dirigeant->id}", ['name' => 'Autre nom'])->assertJsonValidationErrors('user');
        $this->deleteJson("/api/users/{$dirigeant->id}")->assertJsonValidationErrors('user');
    }

    public function test_there_is_always_an_active_dirigeant(): void
    {
        $dirigeant = $this->actingAsDirigeant();
        $other = User::factory()->dirigeant()->create();

        // Deux dirigeants : on peut en rétrograder un.
        $this->putJson("/api/users/{$other->id}", ['roles' => ['comptable']])->assertOk();

        // Le dernier ne peut ni perdre son rôle ni être désactivé.
        $this->putJson("/api/users/{$dirigeant->id}", ['roles' => ['comptable']])->assertJsonValidationErrors('roles');
        Sanctum::actingAs(User::factory()->dirigeant()->create());
        $this->deleteJson("/api/users/{$dirigeant->id}")->assertNoContent();
        $this->putJson("/api/users/{$dirigeant->id}", ['is_active' => true])->assertOk();
    }

    public function test_access_changes_are_logged_with_before_and_after(): void
    {
        $this->actingAsDirigeant();
        $user = User::factory()->withRoles(SystemRole::Commercial)->create();
        $role = Role::findByName('commercial');

        $this->putJson("/api/users/{$user->id}", ['roles' => ['commercial', 'comptable']])->assertOk();
        $this->putJson("/api/roles/{$role->id}", ['permissions' => ['properties.view']])->assertOk();

        $this->assertDatabaseHas('activity_logs', ['action' => 'access_changed', 'subject_type' => 'user', 'subject_id' => $user->id]);
        $log = ActivityLog::where('action', 'permissions_changed')->where('subject_type', 'role')->firstOrFail();
        $this->assertSame(['properties.view'], $log->changes['permissions']['new']);
    }

    public function test_client_documents_follow_assignment_or_the_view_all_permission(): void
    {
        $agent = User::factory()->withRoles(SystemRole::Agent)->create();
        $mine = Client::factory()->create(['assigned_user_id' => $agent->id]);
        $other = Client::factory()->create();
        Sanctum::actingAs($agent);

        $this->getJson("/api/clients/{$mine->id}/documents")->assertOk();
        $this->getJson("/api/clients/{$other->id}/documents")->assertForbidden();

        $agent->givePermissionTo('clients.documents.view_all');
        Sanctum::actingAs($agent->fresh());
        $this->getJson("/api/clients/{$other->id}/documents")->assertOk();
    }

    public function test_sync_command_adds_new_and_removes_obsolete_permissions_without_touching_roles(): void
    {
        Permission::create(['name' => 'ancienne.permission', 'guard_name' => 'web']);
        Permission::findByName('invoices.issue')->delete();
        $comptable = Role::findByName('comptable');
        $comptable->revokePermissionTo('payments.cancel');

        $this->artisan('borom:sync-permissions')->assertSuccessful();

        $this->assertNull(Permission::where('name', 'ancienne.permission')->first());
        $this->assertNotNull(Permission::where('name', 'invoices.issue')->first());
        // Le choix du dirigeant sur le rôle est conservé.
        $this->assertFalse($comptable->fresh()->hasPermissionTo('payments.cancel'));
    }
}
