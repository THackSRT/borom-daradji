<?php

namespace App\Console\Commands;

use App\Services\ReminderService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Chaque matin : prévient l'agent des baux dont la fin prévue approche.
 */
#[Signature('borom:check-lease-ends')]
#[Description('Alerte sur les baux dont la fin prévue approche')]
class CheckLeaseEnds extends Command
{
    public function handle(ReminderService $reminders): int
    {
        $this->info($reminders->alertLeaseEnds().' alerte(s) de fin de bail créée(s).');

        return self::SUCCESS;
    }
}
