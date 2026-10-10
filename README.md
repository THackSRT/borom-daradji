# Borom Daradji — système de gestion

Logiciel de gestion de l'agence Borom Daradji (Dakar) : immobilier, gestion locative, travaux et négoce de matériaux.

**Reprendre le projet** (développeur ou session Claude) : commencer par [`CLAUDE.md`](CLAUDE.md), puis [`docs/journal.md`](docs/journal.md).

| Document | Contenu |
| --- | --- |
| [`docs/journal.md`](docs/journal.md) | État actuel, prochaines actions, questions ouvertes, historique des sessions |
| [`docs/perimetre-et-lots.md`](docs/perimetre-et-lots.md) | Périmètre, détail de chaque lot, règles métier, critères d'acceptation |
| [`docs/contexte-metier.md`](docs/contexte-metier.md) | Le client, les utilisateurs, les réalités du terrain, le glossaire |
| [`docs/architecture.md`](docs/architecture.md) | Architecture, mécanismes transverses, conventions |
| [`docs/decisions.md`](docs/decisions.md) | Décisions prises et leurs raisons |
| [`docs/sources.md`](docs/sources.md) | Résumé des documents du client et erreurs relevées |

## Organisation du dépôt

| Dossier | Contenu |
| --- | --- |
| `backend/` | API Laravel : un module par métier, droits vérifiés côté serveur |
| `frontend/` | *(à venir)* site vitrine, back-office et appli terrain en React |

## Avancement par lot

| Lot | Contenu | État |
| --- | --- | --- |
| 0. Socle | Comptes, 5 rôles cumulables, paramètres de l'entreprise, journal d'activité | API faite, écrans à faire |
| 1. Biens et prospects | Biens, vérification foncière, CRM, visites, site vitrine | API faite, écrans à faire |
| 2. Encaissements et location | Factures, encaissements mobile money, baux, loyers, quittances | À faire |
| 3. Travaux | Devis par lots, chantiers, tâcherons, caisse de chantier, suivi client | À faire |
| 4. Stock et négoce | Articles, entrées et sorties, coût moyen pondéré, vente au comptoir | À faire |
| 5. Pilotage | Tableau de bord, exports comptables | À faire |

## Démarrer le backend en local

Prérequis : PHP 8.3+ et Composer.

```sh
cd backend
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate --seed   # comptes de démo (mot de passe « password »), 12 biens et quelques prospects
php artisan serve
```

Comptes de démo : `dirigeant@boromdaradji.test`, `agent@boromdaradji.test`,
`travaux@boromdaradji.test`, `comptable@boromdaradji.test`.

En production, ne pas lancer le seeder ; créer le premier compte avec :

```sh
php artisan borom:create-director
```

Tâches planifiées : ajouter `* * * * * php /chemin/backend/artisan schedule:run` au cron du serveur.

## Tests

```sh
cd backend
php artisan test
vendor/bin/pint --test
```
