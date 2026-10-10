# Journal de suivi

**À lire en premier par toute nouvelle session.** Mettre à jour à la fin de chaque session : l'état actuel, puis une entrée datée en haut de l'historique.

## État actuel

- **Lot en cours** : lot 1 (biens et prospects) — API et back-office faits ; site vitrine encore sur ses données en dur.
- **Branches** : `main` (= lot 0, API seule) ; `lot-1-biens-prospects` (API du lot 1 + `frontend/` avec le back-office), pas encore fusionnée, pas de pull request.
- **Tests** : 86 tests backend verts ; front : `typecheck`, `lint` (1 avertissement sans gravité) et `build` propres ; parcours vérifié dans Chromium (dirigeant, agent, comptable sur téléphone).
- **CI GitHub** : le workflow existe mais GitHub ne démarre pas les tâches (aucune machine attribuée, aucun journal). Cause côté compte, probablement la facturation ou des Actions désactivées ; à vérifier par l'utilisateur sur la page de l'exécution.
- **Données de démo** : `php artisan migrate:fresh --seed` charge 4 comptes, les 12 biens de l'ancien site (10 publiés), 4 clients, une visite, une tâche.
- **Déploiement** : aucun serveur pour l'instant.

## Prochaines actions, dans l'ordre

1. Brancher le site vitrine (`frontend/src/pages`) sur l'API : catalogue `GET /api/public/properties`, filtres `/public/places`, fiche par slug, coordonnées `/public/company`, formulaires de contact et de bien sur `POST /api/public/leads`. Supprimer ensuite `src/data/properties.ts`.
2. Faire relire et fusionner `lot-1-biens-prospects` dans `main` (pull request à ouvrir sur demande de l'utilisateur).
3. Choisir l'hébergement et déployer une première version (questions ouvertes).
4. Lot 2 (encaissements et location) : attendre les réponses aux trois premières questions ouvertes.

Manques connus du back-office : pas de « mot de passe oublié » (le dirigeant réinitialise depuis Comptes), pas de carte des biens, pas de changement d'agent assigné depuis la fiche client, photos de démo externes non modifiables.

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

## Historique des sessions

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
