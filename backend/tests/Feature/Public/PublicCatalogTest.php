<?php

namespace Tests\Feature\Public;

use App\Enums\ClientCategory;
use App\Enums\Role;
use App\Models\Client;
use App\Models\CompanySetting;
use App\Models\Interaction;
use App\Models\Property;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicCatalogTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_published_properties_are_listed_without_private_data(): void
    {
        $owner = Client::factory()->owner()->create();
        Property::factory()->published()->create(['title' => 'En ligne', 'owner_id' => $owner->id, 'address' => '12 rue secrète']);
        Property::factory()->create(['title' => 'Brouillon']);
        Property::factory()->published()->create(['title' => 'Archivé'])->delete();

        $response = $this->getJson('/api/public/properties')->assertOk()->assertJsonCount(1, 'data');

        $response->assertJsonPath('data.0.title', 'En ligne')
            ->assertJsonMissingPath('data.0.owner')
            ->assertJsonMissingPath('data.0.address')
            ->assertJsonMissingPath('data.0.id');
    }

    public function test_filters_use_the_same_names_as_the_existing_site(): void
    {
        Property::factory()->published()->create(['title' => 'Petit', 'price' => 50_000_000, 'surface' => 60]);
        Property::factory()->published()->create(['title' => 'Grand', 'price' => 400_000_000, 'surface' => 300]);
        Property::factory()->forRent()->published()->create(['title' => 'À louer']);

        $this->getJson('/api/public/properties?transaction=vente&priceMax=100000000')
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.title', 'Petit');
        $this->getJson('/api/public/properties?surfaceMin=200')
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.title', 'Grand');
        $this->getJson('/api/public/properties?sort=price_desc&transaction=vente')
            ->assertJsonPath('data.0.title', 'Grand');
    }

    public function test_detail_page_by_slug_offers_a_whatsapp_link_to_the_agency(): void
    {
        CompanySetting::current()->update(['whatsapp' => '+221771234567']);
        $property = Property::factory()->published()->create();
        $draft = Property::factory()->create();

        $url = $this->getJson("/api/public/properties/{$property->slug}")
            ->assertOk()
            ->assertJsonPath('data.reference', $property->reference)
            ->json('data.whatsapp_url');

        $this->assertStringStartsWith('https://wa.me/221771234567?text=', $url);
        $this->assertStringContainsString(rawurlencode($property->reference), $url);
        $this->getJson("/api/public/properties/{$draft->slug}")->assertNotFound();
    }

    public function test_places_come_from_the_catalogue_so_filters_never_return_nothing(): void
    {
        Property::factory()->published()->create(['city' => 'Dakar', 'neighborhood' => 'Sacré-Cœur 3']);
        Property::factory()->published()->create(['city' => 'Dakar', 'neighborhood' => 'Almadies']);
        Property::factory()->published()->create(['city' => 'Thiès', 'neighborhood' => null]);
        Property::factory()->create(['city' => 'Mbour']);

        $this->getJson('/api/public/places')
            ->assertOk()
            ->assertJsonPath('data.0.city', 'Dakar')
            ->assertJsonPath('data.0.neighborhoods', ['Almadies', 'Sacré-Cœur 3'])
            ->assertJsonPath('data.1.city', 'Thiès')
            ->assertJsonCount(2, 'data');
    }

    public function test_a_site_request_becomes_a_followed_prospect_for_the_property_agent(): void
    {
        $agent = User::factory()->withRoles(Role::Agent)->create();
        $property = Property::factory()->forRent()->published()->create(['agent_id' => $agent->id]);

        $this->postJson('/api/public/leads', [
            'name' => 'Fatou Ndiaye',
            'phone' => '76 555 44 33',
            'message' => 'Est-ce toujours disponible ?',
            'property' => $property->slug,
        ])->assertAccepted();

        $client = Client::where('phone', '+221765554433')->firstOrFail();
        $this->assertSame($agent->id, $client->assigned_user_id);
        $this->assertSame('site', $client->source->value);
        $this->assertTrue($client->categories->contains(ClientCategory::Locataire));
        $this->assertDatabaseHas(Interaction::class, ['client_id' => $client->id, 'channel' => 'formulaire_site', 'property_id' => $property->id]);
        $this->assertDatabaseHas(Task::class, ['client_id' => $client->id, 'user_id' => $agent->id]);
    }

    public function test_a_second_request_from_the_same_phone_reuses_the_client(): void
    {
        $existing = Client::factory()->create(['phone' => '+221765554433', 'name' => 'Fatou N.']);

        $this->postJson('/api/public/leads', ['name' => 'Fatou Ndiaye', 'phone' => '+221 76 555 44 33', 'message' => 'Bonjour'])
            ->assertAccepted();

        $this->assertSame(1, Client::count());
        $this->assertSame('Fatou N.', $existing->fresh()->name);
        $this->assertSame(1, $existing->interactions()->count());
    }

    public function test_without_agent_the_request_goes_to_the_dirigeant(): void
    {
        $dirigeant = User::factory()->dirigeant()->create();

        $this->postJson('/api/public/leads', ['name' => 'Moussa', 'phone' => '781234567', 'message' => 'Je cherche un terrain'])
            ->assertAccepted();

        $this->assertDatabaseHas(Task::class, ['user_id' => $dirigeant->id]);
    }

    public function test_the_honeypot_silently_drops_robots(): void
    {
        $this->postJson('/api/public/leads', [
            'name' => 'Robot', 'phone' => '781234567', 'message' => 'spam', 'website' => 'http://spam.example',
        ])->assertAccepted();

        $this->assertSame(0, Client::count());
    }

    public function test_an_invalid_phone_is_rejected(): void
    {
        $this->postJson('/api/public/leads', ['name' => 'X', 'phone' => '0612345678', 'message' => 'Bonjour'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('phone');
    }
}
