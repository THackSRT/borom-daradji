<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreateDirectorCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_the_first_dirigeant(): void
    {
        $this->artisan('borom:create-director', ['--name' => 'Mamadou Diop', '--email' => 'Mamadou@BoromDaradji.sn', '--phone' => '77 000 00 01'])
            ->expectsQuestion('Mot de passe (10 caractères minimum, lettres et chiffres)', 'MotDePasse2026')
            ->assertSuccessful();

        $user = User::where('email', 'mamadou@boromdaradji.sn')->firstOrFail();
        $this->assertTrue($user->hasRole(Role::Dirigeant));
        $this->assertSame('+221770000001', $user->phone);
    }

    public function test_it_refuses_a_weak_password(): void
    {
        $this->artisan('borom:create-director', ['--name' => 'Test', '--email' => 'test@example.sn', '--phone' => ''])
            ->expectsQuestion('Mot de passe (10 caractères minimum, lettres et chiffres)', 'court')
            ->assertFailed();

        $this->assertSame(0, User::count());
    }
}
