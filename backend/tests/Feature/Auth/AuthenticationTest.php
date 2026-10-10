<?php

namespace Tests\Feature\Auth;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    private function login(string $login, string $password = 'password'): TestResponse
    {
        return $this->postJson('/api/auth/login', [
            'login' => $login,
            'password' => $password,
            'device_name' => 'tests',
        ]);
    }

    public function test_user_logs_in_with_email_and_gets_a_token(): void
    {
        $user = User::factory()->create(['email' => 'awa@example.sn']);

        $response = $this->login('Awa@Example.sn');

        $response->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'roles']])
            ->assertJsonPath('user.id', $user->id);
        $this->assertNotNull($user->fresh()->last_login_at);
        $this->assertDatabaseHas(ActivityLog::class, ['action' => 'login', 'user_id' => $user->id]);
        $this->assertDatabaseMissing(ActivityLog::class, ['action' => 'updated', 'subject_id' => $user->id]);
    }

    public function test_user_logs_in_with_phone_typed_in_local_format(): void
    {
        $user = User::factory()->create(['phone' => '+221771234567']);

        $this->login('77 123 45 67')->assertOk()->assertJsonPath('user.id', $user->id);
    }

    public function test_wrong_password_is_rejected(): void
    {
        $user = User::factory()->create();

        $this->login($user->email, 'mauvais-mot-de-passe')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('login');
    }

    public function test_inactive_user_cannot_log_in(): void
    {
        $user = User::factory()->inactive()->create();

        $this->login($user->email)->assertUnprocessable()->assertJsonValidationErrors('login');
        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_login_is_rate_limited_after_five_failures(): void
    {
        $user = User::factory()->create();

        for ($i = 0; $i < 5; $i++) {
            $this->login($user->email, 'faux');
        }

        // Même avec le bon mot de passe, l'accès reste bloqué pendant la temporisation.
        $response = $this->login($user->email)->assertUnprocessable();
        $this->assertStringStartsWith('Trop de tentatives', $response->json('errors.login.0'));
    }

    public function test_me_requires_authentication(): void
    {
        $this->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_logout_revokes_the_current_token(): void
    {
        $user = User::factory()->create();
        $token = $this->login($user->email)->json('token');

        $this->withToken($token)->postJson('/api/auth/logout')->assertNoContent();

        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_deactivated_user_loses_access_with_an_existing_token(): void
    {
        $user = User::factory()->create();
        $token = $this->login($user->email)->json('token');

        $user->update(['is_active' => false]);

        $this->withToken($token)->getJson('/api/auth/me')->assertForbidden();
    }

    public function test_password_change_requires_current_password_and_revokes_other_devices(): void
    {
        $user = User::factory()->create();
        $phoneToken = $this->login($user->email)->json('token');
        $officeToken = $this->login($user->email)->json('token');

        $this->withToken($officeToken)->putJson('/api/auth/password', [
            'current_password' => 'faux',
            'password' => 'NouveauMotDePasse1',
            'password_confirmation' => 'NouveauMotDePasse1',
        ])->assertUnprocessable()->assertJsonValidationErrors('current_password');

        $this->withToken($officeToken)->putJson('/api/auth/password', [
            'current_password' => 'password',
            'password' => 'NouveauMotDePasse1',
            'password_confirmation' => 'NouveauMotDePasse1',
        ])->assertNoContent();

        $this->assertSame(1, $user->tokens()->count());
        $this->app['auth']->forgetGuards();
        $this->withToken($phoneToken)->getJson('/api/auth/me')->assertUnauthorized();
        $this->login($user->email, 'NouveauMotDePasse1')->assertOk();
    }
}
