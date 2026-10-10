<?php

namespace Tests\Feature\Properties;

use App\Enums\Role;
use App\Models\ActivityLog;
use App\Models\Property;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PropertyFilesTest extends TestCase
{
    use RefreshDatabase;

    private Property $property;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        Storage::fake('local');
        $this->property = Property::factory()->create();
        Sanctum::actingAs(User::factory()->withRoles(Role::Agent)->create());
    }

    private function upload(int $count): TestResponse
    {
        $photos = array_map(fn ($i) => UploadedFile::fake()->image("photo{$i}.jpg", 2400, 1600), range(1, $count));

        return $this->post("/api/properties/{$this->property->id}/photos", ['photos' => $photos], ['Accept' => 'application/json']);
    }

    public function test_photos_are_converted_to_webp_and_the_first_one_becomes_the_cover(): void
    {
        $response = $this->upload(2)->assertOk()->assertJsonCount(2, 'data');

        $this->assertTrue($response->json('data.0.is_cover'));
        $this->assertFalse($response->json('data.1.is_cover'));

        $photo = $this->property->photos()->first();
        $this->assertStringEndsWith('.webp', $photo->path);
        Storage::disk('public')->assertExists($photo->path);

        [$width] = getimagesizefromstring(Storage::disk('public')->get($photo->path));
        $this->assertSame(1600, $width);
    }

    public function test_the_photo_limit_is_enforced(): void
    {
        config(['borom.max_photos_per_property' => 2]);
        $this->upload(2)->assertOk();

        $this->upload(1)->assertUnprocessable()->assertJsonValidationErrors('photos');
    }

    public function test_photos_can_be_reordered_and_deleting_the_cover_promotes_the_next(): void
    {
        $ids = collect($this->upload(3)->json('data'))->pluck('id');

        $this->putJson("/api/properties/{$this->property->id}/photos/order", ['ids' => $ids->reverse()->values()])
            ->assertOk()
            ->assertJsonPath('data.0.id', $ids[2]);

        $this->deleteJson("/api/properties/{$this->property->id}/photos/{$ids[0]}")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.is_cover', true);
    }

    public function test_a_photo_of_another_property_cannot_be_touched(): void
    {
        $other = Property::factory()->create();
        $photo = $other->photos()->create(['path' => 'x.webp', 'position' => 1]);

        $this->deleteJson("/api/properties/{$this->property->id}/photos/{$photo->id}")->assertNotFound();
    }

    public function test_documents_are_private_and_each_download_is_logged(): void
    {
        $id = $this->post("/api/properties/{$this->property->id}/documents", [
            'type' => 'titre_foncier',
            'document' => UploadedFile::fake()->create('TF-1234.pdf', 300, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.id');

        $document = $this->property->documents()->findOrFail($id);
        Storage::disk('local')->assertExists($document->path);
        Storage::disk('public')->assertMissing($document->path);

        $this->get("/api/properties/{$this->property->id}/documents/{$id}")->assertOk()->assertDownload('TF-1234.pdf');
        $this->assertDatabaseHas(ActivityLog::class, ['action' => 'downloaded', 'subject_type' => 'property_document', 'subject_id' => $id]);

        Sanctum::actingAs(User::factory()->withRoles(Role::Commercial)->create());
        $this->getJson("/api/properties/{$this->property->id}/documents")->assertForbidden();
        $this->get("/api/properties/{$this->property->id}/documents/{$id}")->assertForbidden();
    }
}
