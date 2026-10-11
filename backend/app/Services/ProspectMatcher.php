<?php

namespace App\Services;

use App\Enums\TaskPriority;
use App\Models\Client;
use App\Models\Property;
use App\Models\SearchCriterion;
use App\Models\Task;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Str;

/**
 * Rapproche un bien publié des critères des prospects. Aucun message n'est envoyé au client :
 * l'agent reçoit une tâche et décide (lien WhatsApp depuis la fiche).
 */
class ProspectMatcher
{
    /**
     * @return Collection<int, SearchCriterion>
     */
    public function matchingCriteria(Property $property): Collection
    {
        $tolerance = config('borom.matching_budget_tolerance');

        return SearchCriterion::query()
            ->with('client')
            ->whereHas('client')
            ->where('is_active', true)
            ->where('transaction', $property->transaction)
            ->where(fn ($q) => $q->whereNull('budget_max')->orWhere('budget_max', '>=', $property->price / (1 + $tolerance)))
            ->where(fn ($q) => $q->whereNull('budget_min')->orWhere('budget_min', '<=', $property->price / (1 - $tolerance)))
            ->where(fn ($q) => $q->whereNull('rooms_min')->orWhere('rooms_min', '<=', (int) $property->rooms))
            ->get()
            // Listes JSON (vide = indifférent) : filtrées en PHP, les volumes sont faibles.
            ->filter(fn (SearchCriterion $c) => $c->types->isEmpty() || $c->types->contains($property->type))
            ->filter(fn (SearchCriterion $c) => self::matchesPlace($c->cities, $property->city))
            ->filter(fn (SearchCriterion $c) => self::matchesPlace($c->neighborhoods, $property->neighborhood))
            ->values();
    }

    /**
     * Sens inverse : biens publiés correspondant aux critères actifs d'un client.
     *
     * @return Collection<int, Property>
     */
    public function propertiesFor(Client $client): Collection
    {
        $tolerance = config('borom.matching_budget_tolerance');

        return $client->searchCriteria()->where('is_active', true)->get()
            ->flatMap(fn (SearchCriterion $c) => Property::query()
                ->published()
                ->with('cover')
                ->where('transaction', $c->transaction)
                ->when($c->types->isNotEmpty(), fn ($q) => $q->whereIn('type', $c->types->map->value))
                ->when($c->budget_max, fn ($q, $max) => $q->where('price', '<=', $max * (1 + $tolerance)))
                ->when($c->budget_min, fn ($q, $min) => $q->where('price', '>=', $min * (1 - $tolerance)))
                ->when($c->rooms_min, fn ($q, $rooms) => $q->where('rooms', '>=', $rooms))
                ->get()
                ->filter(fn (Property $p) => self::matchesPlace($c->cities, $p->city))
                ->filter(fn (Property $p) => self::matchesPlace($c->neighborhoods, $p->neighborhood)))
            ->unique('id')
            ->values()
            ->pipe(fn ($items) => new Collection($items->all()));
    }

    public function notifyAgents(Property $property, User $author): int
    {
        $criteria = $this->matchingCriteria($property);

        foreach ($criteria->unique('client_id') as $criterion) {
            $client = $criterion->client;

            Task::create([
                'user_id' => $client->assigned_user_id ?? $property->agent_id ?? $author->id,
                'created_by' => $author->id,
                'client_id' => $client->id,
                'property_id' => $property->id,
                'title' => "Proposer {$property->reference} à {$client->name}",
                'details' => "Le bien « {$property->title} » correspond aux critères de recherche du prospect.",
                'due_at' => now()->addDay(),
                'priority' => TaskPriority::Haute,
            ]);
        }

        return $criteria->unique('client_id')->count();
    }

    /**
     * @param  array<int, string>|null  $wanted
     */
    private static function matchesPlace(?array $wanted, ?string $actual): bool
    {
        if (empty($wanted)) {
            return true;
        }

        $actual = Str::lower(Str::ascii((string) $actual));

        foreach ($wanted as $place) {
            // « Sacré-Cœur » doit trouver « Sacré-Cœur 3 ».
            if ($actual !== '' && str_starts_with($actual, Str::lower(Str::ascii($place)))) {
                return true;
            }
        }

        return false;
    }
}
