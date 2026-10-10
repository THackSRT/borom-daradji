<?php

namespace App\Services;

use App\Enums\InspectionType;
use App\Enums\ItemCondition;
use App\Models\Lease;
use App\Models\LeaseInspection;
use App\Models\LeaseInspectionItem;
use App\Models\LeaseInspectionPhoto;
use App\Models\Property;
use App\Models\User;
use App\Support\ImageOptimizer;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * États des lieux (lot 2) : un d'entrée et un de sortie par bail. La sortie reprend les lignes de
 * l'entrée pour comparer élément par élément ; les dégradations relevées servent à la restitution
 * de la caution (App\Services\DepositService). Un état des lieux validé ne se modifie plus.
 */
class InspectionService
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function create(Lease $lease, InspectionType $type, array $data, User $by): LeaseInspection
    {
        return DB::transaction(function () use ($lease, $type, $data, $by) {
            if ($lease->inspections()->where('type', $type)->exists()) {
                throw ValidationException::withMessages(['type' => "Ce bail a déjà un {$this->lower($type)}."]);
            }

            $inspection = $lease->inspections()->create([
                ...$data,
                'type' => $type,
                'inspected_on' => $data['inspected_on'] ?? today()->toDateString(),
                'inspector_id' => $data['inspector_id'] ?? $by->id,
                'created_by' => $by->id,
            ]);

            $entry = $type === InspectionType::Sortie ? $this->entryOf($lease) : null;
            $lines = $entry
                ? $entry->items->map(fn (LeaseInspectionItem $i) => ['room' => $i->room, 'element' => $i->element])->all()
                : self::template($lease->property);

            foreach (array_values($lines) as $position => $line) {
                $inspection->items()->create([...$line, 'position' => $position]);
            }

            return $inspection;
        });
    }

    /**
     * Lignes proposées pour un nouvel état des lieux, d'après config/borom.php et le bien.
     *
     * @return list<array{room: string, element: string}>
     */
    public static function template(Property $property): array
    {
        $counts = [
            'bedrooms' => max(1, (int) ($property->bedrooms ?? ($property->rooms ? $property->rooms - 1 : 1))),
            'bathrooms' => max(1, (int) ($property->bathrooms ?? 1)),
        ];

        $lines = [];
        foreach (config('borom.inspection_template') as $room) {
            $count = isset($room['per']) ? $counts[$room['per']] : 1;
            for ($n = 1; $n <= $count; $n++) {
                $name = str_replace(' {n}', $count > 1 ? " {$n}" : '', $room['room']);
                foreach ($room['elements'] as $element) {
                    $lines[] = ['room' => $name, 'element' => $element];
                }
            }
        }

        return $lines;
    }

    /**
     * Met à jour l'en-tête et les lignes : les lignes envoyées avec un id sont modifiées, sans id
     * ajoutées, les autres supprimées (leurs photos restent, détachées de l'élément).
     *
     * @param  array<string, mixed>  $data
     * @param  list<array<string, mixed>>|null  $items
     */
    public function update(LeaseInspection $inspection, array $data, ?array $items): LeaseInspection
    {
        $this->ensureEditable($inspection);

        return DB::transaction(function () use ($inspection, $data, $items) {
            $inspection->update($data);

            if ($items !== null) {
                $keep = [];
                foreach (array_values($items) as $position => $line) {
                    $attributes = [
                        'room' => $line['room'],
                        'element' => $line['element'],
                        'condition' => $line['condition'] ?? null,
                        'comment' => $line['comment'] ?? null,
                        'position' => $position,
                    ];
                    $item = isset($line['id']) ? $inspection->items()->whereKey($line['id'])->first() : null;
                    if (isset($line['id']) && ! $item) {
                        throw ValidationException::withMessages(['items' => 'Une ligne n\'appartient pas à cet état des lieux.']);
                    }
                    if ($item) {
                        $item->update($attributes);
                    } else {
                        $item = $inspection->items()->create($attributes);
                    }
                    $keep[] = $item->id;
                }
                $inspection->items()->whereNotIn('id', $keep)->delete();
            }

            return $inspection;
        });
    }

    /**
     * Valide l'état des lieux : chaque élément doit avoir un état. Ensuite, il est figé.
     */
    public function validate(LeaseInspection $inspection, User $by): LeaseInspection
    {
        $this->ensureEditable($inspection);

        $items = $inspection->items()->get();
        if ($items->isEmpty()) {
            throw ValidationException::withMessages(['items' => 'Ajoutez au moins un élément avant de valider.']);
        }
        $missing = $items->whereNull('condition')->count();
        if ($missing > 0) {
            throw ValidationException::withMessages(['items' => $missing === 1
                ? 'Un élément n\'a pas encore d\'état.'
                : "{$missing} éléments n'ont pas encore d'état."]);
        }

        $inspection->forceFill(['validated_at' => now(), 'validated_by' => $by->id])->save();

        return $inspection;
    }

    public function addPhoto(LeaseInspection $inspection, UploadedFile $file, ?int $itemId, User $by): LeaseInspectionPhoto
    {
        $this->ensureEditable($inspection);

        $max = (int) config('borom.inspection_max_photos');
        if ($inspection->photos()->count() >= $max) {
            throw ValidationException::withMessages(['photo' => "Un état des lieux ne peut pas avoir plus de {$max} photos."]);
        }
        if ($itemId !== null && ! $inspection->items()->whereKey($itemId)->exists()) {
            throw ValidationException::withMessages(['item_id' => 'Cet élément n\'appartient pas à cet état des lieux.']);
        }

        return $inspection->photos()->create([
            'lease_inspection_item_id' => $itemId,
            'path' => ImageOptimizer::storeAsWebp($file, "inspections/{$inspection->id}", 'local'),
            'created_by' => $by->id,
        ]);
    }

    public function deletePhoto(LeaseInspection $inspection, LeaseInspectionPhoto $photo): void
    {
        $this->ensureEditable($inspection);
        Storage::disk('local')->delete($photo->path);
        $photo->delete();
    }

    public function delete(LeaseInspection $inspection): void
    {
        $this->ensureEditable($inspection);

        DB::transaction(function () use ($inspection) {
            foreach ($inspection->photos as $photo) {
                Storage::disk('local')->delete($photo->path);
            }
            $inspection->delete();
        });
    }

    public function entryOf(Lease $lease): ?LeaseInspection
    {
        return $lease->inspections()->where('type', InspectionType::Entree)->with('items')->first();
    }

    /**
     * Sortie : état à l'entrée de chaque élément (même pièce, même élément) et dégradations.
     *
     * @return array<int, array{entry_condition: ?ItemCondition, entry_comment: ?string, degraded: bool}>
     */
    public function comparison(LeaseInspection $inspection): array
    {
        if ($inspection->type !== InspectionType::Sortie) {
            return [];
        }
        $entryItems = $this->entryOf($inspection->lease)?->items->keyBy(fn (LeaseInspectionItem $i) => $i->key()) ?? collect();

        return $inspection->items->mapWithKeys(function (LeaseInspectionItem $item) use ($entryItems) {
            $entry = $entryItems->get($item->key());

            return [$item->id => [
                'entry_condition' => $entry?->condition,
                'entry_comment' => $entry?->comment,
                'degraded' => (bool) $item->condition?->isDegradationFrom($entry?->condition),
            ]];
        })->all();
    }

    /**
     * Dégradations d'un état des lieux de sortie, proposées comme retenues sur la caution.
     *
     * @return Collection<int, array{room: string, element: string, condition: string, comment: ?string}>
     */
    public function degradations(LeaseInspection $inspection): Collection
    {
        $comparison = $this->comparison($inspection);

        return $inspection->items
            ->filter(fn (LeaseInspectionItem $item) => $comparison[$item->id]['degraded'] ?? false)
            ->map(fn (LeaseInspectionItem $item) => [
                'room' => $item->room,
                'element' => $item->element,
                'condition' => $item->condition->label(),
                'comment' => $item->comment,
            ])->values();
    }

    private function ensureEditable(LeaseInspection $inspection): void
    {
        if ($inspection->isValidated()) {
            throw ValidationException::withMessages(['inspection' => 'Cet état des lieux est validé : il ne se modifie plus.']);
        }
    }

    private function lower(InspectionType $type): string
    {
        return mb_strtolower(mb_substr($type->label(), 0, 1)).mb_substr($type->label(), 1);
    }
}
