# Journal de suivi

**À lire en premier par toute nouvelle session.** Mettre à jour à la fin de chaque session : l'état actuel, puis une entrée datée en haut de l'historique.

## État actuel

- **Lot 1** (biens et prospects, site vitrine paramétrable) : fonctionnellement terminé, reste la fusion dans `main` et le déploiement.
- **Lot 2 en cours** : facturation, avoirs, encaissements, reçus, caisse du jour et leurs écrans **faits** ; baux, loyers, quittances, états des lieux et reversements en attente des réponses du client.
- **Branches** : `main` (= lot 0, API seule) ; `lot-1-biens-prospects` (lot 1), pas encore fusionnée ; `lot-2-encaissements-location`, partie de `lot-1-biens-prospects` (D-030). Pas de pull request.
- **Tests** : 133 tests backend verts ; front : `typecheck`, `lint` (0 erreur, 17 avertissements « fast refresh » sans gravité) et `build` propres ; parcours vérifié dans Chromium (dirigeant, agent, téléphone 390 px sans débordement).
- **CI GitHub** : le workflow existe mais GitHub ne démarre pas les tâches (aucune machine attribuée, aucun journal). Cause côté compte, probablement la facturation ou des Actions désactivées ; à vérifier par l'utilisateur sur la page de l'exécution.
- **Données de démo** : `php artisan migrate:fresh --seed` charge 4 comptes, les 12 biens de l'ancien site (10 publiés), 4 clients, une visite, une tâche.
- **Déploiement** : aucun serveur pour l'instant.

## Prochaines actions, dans l'ordre

1. Faire relire et fusionner `lot-1-biens-prospects` dans `main`, puis `lot-2-encaissements-location` (pull requests à ouvrir sur demande de l'utilisateur).
2. Choisir l'hébergement et déployer une première version (questions ouvertes).
3. Faire valider par le comptable du client les règles de facturation (TVA par activité, mentions, délai de paiement) et les droits par défaut.
4. Lot 2, suite : baux, appels de loyer automatiques, quittances, états des lieux, reversements — dès les réponses aux trois premières questions ouvertes.

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
- [ ] Avec le comptable : méthode de valorisation du stock (CMUP proposé), TVA par activité (les loyers d'habitation sont-ils exonérés ? la TVA est choisie ligne par ligne, 18 % par défaut), mentions obligatoires sur les factures, délai de paiement par défaut (15 jours proposés).
- [ ] Droits sur les factures (proposés) : le comptable prépare, émet et fait les avoirs ; agents et commerciaux consultent et encaissent ; le responsable travaux n'y a pas accès. Qui peut annuler un encaissement (comptable et dirigeant proposés) ?
- [ ] Coordonnées bancaires à saisir dans Paramètres : elles s'impriment sur les factures (virement).
- [ ] Logiciel du cabinet comptable (Sage, Ciel, autre) pour le format des exports.
- [ ] Nombre d'utilisateurs et rôles cumulés.
- [ ] Données existantes à reprendre (Excel, cahiers).
- [ ] Hébergement et nom de domaine : qui paie, qui administre. Choix MySQL ou PostgreSQL.
- [ ] Taux horaire ou budget, date de démarrage.
- [ ] Durée de conservation des sauvegardes (30 jours proposés).
- [ ] Vraies coordonnées de l'agence (téléphone, WhatsApp, email, adresse) à saisir dans Paramètres : le site les affiche partout ; les valeurs de démo sont fictives.
- [ ] Logo, couleurs, horaires d'ouverture, liens des réseaux sociaux : à saisir par le dirigeant dans Site internet (horaires par défaut : lun-ven 8h30-18h, sam 9h-13h ; aucun réseau affiché tant qu'aucun lien n'est saisi).
- [ ] Textes repris du site Lovable à confirmer, modifiables dans Site internet : « Garantie décennale sur tous les travaux » (Travaux > Engagements), « Leader de l'immobilier au Sénégal » (pastille de l'accueil), chiffres clés « 500+ biens vendus, 1200+ clients, 15 ans, 98 % » (Accueil > Pourquoi nous choisir).
- [ ] Mentions légales : hébergeur du site, et faut-il afficher le NINEA et le RCCM (option désactivée par défaut) ? Texte de la politique de confidentialité à faire relire.

## Historique des sessions

### 2026-10-10 (suite) — Lot 2 : facturation, encaissements, caisse

- Branche `lot-2-encaissements-location` créée depuis le lot 1 (D-030).
- API : factures et avoirs (`invoices`, `invoice_lines`), encaissements (`payments`), caisse (`cash_sessions`, `cash_movements`) ; règles dans `App\Services\Billing` (détail dans `perimetre-et-lots.md`, lot 2) ; droits dans `InvoicePolicy` ; PDF de facture, d'avoir et de reçu (dompdf, D-033) avec montant en lettres et couleur de la charte ; relance WhatsApp pré-remplie avec le reste à payer ; `GET /api/meta` complété. D-031, D-032. 25 tests (133), dont l'affichage des numéros (`PhoneNumber::format`).
- Données de démo : 4 factures (payée par Wave, payée en partie en espèces, commission en retard, brouillon négoce).
- Écrans : Factures (chiffres « reste à encaisser », « en retard », filtres, recherche), saisie d'une facture (client et bien recherchés, lignes réordonnables, TVA par ligne, totaux en direct, « Enregistrer et émettre »), fiche (PDF, encaisser, relancer, avoir, encaissements avec reçu, justificatif et annulation), fenêtre d'encaissement (modes en gros boutons, référence exigée hors espèces, capture, reçu à télécharger), Caisse (ma caisse du jour, mouvements, clôture avec écart expliqué, encaissements par mode, caisses de l'équipe pour le comptable), onglet Factures de la fiche client, factures en retard sur l'accueil, menu Finances, barre du bas du téléphone adaptée au comptable.
- Vérifié dans Chromium : comptable (création, émission, PDF, encaissement Wave refusé sans référence puis accepté, avoir sur facture en retard), agent (pas de création, encaissement en espèces, dépense, clôture refusée sans explication de l'écart puis acceptée), comptable (encaissements, caisses de l'équipe, factures d'un client) ; téléphone 390 px sans débordement.

### 2026-10-10 (suite) — Site vitrine entièrement paramétrable

- Demande de l'utilisateur : « tout paramétrable, même le logo ».
- API : contenu par défaut dans `backend/config/site.php` (identique au site d'origine), modifications du dirigeant seules dans `company_settings.site` (JSON), fusion par `App\Support\SiteContent`. Routes : `GET /api/public/site` (coordonnées + contenu, un seul appel pour le site), `GET /api/settings/site`, `PUT|DELETE /api/settings/site/{section}` (enregistrer / revenir au contenu d'origine), `POST /api/settings/site/images` (WebP dans `site/`, supprimées du disque quand elles ne servent plus), `DELETE /api/settings/company/logo`. Validation par section (`UpdateSiteSectionRequest`, règle `SiteImage`). 12 tests (108). D-029.
- Paramétrable : logo (en-tête, pied de page, icône d'onglet, partages, back-office, connexion), nom affiché ou non à côté du logo, slogan, deux couleurs dont toutes les nuances sont dérivées (`themeVariables` dans `src/lib/site.ts`), chaque bloc de l'accueil (textes, photo de fond, services avec icônes, points forts, chiffres clés, appels à l'action, chaque bloc masquable), page Travaux (métiers, réalisations avant/après avec photos, engagements ; les métiers alimentent le formulaire de devis), page Contact (textes, horaires, sujets du formulaire), réseaux sociaux (affichés seulement s'ils sont renseignés), pied de page, nouvelles pages Mentions légales et Politique de confidentialité, référencement (titre, description, aperçu Google).
- Front : `SiteProvider` charge le contenu une fois pour tout le site public ; `src/data/services.ts` supprimé. Back-office : écran « Site internet » (dirigeant) à onglets, brouillon par onglet, pastilles « personnalisé » / « à publier », barre « Publier », aperçu des couleurs, listes réordonnables, choix d'icône, envoi d'images.
- Vérifié dans Chromium : logo, couleurs vert et ambre, titre, photo de fond, bloc masqué, réseaux, référencement, puis site public mis à jour (couleurs, icône d'onglet, titre) ; erreur de couleur affichée sous le champ ; 390 px sans débordement. Contenu de démo remis aux valeurs d'origine ensuite.

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
