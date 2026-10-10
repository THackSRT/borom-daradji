<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MetaTest extends TestCase
{
    use RefreshDatabase;

    public function test_lists_give_values_and_french_labels(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/meta')
            ->assertOk()
            ->assertJsonFragment(['value' => 'en_negociation', 'label' => 'En négociation'])
            ->assertJsonFragment(['value' => 'titre_foncier', 'label' => 'Titre foncier']);
    }
}
