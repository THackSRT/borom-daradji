# Backend — API Laravel

Voir le [README principal](../README.md) pour l'installation.

## API

Toutes les routes sont sous `/api` et renvoient du JSON. Authentification par jeton (Sanctum) :
`Authorization: Bearer <token>`. Les jetons expirent après 30 jours (`SANCTUM_EXPIRATION`, en minutes).

| Méthode | Route | Accès | Rôle |
| --- | --- | --- | --- |
| POST | `/auth/login` | public | Connexion par email **ou téléphone** (`login`, `password`, `device_name`) |
| GET | `/auth/me` | connecté | Compte courant |
| POST | `/auth/logout` | connecté | Révoque le jeton courant |
| PUT | `/auth/password` | connecté | Change le mot de passe et déconnecte les autres appareils |
| GET | `/public/company` | public | Coordonnées pour le site vitrine |
| GET | `/settings/company` | connecté | Paramètres de l'entreprise (NINEA, RCCM, TVA…) |
| PUT | `/settings/company` | dirigeant | Modifie les paramètres |
| POST | `/settings/company/logo` | dirigeant | Envoie le logo (PNG, JPG, WebP, 2 Mo max) |
| GET, POST, PUT, DELETE | `/users` | dirigeant | Comptes ; `DELETE` désactive sans supprimer |
| GET | `/activity-logs` | dirigeant | Journal (filtres `user_id`, `action`, `subject_type`, `subject_id`, `from`, `to`) |
| GET | `/meta` | connecté | Valeurs et libellés français de toutes les listes (types, statuts, canaux…) |

### Lot 1 — Biens et prospects

Droits détaillés dans `app/Policies` : agents en écriture sur les biens, autres rôles en lecture ; CRM ouvert à tous les rôles internes ; visites et critères pour agents et commerciaux ; le dirigeant a accès à tout.

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET, POST, PUT, DELETE | `/properties` | Biens (`DELETE` archive) ; filtres `search`, `type`, `transaction`, `status`, `city`, `neighborhood`, `agent_id`, `price_min`, `price_max`, `archived` |
| POST | `/properties/{id}/status` | Changer le statut (`status`, `reason`) ; `disponible` exige la vérification foncière complète |
| GET, PUT | `/properties/{id}/checks[/{check}]` | Vérification foncière (`status` : `a_faire`, `ok`, `ko`, `sans_objet` ; `note` obligatoire pour `ko` et `sans_objet`) |
| POST, DELETE | `/properties/{id}/photos[/{photo}]` | Photos (`photos[]`, converties en WebP, 20 max) |
| PUT | `/properties/{id}/photos/order`, `/photos/{photo}/cover` | Ordre (`ids`) et photo principale |
| GET, POST, DELETE | `/properties/{id}/documents[/{doc}]` | Pièces privées ; `GET …/{doc}` télécharge et journalise |
| GET, POST, PUT | `/properties/{id}/mandates[/{mandate}]` | Mandats |
| GET, POST, PUT, DELETE | `/clients` | Clients ; un téléphone déjà connu renvoie **409** avec la fiche existante |
| GET, POST, DELETE | `/clients/{id}/documents[/{doc}]` | CNI, passeport… (dirigeant et agent assigné) |
| POST, PUT, DELETE | `/clients/{id}/search-criteria[/{criterion}]` | Critères de recherche |
| GET | `/clients/{id}/matches` | Biens publiés correspondant aux critères |
| GET, POST | `/clients/{id}/interactions` | Journal des échanges |
| GET, POST, PUT | `/visits` | Planning (semaine en cours par défaut, `from`, `to`, `mine`) ; compte-rendu par `PUT` |
| GET, POST, PUT, DELETE | `/tasks` | Tâches (`mine` par défaut, `all=1` pour le dirigeant, `due=today|overdue|week`, `done`) |

### Site vitrine (public)

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/public/properties` | Catalogue : `type`, `transaction`, `city`, `neighborhood`, `priceMin`, `priceMax`, `surfaceMin`, `search`, `featured`, `sort`, `per_page` |
| GET | `/public/properties/{slug}` | Fiche, photos, lien WhatsApp vers l'agence |
| GET | `/public/places` | Villes et quartiers présents dans le catalogue |
| POST | `/public/leads` | Demande d'un visiteur (`name`, `phone`, `message`, `email`, `property` = slug) ; 5 par minute |

## Règles métier

- **Rôles** : `dirigeant`, `agent`, `responsable_travaux`, `comptable`, `commercial`, cumulables sur un même compte.
- **Téléphone** : toute saisie (« 77 123 45 67 », « 00221… ») est stockée au format `+221XXXXXXXXX` ; un même numéro ne peut appartenir qu'à un compte.
- **Comptes** : jamais supprimés, seulement désactivés (l'historique reste). Un compte désactivé perd l'accès immédiatement. Le dirigeant connecté ne peut ni se désactiver ni retirer son propre rôle de dirigeant.
- **Connexion** : bloquée 60 s après 5 échecs pour un même identifiant.
- **Journal d'activité** : créations, modifications (valeurs avant/après) et suppressions sont tracées automatiquement, ainsi que les connexions. Les mots de passe ne sont jamais copiés. Conservation : 365 jours (`ACTIVITY_RETENTION_DAYS`), purge chaque nuit.
- **Publication d'un bien** : uniquement si chaque point de la vérification foncière est « vérifié » ou « sans objet » (avec note) ; l'état des droits réels doit dater de moins de 90 jours (`LAND_CHECK_MAX_AGE_DAYS`).
- **Rapprochement** : à la première publication, une tâche est créée pour l'agent de chaque prospect dont les critères correspondent (budget ±10 %).
- **Mandats** : chaque matin à 7 h, alerte J-7 (une seule fois) et clôture des mandats échus (`borom:check-mandates`).
