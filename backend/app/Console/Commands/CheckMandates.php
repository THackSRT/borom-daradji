<?php

namespace App\Console\Commands;

use App\Enums\MandateStatus;
use App\Enums\TaskPriority;
use App\Models\Mandate;
use App\Models\Task;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Chaque matin : prévient l'agent des mandats qui expirent bientôt et clôt les mandats échus.
 */
#[Signature('borom:check-mandates')]
#[Description('Alerte sur les mandats proches de l\'expiration et clôt les mandats échus')]
class CheckMandates extends Command
{
    public function handle(): int
    {
        $today = now()->startOfDay();

        $expired = Mandate::where('status', MandateStatus::Actif)
            ->whereDate('ends_on', '<', $today)
            ->get();

        foreach ($expired as $mandate) {
            $mandate->update(['status' => MandateStatus::Expire]);
        }

        $soon = Mandate::with('property')
            ->where('status', MandateStatus::Actif)
            ->whereNull('expiry_alerted_at')
            ->whereDate('ends_on', '<=', $today->copy()->addDays(config('borom.mandate_alert_days')))
            ->get();

        foreach ($soon as $mandate) {
            $property = $mandate->property;

            Task::create([
                'user_id' => $property?->agent_id,
                'client_id' => $mandate->owner_id,
                'property_id' => $mandate->property_id,
                'title' => "Mandat de {$property?->reference} : expire le {$mandate->ends_on->format('d/m/Y')}",
                'details' => 'Renouveler le mandat avec le propriétaire ou retirer le bien.',
                'due_at' => $mandate->ends_on->copy()->startOfDay(),
                'priority' => TaskPriority::Haute,
            ]);

            $mandate->forceFill(['expiry_alerted_at' => now()])->saveQuietly();
        }

        $this->info("{$expired->count()} mandat(s) clos, {$soon->count()} alerte(s) créée(s).");

        return self::SUCCESS;
    }
}
