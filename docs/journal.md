# Journal de suivi

**À lire en premier par toute nouvelle session.** Mettre à jour à la fin de chaque session : l'état actuel, puis une entrée datée en haut de l'historique.

## État actuel

- **Lot en cours** : lot 1 (biens et prospects) — API, back-office et site vitrine branché : **fonctionnellement terminé**, reste la fusion dans `main` et le déploiement.
- **Branches** : `main` (= lot 0, API seule) ; `lot-1-biens-prospects` (API du lot 1 + `frontend/` avec le back-office), pas encore fusionnée, pas de pull request.
- **Tests** : 96 tests backend verts ; front : `typecheck`, `lint` (0 erreur, 9 avertissements « fast refresh » sans gravité) et `build` propres ; parcours vérifié dans Chromium (dirigeant, agent, téléphone 390 px sans débordement).
- **CI GitHub** : le workflow existe mais GitHub ne démarre pas les tâches (aucune machine attribuée, aucun journal). Cause côté compte, probablement la facturation ou des Actions désactivées ; à vérifier par l'utilisateur sur la page de l'exécution.
- **Données de démo** : `php artisan migrate:fresh --seed` charge 4 comptes, les 12 biens de l'ancien site (10 publiés), 4 clients, une visite, une tâche.
- **Déploiement** : aucun serveur pour l'instant.

## Prochaines actions, dans l'ordre

1. Faire relire et fusionner `lot-1-biens-prospects` dans `main` (pull request à ouvrir sur demande de l'utilisateur).
2. Choisir l'hébergement et déployer une première version (questions ouvertes).
3. Lot 2 (encaissements et location) : attendre les réponses aux trois premières questions ouvertes.

Manques connus du back-office : pas de « mot de passe oublié » (le dirigeant réinitialise depuis Comptes), pas de carte des biens, pas de changement d'agent assigné depuis la fiche client, pipeline sans glisser-déposer (menu « Déplacer vers »), photos de démo externes non modifiables.

## Questions ouvertes pour le client

Les trois premières bloquent le lot 2. Noter la réponse et la date ici quand elle arrive.

- [ ] L'agence gère-t-elle des biens pour des propriétaires (encaissement et reversement des loyers) ? Combien de baux, quel taux de commission ?
- [ ] Conditions habituelles de location : mois de caution, d'avance, commission d'agence.
- [ ] Les baux sont-ils enregistrés aux impôts, et par qui ?
- [ ] Liste des points de vérification foncière à exiger avant publication (6 points par défaut dans `PropertyCheckItem`) et ancienneté maximale de l'état des droits réels (90 jours par défaut).
- [ ] Un bien « en négociation » doit-il rester visible sur le site (oui par défaut, D-020) ?
- [ ] Volumes : biens en portefeuille, chantiers par an, articles en stock, factures par mois.
- [ ] Le négoce a-t-il un dépôt avec vente au comptoir, ou seulement des livraisons sur chantier ?
- [ ] Avec le comptable : méthode de valorisation du stock (CMUP proposé), TVA par activité, mentions obligatoires sur les factures.
- [ ] Logiciel du cabinet comptable (Sage, Ciel, autre) pour le format des exports.
- [ ] Nombre d'utilisateurs et rôles cumulés.
- [ ] Données existantes à reprendre (Excel, cahiers).
- [ ] Hébergement et nom de domaine : qui paie, qui administre. Choix MySQL ou PostgreSQL.
- [ ] Taux horaire ou budget, date de démarrage.
- [ ] Durée de conservation des sauvegardes (30 jours proposés).
- [ ] Vraies coordonnées de l'agence (téléphone, WhatsApp, email, adresse) à saisir dans Paramètres : le site les affiche partout ; les valeurs de démo sont fictives.
- [ ] Horaires d'ouverture (affichés en dur sur la page Contact : lun-ven 8h30-18h, sam 9h-13h) et liens des réseaux sociaux du pied de page.
- [ ] La mention « Garantie décennale sur tous les travaux » (page Travaux, reprise du site Lovable) est-elle exacte ?

## Historique des sessions

### 2026-10-10 (suite) — Site vitrine branché sur l'API

- Site public sur l'API : biens en vedette (sinon les plus récents), catalogue filtré et paginé côté serveur (paramètres d'URL inchangés, tri, quartiers selon la ville, budgets en loyers mensuels pour la location), fiche par slug (galerie, conditions de location, encart « Bien vérifié par l'agence », WhatsApp, appel, formulaire, biens similaires, partage), formulaires Contact et devis Travaux envoyés à `POST /api/public/leads` (composant `LeadForm` avec champ piège), coordonnées de l'agence lues dans `/public/company` (en-tête, pied de page, accueil, contact). `src/data/properties.ts` supprimé ; lien « Admin » renommé « Espace agence ».
- Numéros internationaux acceptés (`PhoneNumber` : `+33…`, `0033…`) pour les clients de la diaspora ; les numéros locaux restent ramenés à `+221`. D-028. 6 tests ajoutés (96).
- Vérifié dans Chromium : demande depuis une fiche avec un numéro français (refusée sans indicatif, acceptée avec), devis travaux, arrivée chez le dirigeant (prospect « Site internet », échange lié au bien) ; 5 pages publiques à 390 px sans débordement.

### 2026-10-10 (suite) — Refonte UX/UI du back-office

- Demande de l'utilisateur : une interface plus moderne, plus pertinente et plus simple.
- API : `GET /api/dashboard` (chiffres clés, tâches du jour, visites du jour, nouveaux prospects, brouillons, mandats proches de l'expiration ; périmètre propre pour un agent, toute l'agence pour le dirigeant) ; liste des biens avec `status_counts` et `checks_progress` ; `per_page` sur biens et clients ; recherche client par début de numéro (« 77 555 »). 4 tests ajoutés.
- Front : nouveau menu clair par sections, barre du haut avec recherche globale (Ctrl+K) et bouton « Créer » (client, bien, tâche depuis n'importe où), barre de navigation en bas sur téléphone ; accueil (tableau de bord) ; tâches groupées (en retard, aujourd'hui, demain, plus tard), ajout rapide et « Demain » pour reporter ; biens avec filtres par statut et compteurs, vue cartes ou tableau, progression de la vérification ; fiche bien avec galerie, carte « Prêt à publier » / « Étape suivante » et vérification en un clic ; clients en liste ou pipeline ; fiche client avec étapes cliquables, appel/WhatsApp, saisie rapide d'un échange et historique unifié échanges + visites, envoi d'un bien correspondant par WhatsApp ; page de connexion en deux panneaux ; squelettes de chargement et états vides utiles.
- « accent » (doré dans la charte Lovable) redevient un gris neutre dans le back-office (classe `admin` posée sur `<body>`) ; l'or reste disponible via `gold`.
- Données de démo enrichies (prospects à chaque étape, échanges, visites du jour, tâches en retard).

### 2026-10-10 (suite) — Back-office React

- Repris le site Lovable dans `frontend/` (sans `lovable-tagger`) ; `index.html` en français ; Vite relaie `/api` vers Laravel.
- Back-office sous `/admin` : connexion (email ou téléphone), mes tâches (aujourd'hui, semaine, équipe pour le dirigeant), biens (liste, création, fiche à onglets : vérification foncière, photos, fiche, pièces, mandats, historique, changement de statut), clients (liste, création avec détection de doublon, fiche : échanges, critères et biens correspondants, visites, pièces, informations), planning des visites et comptes-rendus, comptes, paramètres et logo, journal d'activité, changement de mot de passe. Menu adapté au rôle, version téléphone.
- Corrigé : ordre des points de vérification (API, test ajouté), débordement horizontal sur téléphone, Vite qui n'écoutait qu'en IPv6.
- Décisions D-024 à D-026.

### 2026-10-10 (suite) — API du lot 1

- Créé `main` à partir de `lot-0-socle` ; travail du lot 1 sur `lot-1-biens-prospects`.
- Traduit les messages de validation (`lang/fr/validation.php`).
- Implémenté l'API du lot 1 : biens (référence `BD-AAAA-0001`, statuts et historique, vérification foncière bloquante, photos WebP, pièces privées journalisées, mandats et alertes J-7), CRM (clients uniques par téléphone, pièces d'identité restreintes, critères, échanges, visites et comptes-rendus, tâches), rapprochement biens-prospects, API publique du site (catalogue, lieux, demandes avec anti-robot), `GET /api/meta`.
- Décisions D-016 à D-023 ; piège noté dans `architecture.md` : ne pas couper les événements de modèle (références et vérification foncière en dépendent).
- 86 tests verts ; parcours vérifié sur un serveur lancé : catalogue, demande d'un visiteur, tâche avec lien WhatsApp chez l'agent.

### 2026-10-10 — Analyse, proposition, lot 0

- Analysé le site existant `borom-daradji-properties` (React/Vite/shadcn généré par Lovable, données en dur, formulaires sans envoi, admin factice, bug du filtre par quartier, métadonnées Lovable dans `index.html`).
- Analysé le cahier des charges v2.0 et le chiffrage du client ; erreurs listées dans [`sources.md`](sources.md).
- Rédigé une proposition révisée adaptée au terrain (gestion locative, foncier, mobile money, WhatsApp, diaspora, tâcherons, hors ligne) : 6 lots, 1 270 h. Contenu repris dans `docs/`.
- Choix de Laravel validé par l'utilisateur après comparaison avec Spring Boot et AdonisJS (D-002).
- Implémenté le lot 0 côté API : authentification, rôles, comptes, paramètres de l'entreprise, journal d'activité, commande `borom:create-director`, seeder de démo, 39 tests, CI GitHub. Commit `cf6c425` poussé sur `lot-0-socle`.
- Rédigé cette documentation de reprise (`CLAUDE.md`, `docs/`).
