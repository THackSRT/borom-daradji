# CLAUDE.md — point d'entrée pour reprendre le projet

Ce fichier est lu automatiquement par Claude Code. Il permet à n'importe quelle session, sur n'importe quel compte, de reprendre le travail sans l'historique des conversations précédentes.

## Le projet en trois phrases

Logiciel de gestion de **Borom Daradji**, une agence de Dakar qui fait de l'immobilier (vente, location, gestion locative), des travaux multi-métiers et du négoce de matériaux. Il remplace un site vitrine statique (dépôt `THackSRT/borom-daradji-properties`, généré avec Lovable) par une API Laravel et des écrans React, livrés en 6 lots. Le client, son équipe et ses utilisateurs parlent français : l'interface, les messages d'erreur et la documentation sont en français.

## À lire avant de coder, dans cet ordre

1. [`docs/journal.md`](docs/journal.md) : **état actuel, dernière session, prochaine action**. Toujours commencer ici.
2. [`docs/perimetre-et-lots.md`](docs/perimetre-et-lots.md) : ce qu'on construit, lot par lot, avec les règles métier et les critères d'acceptation.
3. [`docs/contexte-metier.md`](docs/contexte-metier.md) : les réalités du métier au Sénégal qui expliquent la plupart des choix.
4. [`docs/architecture.md`](docs/architecture.md) : architecture, mécanismes transverses, conventions de code.
5. [`docs/decisions.md`](docs/decisions.md) : décisions déjà prises et leurs raisons. **Ne pas les rediscuter sans élément nouveau.**
6. [`docs/sources.md`](docs/sources.md) : résumé des documents du client (cahier des charges v2.0 et chiffrage) et erreurs relevées dedans.

## Commandes

Avec Docker (environnement de référence, D-037 ; détail dans `README.md`) :

```sh
make up                     # dev : http://localhost:8080 (site, /admin), API sur :8000, MySQL
make check                  # avant chaque commit : tests, Pint, typecheck, lint, build
make test-mysql             # tests de l'API sur MySQL (base borom_test séparée)
make prod-up                # production (Caddy + PHP-FPM + MySQL), variables dans .env.prod
```

Sans Docker :

```sh
cd backend
composer install
cp .env.example .env && php artisan key:generate
touch database/database.sqlite && php artisan migrate --seed
php artisan test            # toute la suite doit passer avant chaque commit
vendor/bin/pint             # formatage (pint --test doit passer)
php artisan serve           # http://localhost:8000/api/...
```

```sh
cd frontend
npm ci
npm run dev                 # http://localhost:8080 ; /api relayé vers http://localhost:8000
npm run typecheck && npm run lint && npm run build
```

Back-office : http://localhost:8080/admin. Comptes de démo (seeder) : `dirigeant@boromdaradji.test`, `agent@…`, `travaux@…`, `comptable@…`, mot de passe `password`.

## Règles de travail

- **Une branche par lot** (`lot-1-biens-prospects`…), une pull request vers `main`. Pas d'intégration continue (D-038) : `make check` (ou les commandes sans Docker) doit passer avant chaque commit.
- **Tests obligatoires** : chaque règle métier a son test de fonctionnalité (`tests/Feature`). Écrire les tests en français dans les noms de données, en anglais dans les noms de méthodes (`test_dirigeant_cannot_lock_themself_out`), comme l'existant.
- **Mettre à jour `docs/journal.md` à la fin de chaque session** : ce qui a été fait, ce qui reste, les questions en suspens. C'est ce qui permet le relais.
- **Nouvelle décision structurante** → une entrée dans `docs/decisions.md`.
- **Nouvelle question pour le client** → la liste « Questions ouvertes » de `docs/journal.md`. Ne pas inventer une règle métier : choisir une valeur par défaut raisonnable, la rendre paramétrable si possible, et la noter comme « à valider ».
- Pas de pull request, de push forcé ni de fusion sans demande explicite de l'utilisateur.

## Conventions de code (résumé, détail dans `docs/architecture.md`)

- Code (classes, méthodes, colonnes) en **anglais** ; valeurs métier stockées en **français sans accents** (`dirigeant`, `responsable_travaux`, `titre_foncier`) ; commentaires, messages et libellés en **français**.
- Montants en **francs CFA entiers** (`bigInteger`, pas de centimes, pas de float).
- Téléphones toujours passés par `App\Support\PhoneNumber::normalize()` → format `+221XXXXXXXXX`.
- Tout modèle métier utilise le trait `LogsActivity` **et** reçoit un alias dans `Relation::enforceMorphMap()` (`AppServiceProvider`). Oublier l'alias fait planter la journalisation.
- Droits vérifiés côté serveur, jamais seulement dans l'interface : RBAC (D-034). Une nouvelle fonction = ses permissions dans `App\Support\PermissionCatalog`, vérifiées dans une policy (`$user->hasPermission()`) ou par `can:` ; côté écran, `can()` de `useAuth()`. Après déploiement : `php artisan borom:sync-permissions`.
- Rien n'est supprimé physiquement quand il y a un historique : archivage (`SoftDeletes`) ou désactivation.

## Pièges connus de l'environnement

- `composer install` peut couper à cause du proxy de l'environnement cloud : relancer avec `COMPOSER_PROCESS_TIMEOUT=900`, les paquets déjà téléchargés sont en cache.
- Le modèle de projet Laravel 13 proposait d'installer **Laravel Boost** via un `CLAUDE.md` généré : retiré volontairement, ne pas le réinstaller sans accord.
- `php artisan test` affiche un résumé JSON (paquet `laravel/pao` du modèle de projet) : c'est normal.
- **Pas de GitHub Actions** (D-038) : l'utilisateur ne s'en sert pas, ne pas recréer de workflow. Lancer soi-même les vérifications avant chaque commit.
- **Docker** : ne pas retirer `--no-reload` de `artisan serve` dans l'image de dev (sans lui, l'API perd les variables du conteneur et retombe sur SQLite) ni les lignes `<server>` de `phpunit.xml` (sans elles, les tests vident la base MySQL de dev). MySQL réordonne les clés JSON : ne pas tester l'ordre des clés.
- **Docker dans le bac à sable cloud** : lancer `dockerd` soi-même ; Docker Hub limite les téléchargements (passer par `mirror.gcr.io/library/…` puis `docker tag`) ; le dépôt de paquets Alpine est bloqué, donc l'image PHP réelle (extensions gd, intl…) ne s'y construit pas. Pour tester, une variante Debian sans gd/intl construite à part a suffi (les 8 tests d'images échouent alors, c'est attendu).
- Vérifier les écrans dans un vrai navigateur : Playwright est disponible (`/opt/pw-browsers`) ; les photos de démo (Unsplash) sont bloquées par le bac à sable, c'est normal.
- Pour arrêter les serveurs de développement, ne pas lancer `pkill -f "artisan serve"` depuis un shell dont la commande contient ce texte : il se tue lui-même. Passer par `ps aux | grep … | awk '{print $2}' | xargs kill`.
