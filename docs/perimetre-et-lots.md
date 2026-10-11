# Périmètre et lots

Le système est livré en 6 lots, environ 20 semaines avec 2 développeurs, pour **1 270 h** (1 460 h avec 15 % de marge). Chaque lot est mis en service à sa fin. L'ordre suit l'ordre dans lequel l'argent entre et réutilise ce que le lot précédent a construit.

| Lot | Contenu | Semaines | Heures | État |
| --- | --- | --- | --- | --- |
| 0. Socle | Comptes, rôles, paramètres, journal | 1-2 | 70 | **Fait** (API) |
| 1. Biens et prospects | Biens, foncier, CRM, visites, mandats, site vitrine | 3-6 | 190 | **Fait**, fusionné |
| 2. Encaissements et location | Facturation de base, encaissements, baux, loyers | 7-10 | 210 | **Fait**, fusionné (valeurs par défaut à valider) |
| 3. Travaux | Devis, chantiers, tâcherons, caisse, suivi client | 11-15 | 270 | À faire |
| 4. Stock et négoce | Articles, mouvements, CMUP, comptoir | 16-17 | 130 | À faire |
| 5. Pilotage | Tableau de bord, exports comptables | 18 | 80 | À faire |
| Recette finale | Corrections, mise en production | 19-20 | — | — |

Hors développement (déjà compris dans les 1 270 h) : maquettes 50 h, gestion de projet et démos 90 h, recette 110 h, reprise des données 30 h, formation 40 h.

## Décisions de périmètre par rapport au cahier des charges v2.0

Les numéros renvoient au document v2.0 du client (résumé dans [`sources.md`](sources.md)).

**Ajouté** : gestion locative (baux, loyers, quittances, arriérés, reversements) ; état des lieux avec photos ; vérification foncière ; encaissements espèces et mobile money ; tâcherons, pointage, caisse de chantier ; lien de suivi de chantier ; saisie hors ligne sur le terrain.

**Simplifié** :

| v2.0 | Retenu |
| --- | --- |
| Permissions granulaires par module, action et donnée (6.2) | RBAC : rôles paramétrables par le dirigeant, permissions par action, droits individuels (D-034 ; 5 rôles fixes au départ, D-005) |
| Valorisation FIFO (4.16) | CMUP (la v2.0 mélangeait FIFO et moyenne pondérée) |
| ElasticSearch, PostGIS (1.5, 1.6, 6.9, 6.10) | Recherche SQL ; latitude/longitude simples ; carte Leaflet + OpenStreetMap |
| Lead scoring automatique (2.5) | Statut choisi par l'agent + date du dernier contact |
| Fusion des doublons (2.17) | Doublon bloqué à la saisie grâce au téléphone |
| Relances automatiques par email (2.11, 5.13) | Rappels WhatsApp/SMS et liste des tâches du jour |
| FullCalendar + synchro Google (2.10, 3.12) | Planning de la semaine, sans glisser-déposer ni synchro |
| Devis par glisser-déposer (3.5) | Devis par lots tirés du catalogue, avec modèles |
| Plusieurs tableaux de bord CA (5.17, 5.18, 6.5) | Un tableau de bord dirigeant, au lot 5 |
| Pointage bancaire par import CSV (5.16) | Journal de caisse et rapprochement mobile money manuel |

**Reporté en phase 2** : prévisionnel de trésorerie (5.20), objectifs de CA (5.27), commandes fournisseurs (4.18), multi-dépôts (4.9), tutoriels vidéo (6.22) et aide contextuelle (6.20), API WhatsApp Business, paiement en ligne Wave/Orange Money, accusés de lecture des emails (3.8, 5.9), espace client complet, signature numérique, application native.

---

## Lot 0 — Socle (fait)

Livré sur la branche `lot-0-socle`. Détail de l'API dans [`backend/README.md`](../backend/README.md).

- Connexion par jeton Sanctum, par email **ou** téléphone ; 5 échecs → blocage 60 s ; jeton valable 30 jours.
- Rôles cumulables ; depuis D-034, RBAC complet (rôles paramétrables, permissions par module, droits individuels), voir `architecture.md`.
- Comptes désactivés, jamais supprimés ; un compte désactivé perd l'accès immédiatement (middleware `active`) ; le dirigeant connecté ne peut ni se désactiver ni retirer son rôle de dirigeant.
- Paramètres de l'entreprise (une ligne : NINEA, RCCM, TVA 18 %, XOF, WhatsApp, logo, coordonnées bancaires) + version publique sans données fiscales ni bancaires.
- Journal d'activité automatique (trait `LogsActivity`) : création, modification avant/après, suppression, connexion, déconnexion ; mots de passe jamais copiés ; purge après 365 jours.
- Commande `borom:create-director` pour créer le premier compte en production.

**Écrans** de connexion, de gestion des comptes, des rôles et des paramètres : faits dans le back-office. **Déploiement** : environnement Docker de production prêt (D-037) ; reste à choisir le serveur et le nom de domaine.

---

## Lot 1 — Biens et prospects (API faite)

Objectif : publier un bien vérifié sur le site et suivre chaque prospect jusqu'à la visite.

**État** : API livrée sur la branche `lot-1-biens-prospects` (86 tests). Écarts avec la spécification ci-dessous, décidés pendant l'implémentation : client avec un seul champ `name` (D-021) ; critères de recherche sans équipements ; site vitrine montrant aussi les biens `en_negociation` (D-020) ; `GET /api/public/places` (villes et quartiers) au lieu de `/neighborhoods` ; photos de démonstration en URL externes. Reste : les écrans (front).

### Modèle de données proposé

| Table | Champs principaux | Remarques |
| --- | --- | --- |
| `properties` | `reference` (BD-2026-0001), `slug`, `title`, `type`, `transaction`, `status`, `price` (XOF entier), `deposit_months`, `advance_months`, `charges`, `surface`, `land_surface`, `rooms`, `bedrooms`, `bathrooms`, `features` (json), `city`, `neighborhood`, `address`, `latitude`, `longitude`, `description`, `land_status`, `land_reference`, `owner_id` → clients, `agent_id` → users, `is_featured`, `published_at`, `verified_at`, `verified_by` | `SoftDeletes` = archivage |
| `property_photos` | `property_id`, `path`, `position`, `is_cover` | 20 max par bien ; conversion WebP côté serveur |
| `property_documents` | `property_id`, `type`, `path`, `original_name`, `uploaded_by` | PDF/images, 10 Mo max ; accès restreint |
| `property_checks` | `property_id`, `item`, `status` (`ok`, `ko`, `sans_objet`, `a_faire`), `note`, `document_id`, `checked_by`, `checked_at` | Vérification foncière |
| `property_status_changes` | `property_id`, `from`, `to`, `reason`, `user_id` | Historique des statuts |
| `mandates` | `property_id`, `owner_id`, `type` (`exclusif`, `simple`, `recherche`), `starts_on`, `ends_on`, `commission_type` (`pourcentage`, `montant`), `commission_value`, `status` | Alerte J-7 avant expiration |
| `clients` | `kind` (`particulier`, `entreprise`), `first_name`, `last_name`, `company_name`, `phone` (unique), `whatsapp`, `email`, `categories` (json : `acheteur`, `locataire`, `proprietaire`, `fournisseur`, `sous_traitant`), `city`, `address`, `source` (`site`, `whatsapp`, `appel`, `recommandation`, `agence`, `autre`), `pipeline_status` (`nouveau`, `contacte`, `visite`, `negociation`, `gagne`, `perdu`), `solvency` (A/B/C), `tags` (json), `assigned_user_id`, `last_contact_at`, `private_notes` | `SoftDeletes` ; un client sert aussi au lot 2 (locataires, propriétaires) et au lot 3 |
| `client_documents` | `client_id`, `type` (`cni`, `passeport`, `justificatif`, `autre`), `path` | Pièces d'identité : dirigeant + agent assigné seulement, consultation journalisée |
| `search_criteria` | `client_id`, `transaction`, `types` (json), `budget_min`, `budget_max`, `cities` (json), `neighborhoods` (json), `rooms_min`, `features` (json), `is_active` | Sert au rapprochement |
| `interactions` | `client_id`, `user_id`, `channel` (`appel`, `whatsapp`, `sms`, `email`, `visite`, `rencontre`), `summary`, `property_id`, `occurred_at` | Met à jour `clients.last_contact_at` |
| `visits` | `property_id`, `client_id`, `agent_id`, `scheduled_at`, `status` (`planifiee`, `effectuee`, `annulee`, `absent`), `feedback` (`interesse`, `pas_interesse`, `a_revoir`), `notes`, `next_action` | |
| `tasks` | `user_id`, `client_id`, `property_id`, `title`, `due_at`, `priority`, `done_at` | Rappels et « tâches du jour » |

Valeurs de `type` de bien : `terrain`, `maison`, `appartement`, `villa`, `local`, `immeuble`. Valeurs de `land_status` : `titre_foncier`, `bail`, `deliberation`, `acte_administratif`, `autre`, `inconnu`. Statuts de bien : `brouillon`, `disponible`, `en_negociation`, `sous_promesse`, `vendu`, `loue`, `retire`.

### Règles métier

1. **Vérification foncière avant publication.** Un bien ne peut passer à `disponible` (donc être visible sur le site) que si tous les points obligatoires de sa liste de vérification sont `ok` ou `sans_objet`. Liste par défaut, **à valider avec le dirigeant** : état des droits réels obtenu et daté de moins de 3 mois (titre foncier), identité du vendeur ou du propriétaire vérifiée, pièce justifiant le droit (TF, bail, délibération), plan ou bornage, absence de litige connu, mandat signé.
2. **Statuts** : transitions autorisées `brouillon → disponible → en_negociation → sous_promesse → vendu|loue`, retour possible vers `disponible`, `retire` depuis tout statut. Chaque transition est historisée avec motif.
3. **Archivage** au lieu de suppression (agents et dirigeant).
4. **Client unique par téléphone.** À la création, un téléphone déjà connu renvoie le client existant au lieu d'un doublon.
5. **Demande depuis le site** (`POST /api/public/leads` : nom, téléphone, message, bien concerné) : crée ou retrouve le client par téléphone, enregistre une interaction `source = site`, l'assigne à l'agent du bien, crée une tâche « rappeler sous 24 h ». Protection anti-spam : champ piège (honeypot) + limitation de débit.
6. **Rapprochement** : à la publication d'un bien, chercher les critères actifs compatibles (transaction, type, budget ±10 %, ville/quartier, pièces) et créer une tâche pour l'agent assigné à chaque prospect concerné. Aucun message automatique au client en phase 1 : l'agent envoie le lien WhatsApp.
7. **Mandats** : tâche planifiée quotidienne qui signale les mandats expirant dans 7 jours et passe à `expire` ceux qui sont échus.
8. **Droits** (d'après la matrice v2.0) : dirigeant et agent créent et modifient les biens ; responsable travaux, comptable et commercial les consultent ; le commercial gère les prospects, visites et critères ; seul le dirigeant archive un client.

### API publique pour le site vitrine

- `GET /api/public/properties` : biens publiés, filtres identiques au site actuel (`type`, `transaction`, `city`, `neighborhood`, `priceMin`, `priceMax`, `surfaceMin`, `search`), tri, pagination.
- `GET /api/public/properties/{slug}` : fiche, photos, sans le propriétaire, l'adresse exacte ni les documents.
- `GET /api/public/neighborhoods` : quartiers tirés des biens publiés. Corrige un bug du site actuel, dont les filtres listaient « Sacré-Cœur » alors que les biens sont à « Sacré-Cœur 3 », ce qui renvoyait zéro résultat.

### Écrans (front)

Reprendre le code du dépôt `borom-daradji-properties` (Vite, React, TypeScript, Tailwind, shadcn/ui, charte bleu marine et or) dans `frontend/`. Brancher le site sur l'API publique ; corriger `index.html` (`lang="fr"`, titre et images de partage Lovable) ; créer le back-office (connexion, biens, clients, visites, tâches du jour).

### Critères d'acceptation

- Un agent crée un bien, ajoute photos et documents, complète la vérification et le publie ; il apparaît sur le site avec ses photos.
- Un bien dont la vérification est incomplète est refusé à la publication avec la liste des points manquants.
- Une demande envoyée depuis le site apparaît chez l'agent du bien, avec une tâche de rappel.
- Saisir un téléphone déjà connu ne crée pas de doublon.
- Publier un bien crée une tâche pour chaque prospect dont les critères correspondent.

---

## Lot 2 — Encaissements et location

**Fait** (branche `lot-2-encaissements-location`) : factures et avoirs, encaissements, reçus, caisse journalière, PDF, écrans Factures et Caisse ; baux, appels de loyer automatiques, arriérés et relances, quittances, relevés de gérance et reversements ; états des lieux d'entrée et de sortie avec photos ; restitution de la caution.

États des lieux (D-040, **à valider**) :
- Un état des lieux d'entrée et un de sortie au plus par bail (`leases.manage` pour les faire, `leases.view` pour les consulter). L'entrée propose les pièces de `config/borom.php` (`inspection_template`), une chambre et une salle de bain par chambre et salle de bain du bien ; la sortie reprend les lignes de l'entrée. Lignes, pièces et éléments modifiables.
- Chaque élément : état parmi neuf, bon, usure normale, dégradé, hors service ou manquant ; commentaire ; photos. Relevés des compteurs d'électricité et d'eau, nombre de clés, présence du locataire, observations.
- Dégradation = à la sortie, pire qu'à l'entrée **et** au-delà de l'usure normale (l'usure due à l'usage normal ne se retient pas). Les dégradations sont proposées comme retenues à la restitution de la caution.
- Validation : chaque élément doit avoir un état ; ensuite plus aucune modification ni photo (pièce opposable). PDF à signer par l'agence et le locataire (les photos restent dans le logiciel, comptées sur le PDF).
- Photos converties en WebP sur le disque privé, servies par une route contrôlée ; 150 par état des lieux (`INSPECTION_MAX_PHOTOS`).

Restitution de la caution (D-041, **à valider**) :
- Après la résiliation, une seule fois par bail, avec la permission `deposits.settle` (comptable par défaut). Numéro `CAU-AAAA-0001`.
- Caution encaissée proposée : avec facture d'entrée, ses encaissements couvrent d'abord la caution ; sans facture d'entrée (bail saisi après coup), la caution du bail est réputée reçue. Montant modifiable.
- Ordre d'imputation : 1. loyers impayés, du plus ancien au plus récent (option désactivable), par des encaissements « retenue sur caution » sur les appels de loyer (le mois est payé, quittance possible, et pour un bail géré le loyer revient au propriétaire) ; 2. réparations et autres retenues saisies (libellé, montant) ; 3. le reste est rendu au locataire.
- Remboursement : mode et référence comme un encaissement ; en espèces, sortie de la caisse du jour de la personne qui rend (mouvement « restitution de caution »), refusé si la caisse n'a pas assez d'espèces.
- Retenues supérieures à la caution : le reste dû est facturé au locataire (brouillon pour le comptable).
- Décompte PDF remis au locataire.
- Annulation avec motif (D-043) : les loyers retenus redeviennent impayés, les espèces rendues reviennent dans la caisse par un mouvement inverse, la facture de reste dû en brouillon est supprimée ; une nouvelle restitution est alors possible (nouveau numéro). Refusée si la caisse est clôturée, si la facture de reste dû est émise (avoir d'abord) ou si un loyer retenu a déjà été reversé au propriétaire.

Relances et fin de bail (D-042, **à valider**) :
- Chaque matin (`borom:remind-overdue`, 07:10), toute facture émise impayée (loyers compris) qui atteint un palier de retard (J+3, J+15, J+30 par défaut, `REMINDER_DAYS`) donne une tâche « Relancer … » : une par client et par personne, au palier le plus haut atteint, jamais deux fois pour le même palier. Elle va à l'agent du bail, sinon à celui du bien, sinon à la personne qui suit le client, sinon à un comptable. Rien n'est envoyé au client : la personne relance par téléphone ou WhatsApp.
- Fin de bail prévue dans 60 jours (`LEASE_END_ALERT_DAYS`, `borom:check-lease-ends`, 07:05) : une tâche, une seule fois, pour l'agent (préavis, état des lieux de sortie, caution).
- Résiliation : option « Remettre le bien en location » (cochée par défaut) : le bien loué redevient disponible et réapparaît sur le site ; refusée avec le motif si la vérification foncière n'est plus à jour.
- « Cautions à restituer » : baux résiliés dont la caution n'est pas restituée, en filtre de la liste des baux et en encart de l'accueil (permission `deposits.settle`).

### Critères d'acceptation du lot 2

Chacun est couvert par un test de fonctionnalité (`tests/Feature/Billing`, `tests/Feature/Rental`).

- Une facture émise reçoit un numéro continu, ne se modifie plus et se corrige par un avoir plafonné.
- Un encaissement Wave ou Orange Money sans référence, ou avec une référence déjà saisie, est refusé ; les espèces alimentent la caisse du jour, qui se clôture avec un écart expliqué.
- Un bail créé depuis un bien à louer émet les appels de loyer des mois payés d'avance et des mois déjà échus, puis un appel chaque mois, sans doublon, jusqu'à la fin du bail.
- Un loyer entièrement payé donne une quittance ; un loyer impayé apparaît en arriéré et déclenche des relances à J+3, J+15 et J+30.
- Le relevé d'un propriétaire liste les loyers encaissés sur ses baux gérés, moins la commission et sa TVA ; un loyer reversé ne l'est jamais deux fois.
- Un état des lieux de sortie reprend les lignes de l'entrée et signale les dégradations ; validé, il ne se modifie plus.
- La restitution de la caution solde les loyers impayés, retient les réparations, rend le reste (sortie de caisse en espèces) ou facture le reste dû ; elle s'annule avec un motif.
- Chaque action est réservée aux permissions prévues (factures, encaissements, caisse, baux, reversements, cautions).

Règles de la gestion locative (valeurs par défaut dans `config/borom.php`, modifiables bail par bail, **à valider** avec le client) :
- Un seul bail en cours par bien ; le bien passe en « Loué » quand c'est permis par son statut. Seuls les biens « à louer » se louent. Un bail en gestion exige un propriétaire.
- Un appel de loyer par mois = une facture (activité « location », loyer + charges, TVA du bail : 0 % par défaut), échéance le jour choisi (5 par défaut), émise automatiquement chaque matin (`borom:generate-rent-calls`, 06:00), sans doublon. Les mois payés d'avance et les mois déjà échus (bail saisi après coup) sont appelés à la signature. Plus d'appel après la fin prévue ou la résiliation.
- Facture d'entrée en brouillon : caution (TVA 0) et frais d'agence (TVA de l'entreprise).
- Arriérés = reste à payer des appels dont l'échéance est passée ; relance WhatsApp listant les mois dus. Quittance PDF seulement quand le mois est entièrement payé.
- Reversement : loyers encaissés sur les baux gérés, pas encore reversés, jusqu'à la fin du mois choisi ; commission du bail (10 % par défaut) calculée sur le montant encaissé, TVA sur la commission (18 % par défaut), frais déduits saisis à la main ; un loyer reversé ne compte plus ; annuler un reversement remet ses loyers à reverser. Numéros `BAIL-AAAA-0001`, `REV-AAAA-0001`.

Règles en place :
- Brouillon modifiable et supprimable, sans numéro. À l'émission : numéro `FAC-AAAA-00001` (avoir `AV-AAAA-00001`) attribué dans la même transaction que le changement de statut, date d'émission, échéance (15 jours par défaut, `INVOICE_DUE_DAYS`). Une facture émise ne se modifie ni ne se supprime.
- Totaux toujours recalculés côté serveur ; montant HT et TVA arrondis au franc **par ligne** ; TVA choisie par ligne (taux de l'entreprise par défaut).
- Avoir préparé depuis une facture émise (reprend ses lignes, à ajuster), même client, plafonné à ce qui reste à créditer. Facture entièrement créditée et non payée = « annulée par avoir ».
- Reste à payer = total − avoirs − encaissements valides. Encaissement refusé s'il dépasse le reste, si la facture est un brouillon, si la date est future ; référence obligatoire hors espèces, refusée si déjà enregistrée pour le même mode (double saisie). Reçu `REC-AAAA-00001`, justificatif sur le disque privé, consultation journalisée.
- Espèces rattachées à la caisse du jour de la personne qui encaisse (créée d'office). Mouvements : apport, dépôt en banque, dépense, remise au dirigeant ; une sortie ne peut pas dépasser les espèces présentes. Clôture : montant compté, écart avec le théorique, explication obligatoire si écart. Caisse clôturée : plus d'espèces, plus d'annulation de ses encaissements.
- Encaissement jamais supprimé : annulation avec motif (comptable ou dirigeant).
- Droits (RBAC, D-034) : permissions `invoices.view|manage|issue|credit`, `payments.create|cancel|view_all`, `cash.view_all`. Par défaut, le comptable prépare, émet, fait les avoirs et annule ; agents et commerciaux consultent et encaissent ; chacun voit sa caisse ; le dirigeant ajuste dans « Rôles et droits ».

- **Socle de facturation** réutilisé par les lots 3 et 4 : factures (lignes, HT, TVA, TTC), avoirs, numérotation `FAC-AAAA-00001` **continue et sans trou** (compteur verrouillé en transaction, jamais de suppression d'une facture émise), PDF depuis un modèle HTML, reçus.
- **Encaissements** : modes `especes`, `wave`, `orange_money`, `free_money`, `cheque`, `virement` ; référence de transaction ; capture d'écran ; paiement partiel ; reste dû recalculé ; caisse journalière par utilisateur avec clôture.
- **Baux** : bien, locataire, propriétaire, loyer, charges, caution et avance en mois, jour d'échéance, durée, commission de gestion (% du loyer), statut.
- **Appels de loyer** générés automatiquement chaque mois (tâche planifiée) ; quittance PDF à l'encaissement complet ; arriérés par locataire ; rappels par lien WhatsApp ou SMS.
- **État des lieux** d'entrée et de sortie : pièces, état, photos ; sert à restituer ou retenir la caution (fait, voir plus haut).
- **Reversements** : relevé mensuel par propriétaire (loyers encaissés − commission − frais) et enregistrement du versement.
- Questions bloquantes avant de commencer : voir « Questions ouvertes » dans [`journal.md`](journal.md).

## Lot 3 — Travaux

**Fait** (branche `lot-3-travaux`) : catalogue et devis, chantiers (lots, avancement, journal, photos), facturation des travaux, tâcherons et pointage, caisse de chantier, budget et alerte de dépassement, lien de suivi du client, appli terrain hors ligne. Valeurs par défaut dans `config/borom.php`, **à valider** avec le client.

Catalogue et devis (D-044) :
- Corps de métier (15 créés à l'installation : les 14 de la v2.0 et la peinture) et prestations (désignation, unité, prix HT, TVA), modifiables et désactivables (`works.catalog`). Les prix de la démo sont indicatifs.
- Devis = lots (un par corps de métier ou par étape) de lignes tirées du catalogue ou saisies ; remise globale en %, appliquée ligne par ligne ; TVA par ligne ; montants arrondis au franc par ligne. Numéro `DEV-AAAA-0001` à la création (un devis n'est pas une pièce comptable).
- Suivi `brouillon → envoye → accepte | refuse | expire`. À l'envoi : date et validité (30 jours, `QUOTE_VALIDITY_DAYS`) ; chaque nuit (`borom:expire-quotes`, 00:15) les devis échus passent en « expiré ». Un devis envoyé ne se modifie plus : on le reprend en brouillon ou on le duplique. Refus avec motif. Un devis expiré se renvoie avant d'être accepté.
- Modèles réutilisables (devis sans client ni numéro) ; dupliquer un devis ou un modèle. PDF avec conditions (modifiables) et acompte demandé (30 % par défaut, `QUOTE_DEPOSIT_RATE`).

Chantiers (D-045) :
- Créés à l'acceptation d'un devis (lots et montants repris), ou à la main au stade « devis » ; un devis accepté peut compléter un chantier ouvert du même client (avenant). Le client reçoit la catégorie « client travaux ». Référence `CH-AAAA-0001`.
- Statuts `devis → planifie → en_cours ⇄ suspendu → termine → facture` (un chantier terminé peut reprendre). Avancement en % par lot ; avancement global pondéré par le montant des lots.
- Journal : changements de statut et d'avancement inscrits d'office et visibles du client ; notes visibles ou internes. Photos datées et géolocalisées par le téléphone, rattachables à un lot, visibles du client ou non, sur le disque privé.

Facturation des travaux (D-046) :
- Acompte : % du marché HT, avant la première situation, sans dépasser le marché.
- Situation : travaux réalisés depuis la précédente (avancement × montant de chaque lot, cumulé, moins ce qui est déjà facturé), acompte déduit au prorata ; un avancement inférieur à ce qui est déjà facturé est refusé.
- Solde : quand le chantier est terminé ; tout le marché est alors facturé au franc près et le chantier passe en « facturé ».
- Factures ordinaires du lot 2 (activité « travaux », brouillon à vérifier puis émis, encaissements, relances), TVA ventilée selon les taux des lignes du devis. Une seule facture du chantier en brouillon à la fois ; une facture annulée par avoir ne compte plus.

Tâcherons, caisse de chantier, budget (D-047, D-048) :
- Tâcherons : artisans et ouvriers sans compte, payés à la journée (tarif journalier) ou à la tâche ; téléphone unique ; désactivés plutôt que supprimés (`works.team`).
- Pointage du jour (journée ou demi-journée) au tarif du jour figé dans la ligne ; pas de journée à venir ; chantier ouvert seulement ; un tâcheron pointé deux fois le même jour sur le même chantier voit sa ligne mise à jour.
- Travaux à la tâche (prix convenu) : dus une fois marqués terminés ; une tâche terminée ne s'annule plus.
- Avances et paiements (`works.payments`) : dû = journées + tâches terminées ; solde = dû − versé, tous chantiers confondus ; un paiement ne dépasse pas le reste dû (au-delà, c'est une avance) ; référence obligatoire hors espèces ; payé ou non avec la caisse du chantier ; jamais supprimé, annulé avec motif.
- Caisse du chantier, tenue par le chef de chantier : approvisionnement par l'agence (`works.payments`), pris dans la caisse du jour (sortie automatique « avance à un chef de chantier ») ou versé autrement ; dépenses sur place par catégorie avec photo du reçu (`works.cash`), reçu ajoutable après coup, dépenses sans reçu signalées ; paiements de tâcherons ; reliquat rendu (éventuellement remis dans la caisse du jour). Solde négatif admis : le chef a avancé de sa poche. Annulation avec motif ; les espèces de la caisse du jour font le chemin inverse tant qu'elle n'est pas clôturée.
- Budget prévu (matériaux, main-d'œuvre, autres) et coût réel (`works.costs`) : main-d'œuvre des tâcherons (dû, payé ou non) + dépenses de la caisse par poste ; marge = marché HT − coût réel. Au-delà de +10 % (`BUDGET_ALERT_TOLERANCE`), une tâche « budget dépassé » au chef de chantier, une seule fois tant que le budget ne change pas. Les sorties de stock vers le chantier s'ajouteront avec le lot 4.

Lien de suivi du client (D-049) :
- Adresse `/suivi/{jeton}` (jeton aléatoire de 48 caractères) créée, renouvelée ou révoquée depuis la fiche du chantier (`works.manage`) et envoyée par WhatsApp ; l'ancien lien cesse de fonctionner.
- Lecture seule, sans compte, non indexé : avancement global et par lot, photos et journal marqués visibles du client, factures émises avec leur PDF, payé et reste à régler. Rien d'interne (budget, coûts, tâcherons, caisse, notes internes, brouillons).

Appli terrain hors ligne (D-050) :
- Écran « Terrain » (`/admin/terrain`, installable sur le téléphone) : photo (réduite à 1 920 px, géolocalisée), pointage du jour, dépense avec reçu, pour le chantier choisi.
- Chaque saisie est gardée sur le téléphone (IndexedDB) avec un identifiant unique, puis envoyée dans l'ordre dès que le réseau revient (et chaque minute) ; le serveur ignore une saisie déjà reçue. Une saisie refusée (droit, chantier fermé…) reste affichée avec le motif jusqu'à ce qu'on l'abandonne.
- L'application s'ouvre sans réseau (service worker) avec les dernières données lues (chantiers, tâcherons, lots) ; le profil reste connecté hors ligne ; sur un téléphone partagé, seules les saisies de la personne connectée partent avec sa session.

### Critères d'acceptation du lot 3

Chacun est couvert par un test de fonctionnalité (`tests/Feature/Works`), sauf le hors-ligne, vérifié dans Chromium (coupure réseau simulée).

- Un devis calcule remise, TVA et totaux au franc près, s'envoie, expire après sa validité, se refuse avec un motif ; accepté, il crée le chantier avec ses lots.
- L'avancement d'un lot met à jour l'avancement global et s'inscrit au journal visible du client.
- Acompte, situations et solde additionnés égalent le marché HT au franc près ; l'acompte est déduit au prorata ; une seule facture en brouillon à la fois.
- Le pointage applique le tarif du jour du tâcheron et n'est pas compté deux fois par une synchronisation relancée ; une tâche n'est due qu'une fois terminée ; un paiement ne dépasse pas le reste dû.
- La caisse du chantier suit approvisionnements, dépenses, paiements et retours ; un approvisionnement pris dans la caisse du jour en sort, et y revient s'il est annulé.
- Un dépassement du budget au-delà de 10 % crée une seule alerte, de nouveau possible après une modification du budget.
- Le lien de suivi montre avancement, photos et journal publics et paiements, rien d'interne ; renouvelé ou révoqué, l'ancien lien ne fonctionne plus.
- Photos, pointage et dépenses saisis sans réseau sont envoyés au retour du réseau, sans doublon.
- Chaque action est réservée aux permissions prévues (`works.*`, factures).

## Lot 4 — Stock et négoce

- Articles (référence, catégorie, unité, prix d'achat et de vente, seuils min/max, emplacement), fournisseurs.
- Mouvements : entrée fournisseur, sortie vers un chantier (coût imputé au chantier), vente au comptoir (facture du lot 2), perte/casse (motif obligatoire), ajustement d'inventaire.
- **Valorisation CMUP** recalculée à chaque entrée ; historique des prix.
- Alertes de seuil, inventaire physique avec écarts.

## Lot 5 — Pilotage

- Tableau de bord dirigeant : CA par activité (immobilier, travaux, négoce), encaissements, impayés, loyers en retard, chantiers en retard ou hors budget, stock sous le seuil.
- Exports Excel : journal des ventes, des encaissements, des achats, balances clients et fournisseurs, avec numéros de compte SYSCOHADA paramétrables ; format à caler sur le logiciel du cabinet comptable.
- Recherche globale (clients, biens, chantiers, factures, articles).
