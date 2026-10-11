# Journal de suivi

**À lire en premier par toute nouvelle session.** Mettre à jour à la fin de chaque session : l'état actuel, puis une entrée datée en haut de l'historique.

## État actuel

- **Lot 1** (biens et prospects, site vitrine paramétrable) : terminé, **fusionné dans `main`** (PR #1, 2026-10-11).
- **Lot 2** (encaissements et location) : **fonctionnellement terminé** : facturation, avoirs, encaissements, reçus, caisse du jour, baux, appels de loyer automatiques, arriérés, quittances, reversements, états des lieux et restitution de la caution, relances automatiques des impayés, alerte de fin de bail, remise en location, cautions à restituer (valeurs par défaut à valider, D-035, D-040 à D-043). Critères d'acceptation dans `perimetre-et-lots.md`. **Fusionné dans `main`** (PR #2, 2026-10-11).
- **Lot 3** (travaux) : **fonctionnellement terminé** sur la branche `lot-3-travaux` (poussée, **pas encore de PR ni de fusion**, à faire sur demande de l'utilisateur) : catalogue et devis, chantiers (lots, avancement, journal, photos), facturation acompte/situations/solde, tâcherons et pointage, caisse de chantier, budget et alerte à +10 %, lien de suivi du client (`/suivi/{jeton}`), appli terrain hors ligne (`/admin/terrain`). Règles et critères d'acceptation dans `perimetre-et-lots.md`, décisions D-044 à D-050 (valeurs par défaut à valider).
- **Branches** : `main` contient les lots 0, 1 et 2 (PR #1 et #2 fusionnées le 2026-10-11). Les branches `lot-0-socle`, `lot-1-biens-prospects` et `lot-2-encaissements-location` sont conservées pour l'historique. Lot 3 sur `lot-3-travaux` (depuis `main`), non fusionné. GitGuardian signale sur la PR #2 les identifiants de la base de **développement** (`borom`/`borom` dans `compose.yaml`) : faux positif accepté par l'utilisateur, à marquer comme tel dans GitGuardian.
- **Droits** : RBAC complet (D-034), écran « Rôles et droits » et droits par compte ; après un déploiement, lancer `php artisan borom:sync-permissions`.
- **Tests** : 239 tests backend verts sur `lot-3-travaux`, sur SQLite **et** sur PostgreSQL (198 sur `main`) ; front : `typecheck`, `lint` (0 erreur, 19 avertissements « fast refresh » sans gravité) et `build` propres ; parcours vérifié dans Chromium (dirigeant, agent, téléphone 390 px sans débordement).
- **Docker** (D-037, D-039) : `make up` lance tout l'environnement de dev (API, planificateur, Vite, PostgreSQL 17) ; `compose.prod.yaml` (Caddy avec HTTPS automatique, PHP-FPM, planificateur, PostgreSQL) est prêt pour un serveur. Pas de GitHub Actions (D-038) : `make check` avant chaque commit.
- **Données de démo** : `php artisan migrate:fresh --seed` charge 4 comptes, le catalogue des travaux, des devis à chaque étape, le chantier en cours de Ngor (avancement, journal, lien de suivi, acompte payé et situation émise, 7 tâcherons, deux semaines de pointage, caisse du chef de chantier), les 12 biens de l'ancien site (9 publiés, 1 loué par la démo de gestion locative), des clients à chaque étape, des factures, le bail en gestion de Mermoz (état des lieux d'entrée validé) et le bail du studio du Point E résilié (dernier loyer impayé, états des lieux d'entrée et de sortie validés avec deux dégradations) : sa caution est prête à être restituée.
- **Déploiement** : aucun serveur pour l'instant ; il suffira d'un VPS Linux avec Docker (`make prod-up`).

## Prochaines actions, dans l'ordre

1. Choisir le serveur (VPS avec Docker) et le nom de domaine, puis déployer avec `make prod-up` (voir `README.md`). Lancer une fois `make up` et `make prod-up` sur une vraie machine : l'image PHP réelle (extensions gd, intl, pdo_pgsql…) n'a pas pu être construite dans le bac à sable (dépôt Alpine bloqué), tout le reste a été testé. Planifier `make prod-backup` dans le cron du serveur.
2. Faire valider par le comptable du client les règles de facturation (TVA par activité, mentions, délai de paiement) et les droits par défaut.
3. Ajuster les valeurs par défaut de la gestion locative selon les réponses du client (conditions de location, modèle de pièces des états des lieux, règles de la caution).
4. Lot 3 : relecture par l'utilisateur, puis PR `lot-3-travaux` → `main` et fusion **sur sa demande**. Tester l'appli terrain sur un vrai téléphone Android en HTTPS (installation, appareil photo, coupure réseau).
5. Lot 4 (stock et négoce), sur une branche `lot-4-stock-negoce` depuis `main` une fois le lot 3 fusionné : les sorties de stock vers un chantier s'ajouteront au coût réel (`WorksiteCosts`).

Manques connus du back-office : pas de « mot de passe oublié » (le dirigeant réinitialise depuis Comptes), pas de carte des biens, pas de changement d'agent assigné depuis la fiche client, pipeline sans glisser-déposer (menu « Déplacer vers »), photos de démo externes non modifiables.

## Questions ouvertes pour le client

Les trois premières bloquent le lot 2. Noter la réponse et la date ici quand elle arrive.

- [ ] L'agence gère-t-elle des biens pour des propriétaires (encaissement et reversement des loyers) ? Combien de baux, quel taux de commission ? *Mis en place avec des valeurs par défaut (D-035) : commission 10 % des loyers encaissés + TVA 18 %, calculée sur loyer et charges ; reversement mensuel à la demande. À confirmer : base de la commission (loyer seul ?), TVA, fréquence.*
- [ ] Conditions habituelles de location : mois de caution, d'avance, frais d'agence, jour d'échéance (5 par défaut), loyers soumis ou non à la TVA (0 % par défaut). Premier mois au prorata ou non (aujourd'hui : mois entier).
- [ ] Les baux sont-ils enregistrés aux impôts, et par qui ?
- [ ] Liste des points de vérification foncière à exiger avant publication (6 points par défaut dans `PropertyCheckItem`) et ancienneté maximale de l'état des droits réels (90 jours par défaut).
- [ ] Un bien « en négociation » doit-il rester visible sur le site (oui par défaut, D-020) ?
- [ ] Volumes : biens en portefeuille, chantiers par an, articles en stock, factures par mois.
- [ ] Le négoce a-t-il un dépôt avec vente au comptoir, ou seulement des livraisons sur chantier ?
- [ ] Avec le comptable : méthode de valorisation du stock (CMUP proposé), TVA par activité (les loyers d'habitation sont-ils exonérés ? la TVA est choisie ligne par ligne, 18 % par défaut), mentions obligatoires sur les factures, délai de paiement par défaut (15 jours proposés).
- [ ] Droits des rôles par défaut (désormais modifiables par le dirigeant dans « Rôles et droits ») : à passer en revue avec lui à la mise en service, notamment les factures (le comptable prépare, émet, fait les avoirs et annule les encaissements ; agents et commerciaux consultent et encaissent ; responsable travaux sans accès).
- [ ] Coordonnées bancaires à saisir dans Paramètres : elles s'impriment sur les factures (virement).
- [ ] Logiciel du cabinet comptable (Sage, Ciel, autre) pour le format des exports.
- [ ] Nombre d'utilisateurs et rôles cumulés.
- [ ] Travaux : validité des devis (30 jours) et acompte demandé (30 %) ; conditions imprimées sur les devis ; liste des corps de métier et prix du catalogue (ceux de la démo sont indicatifs).
- [ ] Chef de chantier : a-t-il un compte ? Proposition : un rôle « Chef de chantier » (consulter les chantiers, photos et journal, pointage, caisse du chantier) à créer dans « Rôles et droits » ; qui approvisionne sa caisse et paie les tâcherons (comptable par défaut) ?
- [ ] Tâcherons : demi-journée acceptée ? paiement chaque samedi, à la quinzaine, en fin de tâche ? Photo du reçu obligatoire au-delà d'un montant ?
- [ ] Alerte de budget au-delà de 10 % : bon seuil ? qui la reçoit (chef de chantier, sinon responsable travaux) ?
- [ ] Données existantes à reprendre (Excel, cahiers).
- [ ] Hébergement et nom de domaine : qui paie, qui administre. *Base : PostgreSQL 17, choisi par l'utilisateur le 2026-10-10 (D-039).*
- [ ] Caution : qui la garde (l'agence par défaut, sur sa facture d'entrée), et pour un bail géré, les retenues pour réparations reviennent-elles au propriétaire ? Faut-il un délai de restitution (souvent un ou deux mois après la sortie) ?
- [ ] Modèle de pièces et d'éléments des états des lieux (`config/borom.php`, `inspection_template`), et faut-il facturer l'état des lieux au locataire ou au propriétaire ?
- [ ] Taux horaire ou budget, date de démarrage.
- [ ] Durée de conservation des sauvegardes (30 jours proposés).
- [ ] Vraies coordonnées de l'agence (téléphone, WhatsApp, email, adresse) à saisir dans Paramètres : le site les affiche partout ; les valeurs de démo sont fictives.
- [ ] Logo, couleurs, horaires d'ouverture, liens des réseaux sociaux : à saisir par le dirigeant dans Site internet (horaires par défaut : lun-ven 8h30-18h, sam 9h-13h ; aucun réseau affiché tant qu'aucun lien n'est saisi).
- [ ] Textes repris du site Lovable à confirmer, modifiables dans Site internet : « Garantie décennale sur tous les travaux » (Travaux > Engagements), « Leader de l'immobilier au Sénégal » (pastille de l'accueil), chiffres clés « 500+ biens vendus, 1200+ clients, 15 ans, 98 % » (Accueil > Pourquoi nous choisir).
- [ ] Mentions légales : hébergeur du site, et faut-il afficher le NINEA et le RCCM (option désactivée par défaut) ? Texte de la politique de confidentialité à faire relire.

## Historique des sessions

### 2026-10-11 (suite) — Lot 3 : travaux

- Demande de l'utilisateur : passer à l'étape suivante (lot 3), puis « continue l'implémentation ». Branche `lot-3-travaux` depuis `main`, poussée après chaque étape. D-044 à D-050.
- A. Catalogue (corps de métier, prestations) et devis par lots (remise, TVA par ligne, modèles, PDF, envoi WhatsApp, expiration la nuit).
- B. Chantiers : création à l'acceptation du devis, statuts, avancement par lot pondéré, journal, photos géolocalisées privées, lien de suivi.
- C. Facturation : acompte, situations cumulées avec déduction de l'acompte, solde, par le socle du lot 2.
- D. Tâcherons, pointage, tâches, avances et paiements, caisse de chantier (liée à la caisse du jour par des mouvements automatiques `avance_chantier` / `retour_chantier`), budget prévu/réel et alerte ; onglets Équipe, Caisse, Budget, page Tâcherons.
- E. Page publique `/suivi/{jeton}` (avancement, photos et journal publics, factures émises avec PDF, paiements).
- F. Appli terrain hors ligne : écran Terrain, file d'attente IndexedDB, service worker, manifeste et icônes, profil gardé hors ligne.
- Corrigé en route : débordement à 390 px des grilles sans `grid-cols-1` (onglets Caisse, Budget, Factures) ; recherche du pointage existant par `whereDate` (la date est stockée avec l'heure sous SQLite).
- 239 tests verts sur SQLite et PostgreSQL ; démo chargée sur PostgreSQL ; front : typecheck, lint (0 erreur), build. Vérifié dans Chromium (bureau et 390 px) : onglets Équipe, Caisse (dépense avec reçu), Budget, Tâcherons, page de suivi ; hors ligne avec le build de production : rechargement sans réseau, pointage, dépense et photo gardés puis envoyés au retour du réseau.
- Limite : l'image PHP réelle (gd, intl, pdo_pgsql) ne se construit toujours pas dans le bac à sable ; PostgreSQL testé avec le PHP de la machine contre le conteneur `db`.

### 2026-10-11 — Fusion des lots 1 et 2

- Demande de l'utilisateur : terminer le lot 2, puis fusionner. Tests du lot 1 relancés sur sa branche (108 verts), PR #1 `lot-1-biens-prospects` → `main` fusionnée ; PR #2 `lot-2-encaissements-location` → `main` fusionnée. `main` vérifiée : 198 tests verts, Pint propre.
- GitGuardian (application installée sur le dépôt) a signalé les mots de passe de la base de développement dans `compose.yaml` : faux positif (valeurs locales, jamais utilisées en production, où tout vient de `.env.prod`), fusion décidée par l'utilisateur.

### 2026-10-10 (suite) — Lot 2 : finitions avant fusion

- Demande de l'utilisateur : terminer le lot 2, en comblant les derniers manques puis en fusionnant les lots 1 et 2 dans `main`. D-042, D-043.
- Relances : `ReminderService`, commandes `borom:remind-overdue` (07:10) et `borom:check-lease-ends` (07:05) ; colonnes `invoices.reminder_level`, `last_reminded_at`, `leases.end_alerted_at`.
- Résiliation avec « Remettre le bien en location » ; filtre et compteur « Cautions à restituer » (liste des baux, accueil) ; annulation d'une restitution de caution (mouvement de caisse « annulation_caution »).
- Corrigé : le bouton « Encaisser » de l'échéancier était coupé à 1280 px (colonne « Facture » masquée sous 1536 px, le mois mène à la facture). PostgreSQL a révélé une valeur trop longue pour sa colonne (`annulation_restitution`, 22 caractères pour 20) : SQLite ne contrôle pas les longueurs, d'où l'intérêt de `make test-pgsql`.
- 12 tests (198), verts sur SQLite et PostgreSQL. Vérifié dans Chromium : accueil du comptable, filtre des cautions, restitution puis annulation, résiliation avec remise en location.

### 2026-10-10 (suite) — PostgreSQL, fin du lot 2 (états des lieux, caution)

- Demande de l'utilisateur : passer à l'implémentation, terminer le lot 2, utiliser PostgreSQL. D-039, D-040, D-041.
- PostgreSQL : Docker (dev et production), `make test-pgsql`, `make psql`, sauvegarde `pg_dump`. Corrigé : rapprochement biens-prospects qui comparait des colonnes entières à des bornes décimales (erreur sur PostgreSQL à la publication d'un bien) ; recherches sensibles à la casse sur PostgreSQL (`whereLike` partout, test ajouté).
- API : états des lieux (`lease_inspections`, lignes, photos privées en WebP), modèle de pièces paramétrable, comparaison entrée/sortie et dégradations, validation qui fige, PDF à signer ; restitution de la caution (`deposit_settlements`, `CAU-AAAA-0001`) : loyers impayés soldés par des encaissements « retenue sur caution » (nouveau mode, jamais saisi à la main), retenues, remboursement (sortie de caisse en espèces, nouveau type de mouvement), reste dû facturé, décompte PDF ; permission `deposits.settle` (comptable). 18 tests (186).
- Écrans : encarts « États des lieux » et « Caution » sur la fiche du bail ; page d'état des lieux pensée pour le téléphone (pièces, état en un geste, observation, photo prise avec l'appareil, relevés, comparaison à l'entrée, validation, PDF) ; fenêtre de restitution (caution encaissée, impayés retenus, retenues proposées depuis les dégradations, récapitulatif en direct, mode de remboursement). La retenue sur caution n'est pas proposée dans les fenêtres d'encaissement et de reversement, ni la restitution dans les mouvements de caisse.
- Données de démo : `DemoInspectionSeeder`.
- Vérifié dans Chromium : agent (fiche du bail, état des lieux de sortie validé, nouvelle sortie avec état, observation et photo, téléphone 390 px sans débordement), comptable (restitution du studio : septembre soldé par la caution, deux retenues, 130 000 FCFA rendus par Wave) ; PDF de l'état des lieux et du décompte relus. PostgreSQL du `compose.yaml` : base de test créée au démarrage, migrations, démo et 186 tests ; sauvegarde et restauration `pg_dump`/`psql`. **Non vérifié ici** : l'image PHP réelle avec `pdo_pgsql` (dépôts de paquets bloqués dans le bac à sable), à construire une fois sur une vraie machine.

### 2026-10-10 (suite) — Environnement Docker, fin de GitHub Actions

- Demande de l'utilisateur : il n'utilise pas GitHub Actions ; mettre en place l'environnement Docker. D-037, D-038.
- Développement (`compose.yaml`, `make up`) : API (`artisan serve --no-reload`, code monté, UID de la machine), planificateur (`schedule:work`), Vite (dépendances dans un volume, `/api` relayé vers l'API), MySQL 8.4 avec une base `borom_test` pour les tests. Au premier démarrage : `composer install`, `npm ci`, migrations, données de démo, permissions, lien `public/storage` relatif.
- Production (`compose.prod.yaml`, `make prod-up`) : Caddy (fichiers React, `/api` et `/up` vers PHP-FPM, `/storage` en lecture seule, HTTPS automatique), PHP-FPM sans root (caches, migrations et `borom:sync-permissions` au démarrage), planificateur, MySQL ; `.env.prod.example` ; `make prod-key`, `prod-director`, `prod-backup` (base + fichiers).
- `Makefile` : `up`, `down`, `logs`, `artisan`, `fresh`, `test`, `test-mysql`, `check`, et les équivalents de production. Workflow `.github/workflows/backend.yml` supprimé.
- Corrigé : les tests lancés dans un conteneur auraient vidé la base MySQL de dev (`phpunit.xml` impose maintenant SQLite par des lignes `<server>`) ; deux tests comparaient l'ordre des clés JSON, que MySQL change (la suite passe désormais sur MySQL) ; une requête API sans `Accept: application/json` (robots, curl) renvoyait 500 « Route [login] not defined » au lieu de 401 (`redirectGuestsTo`, test ajouté).
- Vérifié dans le bac à sable avec une variante Debian de l'image PHP (le dépôt Alpine y est bloqué) : pile de production complète (migrations, création du dirigeant, connexion via Caddy, photos servies, chemins `../` et `.env` inaccessibles, gzip et cache des fichiers, redémarrage sans nouvelle migration, tâches planifiées, sauvegarde) ; pile de dev (connexion au back-office dans Chromium sur MySQL, `make check`, `make test-mysql`). **Non vérifié ici** : la construction de l'image PHP Alpine réelle (`install-php-extensions`), à lancer une fois sur une vraie machine.

### 2026-10-10 (suite) — Lot 2 : gestion locative

- API : baux (`leases`, référence `BAIL-AAAA-0001`), appels de loyer (`rent_calls`, une facture par mois), reversements (`owner_payouts`, `REV-AAAA-0001`) ; règles dans `App\Services\RentService` (détail dans `perimetre-et-lots.md`, lot 2) ; tâche planifiée `borom:generate-rent-calls` (06:00) ; quittance et relevé de gérance en PDF ; relance WhatsApp des arriérés ; permissions `leases.view|manage`, `payouts.view|manage` (ajoutées aux rôles par défaut et aux installations existantes par `newPermissionDefaults`). D-035, D-036. 19 tests (166).
- Corrigé pendant la session : l'avance payée à l'entrée n'était pas reversée au propriétaire (elle figurait sur la facture d'entrée) ; les mois d'avance sont désormais des appels de loyer émis à la signature.
- Écrans : Baux et loyers (chiffres, filtres « avec arriérés », liste), nouveau bail (prérempli depuis le bien : loyer, charges, caution, avance, propriétaire ; résumé « à la signature » et estimation du net propriétaire), fiche du bail (échéancier, encaisser, quittance, relance, appeler le loyer, modifier, résilier), Reversements (à reverser par propriétaire, relevé détaillé, frais, versement et PDF, historique et annulation), encart « Location » sur la fiche d'un bien. Démo : bail en gestion de l'appartement de Mermoz avec trois mois appelés.
- Vérifié dans Chromium : agent (liste, fiche, quittance, nouveau bail depuis un bien), comptable (relevé, frais, versement, PDF, historique) ; 390 px sans débordement.

### 2026-10-10 (suite) — RBAC : rôles et droits paramétrables

- Demande de l'utilisateur : un système RBAC standard, complet. D-034 remplace D-005.
- Serveur : `spatie/laravel-permission` ; catalogue de 31 permissions en 8 modules (`App\Support\PermissionCatalog`) ; 5 rôles par défaut reprenant exactement les droits d'avant ; reprise automatique des rôles existants (ancienne colonne `users.roles` supprimée) ; policies, routes et contrôleurs réécrits sur les permissions (`hasPermission`, `can:`) ; commande `borom:sync-permissions`.
- API : `GET /api/roles`, `/api/permissions` (catalogue + qui a quoi), `POST/PUT/DELETE /api/roles`, `POST /api/roles/{id}/duplicate` ; comptes avec plusieurs rôles et droits individuels ; `/api/auth/me` renvoie les permissions effectives. Garde-fous : pas d'escalade, rôle dirigeant réservé aux dirigeants, pas de modification de ses propres droits, toujours un dirigeant actif, rôles par défaut non supprimables, rôle attribué non supprimable. Journal avant/après. 14 tests (147).
- Écrans : « Rôles et droits » (liste, éditeur par module avec recherche et « tout le module », compteur +/− avant enregistrement, dupliquer, supprimer, matrice rôles × droits), « Comptes » (filtre par rôle, fiche latérale : compte, rôles cumulables, droits individuels avec « donné par » ; cases grisées pour ce qu'on ne peut pas donner) ; menu, pages et boutons pilotés par `can()`.
- Vérifié dans Chromium : création d'un rôle « Assistante d'agence » à partir de Commercial, ajustement, compte avec ce rôle + un droit individuel, connexion de ce compte (menu réduit, page Comptes refusée) ; 390 px sans débordement. Corrigé au passage : après la création d'un rôle, l'écran restait sur le premier rôle de la liste.

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
