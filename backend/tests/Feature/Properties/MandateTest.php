<?php

namespace Tests\Feature\Properties;

use App\Enums\MandateStatus;
use App\Enums\Role;
use App\Models\Mandate;
use App\Models\Property;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MandateTest extends TestCase
{
    use RefreshDatabase;

    private function mandate(Property $property, string $endsOn): Mandate
    {
        return $property->mandates()->create([
            'type' => 'exclusif',
            'starts_on' => now()->subMonths(3)->toDateString(),
            'ends_on' => $endsOn,
            'commission_type' => 'pourcentage',
            'commission_value' => 5,
        ]);
    }

    public function test_agent_creates_a_mandate_and_accounting_can_read_it(): void
    {
        $property = Property::factory()->create();
        Sanctum::actingAs(User::factory()->withRoles(Role::Agent)->create());

        $this->postJson("/api/properties/{$property->id}/mandates", [
            'type' => 'exclusif',
            'starts_on' => '2026-10-01',
            'ends_on' => '2027-01-01',
            'commission_type' => 'pourcentage',
            'commission_value' => 120,
        ])->assertUnprocessable()->assertJsonValidationErrors('commission_value');

        $this->postJson("/api/properties/{$property->id}/mandates", [
            'type' => 'exclusif',
            'starts_on' => '2026-10-01',
            'ends_on' => '2027-01-01',
            'commission_type' => 'pourcentage',
            'commission_value' => 5,
        ])->assertCreated()->assertJsonPath('data.commission_value', 5);

        Sanctum::actingAs(User::factory()->withRoles(Role::Comptable)->create());
        $this->getJson("/api/properties/{$property->id}/mandates")->assertOk()->assertJsonCount(1, 'data');
        $this->postJson("/api/properties/{$property->id}/mandates", [])->assertForbidden();

        Sanctum::actingAs(User::factory()->withRoles(Role::Commercial)->create());
        $this->getJson("/api/properties/{$property->id}/mandates")->assertForbidden();
    }

    public function test_the_daily_check_alerts_once_and_closes_expired_mandates(): void
    {
        $agent = User::factory()->withRoles(Role::Agent)->create();
        $soon = $this->mandate(Property::factory()->create(['agent_id' => $agent->id]), now()->addDays(5)->toDateString());
        $later = $this->mandate(Property::factory()->create(), now()->addMonth()->toDateString());
        $past = $this->mandate(Property::factory()->create(), now()->subDay()->toDateString());

        $this->artisan('borom:check-mandates')->assertSuccessful();
        $this->artisan('borom:check-mandates')->assertSuccessful();

        $this->assertSame(1, Task::where('property_id', $soon->property_id)->where('user_id', $agent->id)->count());
        $this->assertSame(0, Task::where('property_id', $later->property_id)->count());
        $this->assertSame(MandateStatus::Expire, $past->fresh()->status);
        $this->assertSame(MandateStatus::Actif, $soon->fresh()->status);
    }
}
