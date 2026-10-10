<?php

namespace App\Support;

use App\Enums\Role as SystemRole;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

/**
 * Catalogue des permissions (RBAC) : la liste de référence, regroupée par module, avec les libellés
 * affichés dans le back-office, et les rôles fournis par défaut.
 *
 * Ajouter une permission : l'écrire ici, la vérifier côté serveur (policy ou middleware « can: »),
 * puis lancer `php artisan borom:sync-permissions` (fait aussi par les migrations qui l'appellent).
 * Les rôles déjà modifiés par le dirigeant ne sont pas écrasés : une nouvelle permission n'est
 * ajoutée d'office qu'aux rôles listés dans `newPermissionDefaults()`.
 */
final class PermissionCatalog
{
    /** Rôle « super-administrateur » : toutes les permissions, présentes et futures, non modifiable. */
    public const SUPER_ADMIN = 'dirigeant';

    /**
     * @return array<string, array{label: string, permissions: array<string, array{0: string, 1: string}>}>
     */
    public static function modules(): array
    {
        return [
            'dashboard' => ['label' => 'Tableau de bord', 'permissions' => [
                'dashboard.view_all' => ['Voir l\'activité de toute l\'agence', 'Sinon, l\'accueil ne montre que son propre portefeuille.'],
            ]],
            'properties' => ['label' => 'Biens', 'permissions' => [
                'properties.view' => ['Consulter les biens', 'Liste, fiches, photos, historique.'],
                'properties.create' => ['Créer des biens', 'Le créateur devient l\'agent du bien.'],
                'properties.update' => ['Modifier les biens', 'Fiche, photos, vérification foncière, statut, publication, mandats.'],
                'properties.delete' => ['Archiver des biens', 'Le bien disparaît des listes ; son historique est conservé.'],
                'properties.documents' => ['Consulter les pièces des biens', 'Titres fonciers, états des droits réels, mandats scannés. Consultation journalisée.'],
                'properties.mandates' => ['Consulter les mandats', 'Durée, commission, propriétaire.'],
            ]],
            'clients' => ['label' => 'Clients et prospects', 'permissions' => [
                'clients.view' => ['Consulter les clients', 'Fiches, échanges, historique.'],
                'clients.create' => ['Créer des clients', 'Un numéro de téléphone = un client.'],
                'clients.update' => ['Modifier les clients', 'Coordonnées, étape du pipeline, échanges.'],
                'clients.delete' => ['Archiver des clients', 'Le client disparaît des listes ; son historique est conservé.'],
                'clients.prospection' => ['Gérer la recherche des prospects', 'Critères de recherche et biens correspondants.'],
                'clients.documents.view_all' => ['Voir les pièces d\'identité de tous les clients', 'Sinon, seulement celles des clients qu\'on suit. Consultation journalisée (loi 2008-12).'],
                'clients.documents.manage' => ['Ajouter des pièces d\'identité', 'Sur n\'importe quel client (toujours possible sur ceux qu\'on suit).'],
            ]],
            'visits' => ['label' => 'Visites', 'permissions' => [
                'visits.view' => ['Consulter le planning des visites', ''],
                'visits.manage' => ['Planifier et rendre compte des visites', ''],
            ]],
            'tasks' => ['label' => 'Tâches', 'permissions' => [
                'tasks.manage_all' => ['Voir et gérer les tâches de toute l\'équipe', 'Chacun gère toujours ses propres tâches.'],
            ]],
            'invoices' => ['label' => 'Factures', 'permissions' => [
                'invoices.view' => ['Consulter les factures', 'Liste, fiches, PDF.'],
                'invoices.manage' => ['Préparer les factures', 'Créer, modifier et supprimer des brouillons.'],
                'invoices.issue' => ['Émettre les factures', 'Attribue le numéro définitif ; la facture ne se modifie plus.'],
                'invoices.credit' => ['Faire des avoirs', 'Corriger ou annuler une facture émise.'],
            ]],
            'payments' => ['label' => 'Encaissements et caisse', 'permissions' => [
                'payments.create' => ['Encaisser', 'Enregistrer un paiement et tenir sa caisse du jour.'],
                'payments.cancel' => ['Annuler un encaissement', 'Avec un motif, avant la clôture de la caisse.'],
                'payments.view_all' => ['Voir les encaissements de toute l\'équipe', 'Sinon, seulement les siens.'],
                'cash.view_all' => ['Voir et clôturer les caisses de l\'équipe', ''],
            ]],
            'administration' => ['label' => 'Administration', 'permissions' => [
                'users.view' => ['Consulter les comptes', 'Liste de l\'équipe et droits de chacun.'],
                'users.manage' => ['Gérer les comptes', 'Créer, modifier, désactiver, attribuer des rôles, réinitialiser un mot de passe.'],
                'roles.manage' => ['Gérer les rôles et les droits', 'Créer des rôles et choisir leurs permissions.'],
                'settings.manage' => ['Modifier les paramètres de l\'entreprise', 'Coordonnées, NINEA, TVA, logo, banque.'],
                'site.manage' => ['Modifier le site internet', 'Textes, images, couleurs, référencement.'],
                'activity.view' => ['Consulter le journal d\'activité', 'Qui a fait quoi, quand.'],
            ]],
        ];
    }

    /**
     * @return array<string, array{module: string, label: string, description: string}>
     */
    public static function all(): array
    {
        $all = [];
        foreach (self::modules() as $module => $definition) {
            foreach ($definition['permissions'] as $name => [$label, $description]) {
                $all[$name] = ['module' => $module, 'label' => $label, 'description' => $description];
            }
        }

        return $all;
    }

    /**
     * @return list<string>
     */
    public static function names(): array
    {
        return array_keys(self::all());
    }

    /**
     * Rôles fournis par défaut : ils reprennent les droits du cahier des charges et restent modifiables
     * (sauf le dirigeant, qui a tout).
     *
     * @return array<string, array{label: string, description: string, permissions: list<string>}>
     */
    public static function defaultRoles(): array
    {
        $prospection = ['clients.view', 'clients.create', 'clients.update', 'clients.prospection', 'clients.documents.manage', 'visits.view', 'visits.manage'];

        return [
            SystemRole::Dirigeant->value => [
                'label' => 'Dirigeant',
                'description' => 'Accès complet, y compris aux fonctions ajoutées plus tard. Ne peut pas être modifié.',
                'permissions' => [],
            ],
            SystemRole::Agent->value => [
                'label' => 'Agent immobilier',
                'description' => 'Gère ses biens et ses prospects, organise les visites, encaisse sur le terrain.',
                'permissions' => [
                    'properties.view', 'properties.create', 'properties.update', 'properties.delete', 'properties.documents', 'properties.mandates',
                    ...$prospection,
                    'invoices.view', 'payments.create',
                ],
            ],
            SystemRole::Commercial->value => [
                'label' => 'Commercial',
                'description' => 'Suit les prospects et les visites, consulte les biens, encaisse.',
                'permissions' => ['properties.view', ...$prospection, 'invoices.view', 'payments.create'],
            ],
            SystemRole::ResponsableTravaux->value => [
                'label' => 'Responsable travaux',
                'description' => 'Consulte les biens et les clients (les chantiers arrivent au lot 3).',
                'permissions' => ['properties.view', 'clients.view', 'clients.create', 'clients.update'],
            ],
            SystemRole::Comptable->value => [
                'label' => 'Comptable',
                'description' => 'Factures, avoirs, encaissements, caisses de l\'équipe.',
                'permissions' => [
                    'properties.view', 'properties.mandates', 'clients.view', 'clients.create', 'clients.update',
                    'invoices.view', 'invoices.manage', 'invoices.issue', 'invoices.credit',
                    'payments.create', 'payments.cancel', 'payments.view_all', 'cash.view_all',
                ],
            ],
        ];
    }

    /**
     * Permissions ajoutées après coup au catalogue : à quels rôles par défaut les donner lors de la
     * synchronisation (les autres rôles, y compris personnalisés, ne changent pas).
     *
     * @return array<string, list<string>>
     */
    public static function newPermissionDefaults(): array
    {
        return [];
    }

    /**
     * Met la base en accord avec le catalogue : crée les permissions manquantes, retire celles qui
     * n'existent plus, crée les rôles par défaut absents. Idempotent.
     *
     * @return array{created: list<string>, removed: list<string>, roles_created: list<string>}
     */
    public static function sync(): array
    {
        $result = ['created' => [], 'removed' => [], 'roles_created' => []];

        DB::transaction(function () use (&$result) {
            $catalog = self::all();
            $existing = Permission::query()->pluck('name')->all();

            foreach (array_diff(array_keys($catalog), $existing) as $name) {
                Permission::create(['name' => $name, 'guard_name' => 'web']);
                $result['created'][] = $name;
            }

            $obsolete = array_diff($existing, array_keys($catalog));
            if ($obsolete) {
                Permission::query()->whereIn('name', $obsolete)->delete();
                $result['removed'] = array_values($obsolete);
            }

            app(PermissionRegistrar::class)->forgetCachedPermissions();

            $freshInstall = Role::query()->doesntExist();
            foreach (self::defaultRoles() as $name => $definition) {
                $role = Role::query()->firstWhere('name', $name);
                if (! $role) {
                    $role = Role::create([
                        'name' => $name,
                        'guard_name' => 'web',
                        'label' => $definition['label'],
                        'description' => $definition['description'],
                        'is_system' => true,
                    ]);
                    $role->syncPermissions($definition['permissions']);
                    $result['roles_created'][] = $name;
                } elseif (! $freshInstall) {
                    $newcomers = array_intersect($result['created'], array_keys(self::newPermissionDefaults()));
                    foreach ($newcomers as $permission) {
                        if (in_array($name, self::newPermissionDefaults()[$permission], true)) {
                            $role->givePermissionTo($permission);
                        }
                    }
                }
            }
        });

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return $result;
    }
}
