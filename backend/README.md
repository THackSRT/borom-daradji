# Backend — API Laravel

Voir le [README principal](../README.md) pour l'installation.

## API du lot 0

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

## Règles métier du socle

- **Rôles** : `dirigeant`, `agent`, `responsable_travaux`, `comptable`, `commercial`, cumulables sur un même compte.
- **Téléphone** : toute saisie (« 77 123 45 67 », « 00221… ») est stockée au format `+221XXXXXXXXX` ; un même numéro ne peut appartenir qu'à un compte.
- **Comptes** : jamais supprimés, seulement désactivés (l'historique reste). Un compte désactivé perd l'accès immédiatement. Le dirigeant connecté ne peut ni se désactiver ni retirer son propre rôle de dirigeant.
- **Connexion** : bloquée 60 s après 5 échecs pour un même identifiant.
- **Journal d'activité** : créations, modifications (valeurs avant/après) et suppressions sont tracées automatiquement, ainsi que les connexions. Les mots de passe ne sont jamais copiés. Conservation : 365 jours (`ACTIVITY_RETENTION_DAYS`), purge chaque nuit.
