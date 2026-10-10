# Journal des décisions

Chaque décision structurante, avec sa raison. Ajouter les nouvelles à la fin, avec la date. Pour revenir sur une décision, en écrire une nouvelle qui la remplace, plutôt que d'effacer l'ancienne.

| N° | Date | Décision | Raison | Statut |
| --- | --- | --- | --- | --- |
| D-001 | 2026-10-10 | Livrer en 6 lots mis en service un par un, dans l'ordre : socle, biens et prospects, encaissements et location, travaux, stock, pilotage | L'agence utilise le logiciel dès la semaine 6 ; chaque lot réutilise le précédent ; le tableau de bord vient quand les données existent | Validée |
| D-002 | 2026-10-10 | Laravel (PHP) pour le serveur, React pour les écrans | Fournit d'office ce que le projet demande (tâches planifiées, files d'envoi, autorisations, liens signés, stockage S3, migrations) ; prestataires PHP nombreux localement, donc maintenance facile à confier ; hébergement peu cher. Comparé à Spring Boot (+10 à 20 % d'heures estimées, plus lourd en mémoire, pas de gain pour une application de gestion) et à AdonisJS (bonne option si l'équipe était TypeScript). Le critère décisif reste la compétence de l'équipe qui maintient. | Validée par l'utilisateur |
| D-003 | 2026-10-10 | Monolithe modulaire, une seule API pour les 4 applications | Équipe de 2, faible charge ; règles écrites une seule fois | Validée |
| D-004 | 2026-10-10 | Laravel 13, PHP 8.3+, Sanctum par jetons Bearer (pas de cookies) | Même mécanisme pour le back-office, la PWA terrain et de futurs clients ; pas de problème de domaine partagé pour les cookies | En place |
| D-005 | 2026-10-10 | 5 rôles fixes cumulables, stockés en JSON dans `users.roles` ; pas de matrice de permissions paramétrable | Petite équipe où une personne cumule les rôles ; la matrice granulaire de la v2.0 coûtait cher pour peu d'usage | En place |
| D-006 | 2026-10-10 | Connexion par email ou téléphone | Sur le terrain, les utilisateurs retiennent mieux leur numéro | En place |
| D-007 | 2026-10-10 | Téléphone normalisé `+221XXXXXXXXX` et unique | Le téléphone identifie le client au Sénégal ; évite les doublons au lieu de les fusionner après coup | En place |
| D-008 | 2026-10-10 | Comptes désactivés, jamais supprimés ; données métier archivées (`SoftDeletes`) | Traçabilité ; l'historique (journal, documents) reste rattaché à son auteur | En place |
| D-009 | 2026-10-10 | Journal d'activité maison (trait `LogsActivity` + `ActivityLogger`), alias de modèles imposés (`enforceMorphMap`), conservation 365 jours | Besoin simple (qui, quoi, avant/après, IP) ; pas de dépendance externe ; les alias évitent de casser l'historique si une classe est renommée | En place |
| D-010 | 2026-10-10 | Montants en francs CFA entiers (`bigInteger`), jamais en `float` | Le XOF n'a pas de centimes ; les flottants faussent les totaux | À appliquer dès le lot 1 |
| D-011 | 2026-10-10 | Valorisation du stock au CMUP, pas en FIFO | Plus simple et adapté à des prix qui varient ; la v2.0 mélangeait les deux méthodes | À confirmer avec le comptable |
| D-012 | 2026-10-10 | WhatsApp par liens `wa.me` pré-remplis en phase 1 ; API WhatsApp Business en phase 2 | Gratuit et immédiat ; l'API est facturée au message et demande un compte Meta vérifié | Validée |
| D-013 | 2026-10-10 | Recherche SQL et coordonnées latitude/longitude ; pas d'ElasticSearch ni de PostGIS | Volumes faibles (quelques centaines de biens) ; moins d'infrastructure | Validée |
| D-014 | 2026-10-10 | Laravel Boost non installé | Proposé par le modèle de projet ; non nécessaire, évite une dépendance de développement | En place |
| D-015 | 2026-10-10 | Une branche par lot et une pull request vers `main` | Revue et CI avant fusion | `main` reste à créer |
