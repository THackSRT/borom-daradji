<?php

namespace App\Services;

use App\Enums\PropertyStatus;
use App\Models\Property;
use App\Models\PropertyCheck;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Change le statut d'un bien en appliquant le workflow et la règle de vérification foncière.
 */
class PropertyStatusService
{
    public function __construct(private readonly ProspectMatcher $matcher) {}

    /**
     * @throws ValidationException
     */
    public function transition(Property $property, PropertyStatus $to, ?string $reason, User $user): Property
    {
        $from = $property->status;

        if (! $from->canTransitionTo($to)) {
            throw ValidationException::withMessages([
                'status' => "Passage impossible de « {$from->label()} » à « {$to->label()} ».",
            ]);
        }

        if ($to === PropertyStatus::Disponible) {
            $this->ensureVerified($property);
        }

        $isFirstPublication = $to === PropertyStatus::Disponible && $property->published_at === null;

        DB::transaction(function () use ($property, $from, $to, $reason, $user) {
            $property->status = $to;
            $property->published_at ??= $to === PropertyStatus::Disponible ? now() : null;
            $property->save();

            $property->statusChanges()->create([
                'from' => $from,
                'to' => $to,
                'reason' => $reason,
                'user_id' => $user->id,
            ]);
        });

        if ($isFirstPublication) {
            $this->matcher->notifyAgents($property, $user);
        }

        return $property;
    }

    /**
     * @throws ValidationException
     */
    private function ensureVerified(Property $property): void
    {
        $blocking = $property->blockingChecks();

        if ($blocking->isEmpty()) {
            return;
        }

        $missing = $blocking->map(fn (PropertyCheck $check) => $check->isExpired()
            ? $check->item->label().' (à renouveler)'
            : $check->item->label());

        throw ValidationException::withMessages([
            'status' => 'Vérification foncière incomplète : '.$missing->implode(', ').'.',
            'checks' => $blocking->map(fn (PropertyCheck $check) => $check->item->value)->all(),
        ]);
    }
}
