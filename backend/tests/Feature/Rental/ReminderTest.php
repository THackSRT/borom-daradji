<?php

namespace Tests\Feature\Rental;

use App\Enums\Role;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Lease;
use App\Models\Property;
use App\Models\Task;
use App\Models\User;
use App\Services\Billing;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReminderTest extends TestCase
{
    use RefreshDatabase;

    private User $agent;

    private User $accountant;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-01');
        User::factory()->dirigeant()->create();
        $this->agent = User::factory()->withRoles(Role::Agent)->create();
        $this->accountant = User::factory()->withRoles(Role::Comptable)->create();
    }

    /**
     * Bail commencé le 1er octobre, sans avance : le loyer d'octobre est appelé, échéance le 5.
     *
     * @param  array<string, mixed>  $overrides
     */
    private function lease(array $overrides = []): Lease
    {
        $property = Property::factory()->forRent(450_000)->published()->create(['agent_id' => $this->agent->id]);
        Sanctum::actingAs($this->agent);
        $id = $this->postJson('/api/leases', [
            'property_id' => $property->id,
            'tenant_id' => Client::factory()->create(['name' => 'Aminata Ba'])->id,
            'start_date' => '2026-10-01',
            'rent' => 450_000,
            'due_day' => 5,
            ...$overrides,
        ])->assertCreated()->json('data.id');

        return Lease::findOrFail($id);
    }

    private function remind(string $date): void
    {
        Carbon::setTestNow($date);
        $this->artisan('borom:remind-overdue')->assertSuccessful();
    }

    public function test_an_unpaid_rent_is_reminded_at_each_step_once(): void
    {
        $this->lease();

        $this->remind('2026-10-07'); // J+2 : trop tôt
        $this->assertSame(0, Task::where('title', 'like', 'Relancer%')->count());

        $this->remind('2026-10-08'); // J+3
        $task = Task::where('title', 'like', 'Relancer%')->sole();
        $this->assertSame('Relancer Aminata Ba : loyer d\'octobre 2026 impayé, J+3', $task->title);
        $this->assertSame($this->agent->id, $task->user_id);
        $this->assertStringContainsString('450 000 FCFA', $task->details);
        $this->assertSame('normale', $task->priority->value);

        $this->remind('2026-10-09'); // même palier : pas de doublon
        $this->assertSame(1, Task::where('title', 'like', 'Relancer%')->count());

        $this->remind('2026-10-20'); // J+15
        $this->assertSame(2, Task::where('title', 'like', 'Relancer%')->count());
        $this->assertSame('haute', Task::where('title', 'like', '%J+15')->sole()->priority->value);
    }

    public function test_a_late_run_creates_a_single_task_at_the_highest_step(): void
    {
        $this->lease();

        $this->remind('2026-11-20'); // J+46 : directement le palier J+30

        $this->assertSame(1, Task::where('title', 'like', 'Relancer%')->count());
        $this->assertStringEndsWith('J+30', Task::where('title', 'like', 'Relancer%')->sole()->title);
        $this->assertSame(3, Invoice::sole()->reminder_level);
    }

    public function test_paid_invoices_are_not_reminded(): void
    {
        $lease = $this->lease();
        $invoice = $lease->rentCalls()->sole()->invoice;
        Billing::recordPayment($invoice, ['method' => 'especes', 'amount' => $invoice->total], $this->agent);

        $this->remind('2026-10-20');

        $this->assertSame(0, Task::where('title', 'like', 'Relancer%')->count());
    }

    public function test_other_invoices_go_to_the_person_following_the_client_or_the_accountant(): void
    {
        $followed = Client::factory()->create(['name' => 'Teranga BTP', 'assigned_user_id' => $this->agent->id]);
        $unfollowed = Client::factory()->create(['name' => 'Ousmane Sy', 'assigned_user_id' => null]);
        foreach ([$followed, $unfollowed] as $client) {
            $draft = Billing::saveDraft(new Invoice(['client_id' => $client->id, 'activity' => 'negoce', 'created_by' => $this->accountant->id]), [],
                [['description' => 'Ciment', 'quantity' => 10, 'unit_price' => 4_250, 'vat_rate' => 18]]);
            Billing::issue($draft, $this->accountant);
        }

        $this->remind('2026-10-20'); // échéance à 15 jours : J+4

        $this->assertSame($this->agent->id, Task::where('client_id', $followed->id)->sole()->user_id);
        $this->assertSame($this->accountant->id, Task::where('client_id', $unfollowed->id)->sole()->user_id);
        $this->assertStringContainsString('facture FAC-2026-', Task::where('client_id', $unfollowed->id)->sole()->title);
    }

    public function test_the_agent_is_alerted_once_when_the_end_of_a_lease_approaches(): void
    {
        $this->lease(['end_date' => '2027-01-31']);

        Carbon::setTestNow('2026-11-15'); // 77 jours avant : pas encore
        $this->artisan('borom:check-lease-ends')->assertSuccessful();
        $this->assertSame(0, Task::where('title', 'like', 'Bail %')->count());

        Carbon::setTestNow('2026-12-05'); // 57 jours avant
        $this->artisan('borom:check-lease-ends')->assertSuccessful();
        $this->artisan('borom:check-lease-ends')->assertSuccessful();

        $task = Task::where('title', 'like', 'Bail %')->sole();
        $this->assertStringContainsString('fin prévue le 31/01/2027', $task->title);
        $this->assertSame($this->agent->id, $task->user_id);
    }
}
