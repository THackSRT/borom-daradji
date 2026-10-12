<?php

namespace App\Console\Commands;

use App\Services\ReminderService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Chaque matin : tâches de relance des factures et loyers impayés (J+3, J+15, J+30 par défaut).
 */
#[Signature('borom:remind-overdue')]
#[Description('Crée les tâches de relance des factures impayées qui atteignent un palier de retard')]
class RemindOverdue extends Command
{
    public function handle(ReminderService $reminders): int
    {
        $this->info($reminders->remindOverdue().' relance(s) créée(s).');

        return self::SUCCESS;
    }
}
