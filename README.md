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
| `frontend/` | Site vitrine et back-office React (`/admin`) ; voir [`frontend/README.md`](frontend/README.md) |
| `docker/`, `compose.yaml`, `compose.prod.yaml`, `Makefile` | Environnement Docker de développement et de production |

## Avancement par lot

| Lot | Contenu | État |
| --- | --- | --- |
| 0. Socle | Comptes, rôles et droits (RBAC), paramètres de l'entreprise, journal d'activité | Fait (API et écrans) |
| 1. Biens et prospects | Biens, vérification foncière, CRM, visites, site vitrine | Fait (API, back-office, site vitrine paramétrable) |
| 2. Encaissements et location | Factures, encaissements mobile money, baux, loyers, quittances | Fait (états des lieux et restitution de la caution compris) |
| 3. Travaux | Devis par lots, chantiers, tâcherons, caisse de chantier, suivi client, appli terrain hors ligne | Fait (branche `lot-3-travaux`) |
| 4. Stock et négoce | Articles, entrées et sorties, coût moyen pondéré, vente au comptoir, inventaire | Fait (branche `lot-4-stock-negoce`) |
| 5. Pilotage | Tableau de bord, exports comptables | À faire |

## Démarrer avec Docker (recommandé)

Prérequis : Docker avec Docker Compose (Docker Desktop sous Windows et macOS), et `make` si possible.

```sh
make up        # ou : docker compose up -d --build
```

- Site et back-office : http://localhost:8080 (back-office sous `/admin`)
- API : http://localhost:8000/api/…

Le premier démarrage prend quelques minutes (`composer install`, `npm ci`, migrations et données de démo) : `make logs` pour suivre. Les dossiers `backend/` et `frontend/` sont montés dans les conteneurs, les modifications sont prises en compte sans reconstruire. Après une modification de `backend/.env` : `docker compose restart backend`.

Comptes de démo : `dirigeant@boromdaradji.test`, `agent@boromdaradji.test`,
`travaux@boromdaradji.test`, `comptable@boromdaradji.test`, mot de passe `password`.

| Commande | Effet |
| --- | --- |
| `make up` / `make down` | Démarrer / arrêter (les données restent dans le volume PostgreSQL) |
| `make logs` | Journaux des conteneurs |
| `make artisan c="route:list"` | Commande artisan dans le conteneur de l'API |
| `make fresh` | Recréer la base avec les données de démo |
| `make check` | **Avant chaque commit** : tests et formatage de l'API, typecheck, lint et build du front |
| `make test-pgsql` | Tests de l'API sur PostgreSQL (base `borom_test`, séparée des données de dev) |
| `make psql` | Console PostgreSQL de la base de dev |
| `make help` | Toutes les commandes |

Sans `make` : chaque cible du `Makefile` est une commande `docker compose` à recopier. Sous Linux, mettre `UID` et `GID` dans un fichier `.env` à la racine (`echo "UID=$(id -u)" > .env && echo "GID=$(id -g)" >> .env`) pour que les fichiers créés par les conteneurs vous appartiennent ; `make` s'en charge.

Services : `backend` (API, `php artisan serve`), `scheduler` (tâches planifiées), `frontend` (Vite), `db` (PostgreSQL 17).

## Mettre en production avec Docker

Sur un serveur Linux avec Docker, un nom de domaine qui pointe vers lui et les ports 80 et 443 ouverts :

```sh
cp .env.prod.example .env.prod
make prod-key              # copier la ligne APP_KEY=… dans .env.prod
# remplir SITE_ADDRESS, APP_URL et DB_PASSWORD dans .env.prod
make prod-up               # construit les images et démarre ; HTTPS obtenu automatiquement
make prod-director         # crée le premier compte dirigeant (pas de données de démo)
```

- Services : `web` (Caddy : site, back-office, relais de l'API, photos, HTTPS), `app` (API, PHP-FPM), `scheduler` (tâches planifiées), `db` (PostgreSQL 17). Au démarrage, `app` applique les migrations et `borom:sync-permissions`.
- Mise à jour : `git pull` puis `make prod-up`.
- Sauvegarde : `make prod-backup` (base et fichiers dans `backups/`, à copier hors du serveur ; à planifier dans le cron du serveur, par exemple chaque nuit). Restauration de la base : `gunzip < backups/base-….sql.gz | docker compose -f compose.prod.yaml --env-file .env.prod exec -T db sh -c 'psql -q -U "$POSTGRES_USER" "$POSTGRES_DB"'`.
- Appli terrain : sur le téléphone du chef de chantier, ouvrir `https://<domaine>/admin/terrain` une première fois connecté (les chantiers et tâcherons sont gardés sur le téléphone), puis « Ajouter à l'écran d'accueil ». Le hors-ligne demande HTTPS (le service worker n'existe pas en HTTP, sauf sur `localhost`).
- Journaux : `make prod-logs`. Essai sur sa machine : `SITE_ADDRESS=http://localhost` et `APP_URL=http://localhost` dans `.env.prod`.

## Sans Docker

Prérequis : PHP 8.3+ (extensions gd, intl, pdo_sqlite), Composer, Node 22.

```sh
cd backend
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate --seed   # comptes de démo (mot de passe « password »), 12 biens et quelques prospects
php artisan serve
```

Front : `cd frontend && npm ci && npm run dev` (http://localhost:8080, `/api` relayé vers http://localhost:8000).

En production sans Docker, ne pas lancer le seeder ; créer le premier compte avec `php artisan borom:create-director` et ajouter `* * * * * php /chemin/backend/artisan schedule:run` au cron du serveur.

## Tests

Pas d'intégration continue (D-038) : lancer `make check` avant chaque commit. Sans Docker :

```sh
cd backend && php artisan test && vendor/bin/pint --test
cd frontend && npm run typecheck && npm run lint && npm run build
```
