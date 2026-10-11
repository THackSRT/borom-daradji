<?php

namespace App\Console\Commands;

use App\Services\RentService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('borom:generate-rent-calls')]
#[Description('Émet les appels de loyer du mois pour tous les baux en cours (sans doublon).')]
class GenerateRentCalls extends Command
{
    public function handle(RentService $rent): int
    {
        $count = $rent->generateAll();
        $this->info("{$count} appel(s) de loyer émis.");

        return self::SUCCESS;
    }
}
