<?php

namespace App\Models;

use App\Enums\ClientCategory;
use App\Enums\ClientKind;
use App\Enums\LeadSource;
use App\Enums\PipelineStatus;
use App\Models\Concerns\LogsActivity;
use App\Support\PhoneNumber;
use App\Support\WhatsApp;
use Carbon\CarbonInterface;
use Database\Factories\ClientFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\AsEnumCollection;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Personne ou entreprise en relation avec l'agence : prospect, acheteur, locataire, propriétaire, fournisseur…
 */
#[Fillable([
    'kind', 'name', 'phone', 'whatsapp', 'email', 'categories', 'city', 'address', 'source',
    'pipeline_status', 'solvency', 'tags', 'assigned_user_id', 'private_notes',
])]
class Client extends Model
{
    /** @use HasFactory<ClientFactory> */
    use HasFactory, LogsActivity, SoftDeletes;

    protected $attributes = [
        'kind' => 'particulier',
        'categories' => '[]',
        'tags' => '[]',
        'pipeline_status' => 'nouveau',
    ];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'kind' => ClientKind::class,
            'categories' => AsEnumCollection::of(ClientCategory::class),
            'source' => LeadSource::class,
            'pipeline_status' => PipelineStatus::class,
            'tags' => 'array',
            'last_contact_at' => 'datetime',
        ];
    }

    protected function phone(): Attribute
    {
        return Attribute::make(set: fn (?string $value) => PhoneNumber::normalize($value) ?? $value);
    }

    protected function whatsapp(): Attribute
    {
        return Attribute::make(set: fn (?string $value) => PhoneNumber::normalize($value) ?? $value);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    /**
     * @return HasMany<ClientDocument, $this>
     */
    public function documents(): HasMany
    {
        return $this->hasMany(ClientDocument::class);
    }

    /**
     * @return HasMany<SearchCriterion, $this>
     */
    public function searchCriteria(): HasMany
    {
        return $this->hasMany(SearchCriterion::class);
    }

    /**
     * @return HasMany<Interaction, $this>
     */
    public function interactions(): HasMany
    {
        return $this->hasMany(Interaction::class)->latest('occurred_at');
    }

    /**
     * @return HasMany<Visit, $this>
     */
    public function visits(): HasMany
    {
        return $this->hasMany(Visit::class)->latest('scheduled_at');
    }

    /**
     * @return HasMany<Property, $this>
     */
    public function ownedProperties(): HasMany
    {
        return $this->hasMany(Property::class, 'owner_id');
    }

    public function whatsappUrl(string $text = ''): ?string
    {
        return WhatsApp::link($this->whatsapp ?? $this->phone, $text);
    }

    /**
     * Fait avancer le prospect, jamais reculer : une visite enregistrée après une négociation
     * ne doit pas ramener le prospect à « visite faite ».
     */
    public function advancePipeline(PipelineStatus $to): void
    {
        if ($to->rank() > $this->pipeline_status->rank()) {
            $this->pipeline_status = $to;
        }
    }

    public function recordContact(CarbonInterface $at): void
    {
        if ($this->last_contact_at === null || $at->greaterThan($this->last_contact_at)) {
            $this->last_contact_at = $at;
        }
    }
}
