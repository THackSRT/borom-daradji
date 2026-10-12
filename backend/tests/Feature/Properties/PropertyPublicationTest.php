<?php

namespace Tests\Feature\Properties;

use App\Enums\CheckStatus;
use App\Enums\PropertyCheckItem;
use App\Enums\Role;
use App\Models\Property;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PropertyPublicationTest extends TestCase
{
    use RefreshDatabase;

    private User $agent;

    protected function setUp(): void
    {
        parent::setUp();

        $this->agent = User::factory()->withRoles(Role::Agent)->create();
        Sanctum::actingAs($this->agent);
    }

    private function check(Property $property, PropertyCheckItem $item, string $status, ?string $note = null): TestResponse
    {
        $check = $property->checks()->where('item', $item)->firstOrFail();

        return $this->putJson("/api/properties/{$property->id}/checks/{$check->id}", ['status' => $status, 'note' => $note]);
    }

    public function test_an_unverified_property_cannot_be_published(): void
    {
        $property = Property::factory()->create();
        $this->check($property, PropertyCheckItem::IdentiteProprietaire, 'ok')->assertOk();

        $response = $this->postJson("/api/properties/{$property->id}/status", ['status' => 'disponible'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status', 'checks']);

        $this->assertContains('etat_droits_reels', $response->json('errors.checks'));
        $this->assertNotContains('identite_proprietaire', $response->json('errors.checks'));
        $this->assertSame('brouillon', $property->fresh()->status->value);
    }

    public function test_a_verified_property_is_published_and_the_change_is_recorded(): void
    {
        $property = Property::factory()->create();

        foreach (PropertyCheckItem::cases() as $item) {
            $item === PropertyCheckItem::PlanBornage
                ? $this->check($property, $item, 'sans_objet', 'Appartement en copropriété')->assertOk()
                : $this->check($property, $item, 'ok')->assertOk()->assertJsonPath('data.checked_by', $this->agent->name);
        }

        $this->postJson("/api/properties/{$property->id}/status", ['status' => 'disponible'])
            ->assertOk()
            ->assertJsonPath('data.status.value', 'disponible')
            ->assertJsonPath('data.status_changes.0.to.value', 'disponible')
            ->assertJsonPath('data.status_changes.0.user', $this->agent->name);

        $this->assertNotNull($property->fresh()->published_at);
    }

    public function test_not_applicable_or_failed_checks_must_be_explained(): void
    {
        $property = Property::factory()->create();

        $this->check($property, PropertyCheckItem::PlanBornage, 'sans_objet')
            ->assertUnprocessable()->assertJsonValidationErrors('note');
        $this->check($property, PropertyCheckItem::AbsenceLitige, 'ko')
            ->assertUnprocessable()->assertJsonValidationErrors('note');
    }

    public function test_an_old_land_rights_statement_must_be_renewed_before_publication(): void
    {
        $property = Property::factory()->verified()->create();
        $property->checks()->where('item', PropertyCheckItem::EtatDroitsReels)->update(['checked_at' => now()->subDays(120)]);

        $this->postJson("/api/properties/{$property->id}/status", ['status' => 'disponible'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.checks', ['etat_droits_reels'])
            ->assertJsonFragment(['Vérification foncière incomplète : État des droits réels récent (à renouveler).']);
    }

    public function test_forbidden_transitions_and_unexplained_withdrawals_are_rejected(): void
    {
        $property = Property::factory()->create();

        $this->postJson("/api/properties/{$property->id}/status", ['status' => 'vendu'])
            ->assertUnprocessable()->assertJsonValidationErrors('status');

        $this->postJson("/api/properties/{$property->id}/status", ['status' => 'retire'])
            ->assertUnprocessable()->assertJsonValidationErrors('reason');

        $this->postJson("/api/properties/{$property->id}/status", ['status' => 'retire', 'reason' => 'Le propriétaire a changé d\'avis'])
            ->assertOk()->assertJsonPath('data.status.value', 'retire');
    }

    public function test_a_reset_check_loses_its_author(): void
    {
        $property = Property::factory()->verified()->create();

        $this->check($property, PropertyCheckItem::MandatSigne, 'a_faire')
            ->assertOk()
            ->assertJsonPath('data.checked_by', null)
            ->assertJsonPath('data.checked_at', null);
    }

    public function test_a_check_cannot_point_to_another_property_document(): void
    {
        $property = Property::factory()->create();
        $other = Property::factory()->create();
        $document = $other->documents()->create(['type' => 'titre_foncier', 'path' => 'x.pdf', 'original_name' => 'tf.pdf']);
        $check = $property->checks()->where('item', PropertyCheckItem::JustificatifDroit)->firstOrFail();

        $this->putJson("/api/properties/{$property->id}/checks/{$check->id}", [
            'status' => CheckStatus::Ok->value,
            'document_id' => $document->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('document_id');
    }
}
