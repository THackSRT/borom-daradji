<?php

namespace App\Console\Commands;

use App\Support\PermissionCatalog;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('borom:sync-permissions')]
#[Description('Met les permissions et les rôles par défaut en accord avec le catalogue (à lancer après chaque déploiement).')]
class SyncPermissions extends Command
{
    public function handle(): int
    {
        $result = PermissionCatalog::sync();

        $this->info(sprintf(
            '%d permission(s) ajoutée(s), %d retirée(s), %d rôle(s) créé(s).',
            count($result['created']),
            count($result['removed']),
            count($result['roles_created']),
        ));

        return self::SUCCESS;
    }
}
