<?php

namespace App\Services;

use App\Enums\ClientCategory;
use App\Enums\WorksiteStatus;
use App\Models\Quote;
use App\Models\User;
use App\Models\Worksite;
use App\Models\WorksiteLog;
use App\Models\WorksiteLot;
use App\Models\WorksitePhoto;
use App\Support\ImageOptimizer;
use App\Support\Sequence;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Chantiers (lot 3) : création depuis un devis accepté, statuts, avancement des lots, journal, photos
 * et lien de suivi du client. Les changements de statut et d'avancement sont inscrits au journal,
 * visibles du client.
 */
class WorksiteService
{
    /**
     * Chantier créé à la main, au stade du devis (le devis accepté le fera passer en « planifié »).
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, User $by): Worksite
    {
        $worksite = new Worksite([...$data, 'created_by' => $by->id]);
        $worksite->reference = sprintf('CH-%d-%04d', now()->year, Sequence::next('chantier'));
        $worksite->status = WorksiteStatus::Devis;
        $worksite->save();

        return $worksite;
    }

    /**
     * Devis accepté : crée le chantier, ou complète le chantier désigné (même client, encore au stade
     * du devis ou ouvert), avec les lots et le montant du devis.
     */
    public function fromQuote(Quote $quote, User $by, ?int $worksiteId = null): Worksite
    {
        return DB::transaction(function () use ($quote, $by, $worksiteId) {
            $quote->loadMissing('lots');
            $worksite = $worksiteId ? Worksite::query()->lockForUpdate()->findOrFail($worksiteId) : null;

            if ($worksite) {
                if ($worksite->client_id !== $quote->client_id) {
                    throw ValidationException::withMessages(['worksite_id' => 'Ce chantier appartient à un autre client.']);
                }
                if (! in_array($worksite->status, [WorksiteStatus::Devis, WorksiteStatus::Planifie, WorksiteStatus::EnCours, WorksiteStatus::Suspendu], true)) {
                    throw ValidationException::withMessages(['worksite_id' => 'Ce chantier est terminé : créez-en un nouveau.']);
                }
            } else {
                $worksite = $this->create([
                    'client_id' => $quote->client_id,
                    'property_id' => $quote->property_id,
                    'title' => $quote->title,
                    'address' => $quote->site_address,
                    'manager_id' => null,
                ], $by);
            }

            $position = (int) $worksite->lots()->max('position');
            foreach ($quote->lots as $lot) {
                $worksite->lots()->create([
                    'quote_lot_id' => $lot->id,
                    'trade_id' => $lot->trade_id,
                    'title' => $lot->title,
                    'amount_ht' => $lot->total_ht,
                    'position' => ++$position,
                ]);
            }

            $worksite->forceFill([
                'quote_id' => $worksite->quote_id ?? $quote->id,
                'contract_ht' => $worksite->contract_ht + $quote->total_ht,
                'contract_total' => $worksite->contract_total + $quote->total,
            ])->save();
            if ($worksite->status === WorksiteStatus::Devis) {
                $worksite->forceFill(['status' => WorksiteStatus::Planifie])->save();
            }
            $quote->forceFill(['worksite_id' => $worksite->id])->save();
            $client = $quote->client;
            if ($client && ! in_array(ClientCategory::ClientTravaux, $client->categories->all(), true)) {
                $client->update(['categories' => [...$client->categories->all(), ClientCategory::ClientTravaux]]);
            }

            $this->log($worksite, "Devis {$quote->number} accepté : ".Billing::money($quote->total).' TTC.', $by, 'statut', false);

            return $worksite;
        });
    }

    public function transition(Worksite $worksite, WorksiteStatus $to, User $by, ?string $note = null): Worksite
    {
        $from = $worksite->status;
        if (! $from->canTransitionTo($to)) {
            throw ValidationException::withMessages(['status' => "Passage impossible de « {$from->label()} » à « {$to->label()} »."]);
        }

        return DB::transaction(function () use ($worksite, $from, $to, $by, $note) {
            $worksite->status = $to;
            if ($to === WorksiteStatus::EnCours && ! $worksite->start_date) {
                $worksite->start_date = today();
            }
            if ($to === WorksiteStatus::Termine) {
                $worksite->actual_end_date = today();
            }
            if ($from === WorksiteStatus::Termine && $to === WorksiteStatus::EnCours) {
                $worksite->actual_end_date = null;
            }
            $worksite->save();

            $text = match ($to) {
                WorksiteStatus::EnCours => $from === WorksiteStatus::Planifie ? 'Démarrage du chantier.' : 'Reprise du chantier.',
                WorksiteStatus::Suspendu => 'Chantier suspendu.',
                WorksiteStatus::Termine => 'Fin des travaux.',
                default => "Statut : {$to->label()}.",
            };
            $this->log($worksite, trim($text.' '.($note ?? '')), $by, 'statut', true);

            return $worksite;
        });
    }

    public function setProgress(WorksiteLot $lot, int $progress, User $by): WorksiteLot
    {
        $this->ensureOpen($lot->worksite);
        $old = $lot->progress;
        if ($old === $progress) {
            return $lot;
        }
        $lot->update(['progress' => $progress]);
        $this->log($lot->worksite, "{$lot->title} : avancement {$old} % → {$progress} %.", $by, 'avancement', true);

        return $lot;
    }

    public function log(Worksite $worksite, string $body, ?User $by, string $kind = 'note', bool $public = false, ?string $date = null): WorksiteLog
    {
        return $worksite->logs()->create([
            'user_id' => $by?->id,
            'kind' => $kind,
            'logged_on' => $date ?? today()->toDateString(),
            'body' => $body,
            'is_public' => $public,
        ]);
    }

    /**
     * Photo datée et géolocalisée (coordonnées et heure envoyées par le téléphone). Une photo déjà reçue
     * avec le même identifiant (synchronisation hors ligne relancée) n'est pas enregistrée deux fois.
     *
     * @param  array{worksite_lot_id?: int|null, caption?: string|null, taken_at?: string|null, latitude?: float|null, longitude?: float|null, is_public?: bool, client_uuid?: string|null}  $meta
     */
    public function addPhoto(Worksite $worksite, UploadedFile $file, array $meta, User $by): WorksitePhoto
    {
        if (! empty($meta['client_uuid']) && $existing = WorksitePhoto::query()->where('client_uuid', $meta['client_uuid'])->first()) {
            return $existing;
        }
        if (! empty($meta['worksite_lot_id']) && ! $worksite->lots()->whereKey($meta['worksite_lot_id'])->exists()) {
            throw ValidationException::withMessages(['worksite_lot_id' => 'Ce lot n\'appartient pas à ce chantier.']);
        }

        return $worksite->photos()->create([
            'worksite_lot_id' => $meta['worksite_lot_id'] ?? null,
            'path' => ImageOptimizer::storeAsWebp($file, "worksites/{$worksite->id}", 'local'),
            'caption' => $meta['caption'] ?? null,
            'taken_at' => $meta['taken_at'] ?? now(),
            'latitude' => $meta['latitude'] ?? null,
            'longitude' => $meta['longitude'] ?? null,
            'is_public' => $meta['is_public'] ?? true,
            'client_uuid' => $meta['client_uuid'] ?? null,
            'created_by' => $by->id,
        ]);
    }

    public function deletePhoto(WorksitePhoto $photo): void
    {
        Storage::disk('local')->delete($photo->path);
        $photo->delete();
    }

    /**
     * Active (ou renouvelle) le lien de suivi : l'ancien lien cesse de fonctionner.
     */
    public function enableTracking(Worksite $worksite): Worksite
    {
        $worksite->forceFill(['tracking_token' => Str::random(48), 'tracking_enabled_at' => now()])->save();

        return $worksite;
    }

    public function revokeTracking(Worksite $worksite): Worksite
    {
        $worksite->forceFill(['tracking_token' => null, 'tracking_enabled_at' => null])->save();

        return $worksite;
    }

    public function ensureOpen(Worksite $worksite): void
    {
        if (! $worksite->status->isOpen()) {
            throw ValidationException::withMessages(['worksite' => "Chantier « {$worksite->status->label()} » : plus de saisie possible."]);
        }
    }
}
