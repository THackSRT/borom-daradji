# Périmètre et lots

Le système est livré en 6 lots, environ 20 semaines avec 2 développeurs, pour **1 270 h** (1 460 h avec 15 % de marge). Chaque lot est mis en service à sa fin. L'ordre suit l'ordre dans lequel l'argent entre et réutilise ce que le lot précédent a construit.

| Lot | Contenu | Semaines | Heures | État |
| --- | --- | --- | --- | --- |
| 0. Socle | Comptes, rôles, paramètres, journal | 1-2 | 70 | **Fait** (API) |
| 1. Biens et prospects | Biens, foncier, CRM, visites, mandats, site vitrine | 3-6 | 190 | **Fait** (API, back-office, site), à fusionner |
| 2. Encaissements et location | Facturation de base, encaissements, baux, loyers | 7-10 | 210 | **En cours** : facturation, encaissements, caisse, baux, loyers, quittances et reversements faits (valeurs par défaut à valider) ; reste les états des lieux |
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

**Fait** (branche `lot-2-encaissements-location`) : factures et avoirs, encaissements, reçus, caisse journalière, PDF, écrans Factures et Caisse ; baux, appels de loyer automatiques, arriérés et relances, quittances, relevés de gérance et reversements. **Reste** : états des lieux (entrée et sortie, photos) et restitution de la caution.

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
- **État des lieux** d'entrée et de sortie : pièces, état, photos ; sert à restituer ou retenir la caution.
- **Reversements** : relevé mensuel par propriétaire (loyers encaissés − commission − frais) et enregistrement du versement.
- Questions bloquantes avant de commencer : voir « Questions ouvertes » dans [`journal.md`](journal.md).

## Lot 3 — Travaux

- Catalogue de prestations par corps de métier (désignation, unité, prix unitaire) ; **14 corps listés dans la v2.0** (le document en annonce 15) plus la peinture, proposée sur le site actuel.
- Devis par lots tirés du catalogue, remise, modèles réutilisables, PDF, suivi `brouillon → envoye → accepte|refuse|expire` (validité 30 jours).
- Chantiers : statuts `devis → planifie → en_cours → suspendu → termine → facture`, lots avec % d'avancement, journal, photos géolocalisées et datées.
- Factures d'acompte, de situation (cumul des situations précédentes) et de solde à partir du devis.
- Équipes et **tâcherons** : pointage journalier, paiements à la tâche ou à la journée, avances.
- **Caisse de chantier** : avances au chef de chantier, dépenses avec photo du reçu.
- Budget prévu et réel (matériaux + main-d'œuvre + caisse), alerte au-delà de 10 % de dépassement.
- **Lien de suivi client** : URL signée et révocable, en lecture seule (avancement, photos, paiements d'un chantier).
- **Appli terrain hors ligne** : photos, pointage et dépenses stockés sur le téléphone puis synchronisés.

## Lot 4 — Stock et négoce

- Articles (référence, catégorie, unité, prix d'achat et de vente, seuils min/max, emplacement), fournisseurs.
- Mouvements : entrée fournisseur, sortie vers un chantier (coût imputé au chantier), vente au comptoir (facture du lot 2), perte/casse (motif obligatoire), ajustement d'inventaire.
- **Valorisation CMUP** recalculée à chaque entrée ; historique des prix.
- Alertes de seuil, inventaire physique avec écarts.

## Lot 5 — Pilotage

- Tableau de bord dirigeant : CA par activité (immobilier, travaux, négoce), encaissements, impayés, loyers en retard, chantiers en retard ou hors budget, stock sous le seuil.
- Exports Excel : journal des ventes, des encaissements, des achats, balances clients et fournisseurs, avec numéros de compte SYSCOHADA paramétrables ; format à caler sur le logiciel du cabinet comptable.
- Recherche globale (clients, biens, chantiers, factures, articles).
