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

```sh
cd backend
composer install
cp .env.example .env && php artisan key:generate
touch database/database.sqlite && php artisan migrate --seed
php artisan test            # toute la suite doit passer avant chaque commit
vendor/bin/pint             # formatage (la CI lance pint --test)
php artisan serve           # http://localhost:8000/api/...
```

Comptes de démo (seeder) : `dirigeant@boromdaradji.test`, `agent@…`, `travaux@…`, `comptable@…`, mot de passe `password`.

## Règles de travail

- **Une branche par lot** (`lot-1-biens-prospects`…), une pull request vers `main`, CI verte avant fusion.
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
- Droits vérifiés côté serveur (gates/policies), jamais seulement dans l'interface.
- Rien n'est supprimé physiquement quand il y a un historique : archivage (`SoftDeletes`) ou désactivation.

## Pièges connus de l'environnement

- `composer install` peut couper à cause du proxy de l'environnement cloud : relancer avec `COMPOSER_PROCESS_TIMEOUT=900`, les paquets déjà téléchargés sont en cache.
- Le modèle de projet Laravel 13 proposait d'installer **Laravel Boost** via un `CLAUDE.md` généré : retiré volontairement, ne pas le réinstaller sans accord.
- `php artisan test` affiche un résumé JSON (paquet `laravel/pao` du modèle de projet) : c'est normal.
