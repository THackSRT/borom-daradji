<?php

namespace App\Console\Commands;

use App\Services\QuoteService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Chaque nuit : les devis envoyés dont la validité est dépassée passent en « expiré ».
 */
#[Signature('borom:expire-quotes')]
#[Description('Marque expirés les devis envoyés dont la date de validité est dépassée')]
class ExpireQuotes extends Command
{
    public function handle(QuoteService $quotes): int
    {
        $this->info($quotes->expireOverdue().' devis expiré(s).');

        return self::SUCCESS;
    }
}
