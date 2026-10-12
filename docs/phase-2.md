# Phase 2 — état des lieux et conception

Proposition du 11 octobre 2026, **à valider avec le client**. Elle part de ce qui était prévu (cahier des charges v2.0, résumé dans [`sources.md`](sources.md)), de ce qui est construit (lots 0 à 5, tous dans `main`) et de ce qui a été reporté ([`perimetre-et-lots.md`](perimetre-et-lots.md)). Chaque fonctionnalité est gardée, adaptée, conditionnée ou retirée, avec sa raison.

## En bref

- La phase 1 est faite et va plus loin que le cahier des charges sur plusieurs points (gestion locative, foncier, mobile money, tâcherons, hors ligne). Il reste une dizaine de manques à combler **avant** la phase 2 : c'est le **lot 6, consolidation et mise en service** (reprise des données, carte, procès-verbal de réception, planning des chantiers…).
- La phase 2 retenue tient en **neuf modules** : espace client, paiement en ligne, messages automatiques, signature électronique, interventions (SAV et maintenance), trésorerie prévisionnelle, négoce avancé, dossier technique des chantiers, notifications et aide.
- **Retirés** : application native, accusés de lecture des e-mails, tutoriels vidéo comme développement, lead scoring, ElasticSearch et PostGIS, calculs d'ingénierie et CAO, signature qualifiée. **Sous condition** : plusieurs dépôts.
- Ordre de grandeur : lot 6 environ **100 h**, phase 2 environ **620 à 890 h** selon les options, hors coûts des services externes (SMS, WhatsApp, paiement).

---

## 1. État des lieux

### 1.1 Ce qui était prévu

Le cahier des charges v2.0 (13 février 2026) décrit **125 fonctions de phase 1** en six modules et annonce **22 fonctions de phase 2** en quatre modules, dont la description (section 8) est absente du document :

| Module de phase 2 annoncé | Fonctions | Contenu connu |
| --- | --- | --- |
| Ingénierie et plans | 5 | Titre seulement |
| SAV et garanties | 4 | Titre seulement |
| Application mobile | 6 | Titre seulement |
| Espace client | 7 | Titre seulement ; l'acteur « client » de la matrice d'accès voit déjà factures et procès-verbaux |

Le chiffrage (899 h) ne couvrait que 90 des 125 fonctions de phase 1 et aucune de phase 2 (voir les erreurs relevées dans `sources.md`).

En cadrant la phase 1, nous avons **reporté en phase 2** : prévisionnel de trésorerie (5.20), objectifs de chiffre d'affaires (5.27), commandes fournisseurs (4.18), plusieurs dépôts (4.9), aide contextuelle (6.20) et tutoriels vidéo (6.22), API WhatsApp Business, paiement en ligne Wave / Orange Money, accusés de lecture des e-mails (3.8, 5.9), espace client complet, signature numérique, application native.

### 1.2 Ce qui est construit (lots 0 à 5)

| Domaine | Fait |
| --- | --- |
| Socle | Comptes, connexion par e-mail ou téléphone, rôles et droits paramétrables (RBAC), journal d'activité un an, paramètres de l'entreprise, Docker dev et production, PostgreSQL |
| Biens et prospects | Biens, photos WebP, vérification foncière avant publication, mandats et alertes, historique des statuts, documents, CRM (fiches, critères de recherche, échanges, visites, pipeline), rapprochement biens-prospects, site vitrine paramétrable, demandes du site |
| Encaissements et location | Factures, avoirs, numérotation sans trou, PDF, encaissements espèces et mobile money, caisse du jour, baux, appels de loyer automatiques, arriérés et relances, quittances, relevés de gérance et reversements, états des lieux avec photos, restitution de la caution |
| Travaux | Catalogue, devis par lots et modèles, chantiers, avancement, journal, photos géolocalisées, factures d'acompte, de situation et de solde, tâcherons et pointage, caisse de chantier, budget et alerte, lien de suivi du client, appli terrain hors ligne |
| Stock et négoce | Articles, coût moyen pondéré, achats et paiements fournisseurs, sorties vers chantier, vente au comptoir, inventaire, alertes de seuil |
| Pilotage | Tableau de bord du dirigeant, exports comptables Excel (SYSCOHADA), recherche globale |

**Ajouté par rapport au cahier des charges** : gestion locative complète, états des lieux, vérification foncière, mobile money et caisse, tâcherons et caisse de chantier, lien de suivi de chantier, saisie hors ligne, rôles paramétrables.

**Simplifié volontairement** (décisions déjà prises, voir `perimetre-et-lots.md`) : lead scoring, fusion des doublons, relances par e-mail, synchronisation Google Agenda, devis par glisser-déposer, plusieurs tableaux de bord, pointage bancaire par import, FIFO, ElasticSearch et PostGIS.

### 1.3 Ce qui manque encore de la phase 1

Vérifié dans le code le 11 octobre 2026 :

| Fonction du cahier des charges | État | Proposition |
| --- | --- | --- |
| Carte des biens (1.5, Leaflet + OpenStreetMap retenu) | Absente ; les coordonnées existent | Lot 6 |
| Export des biens et des clients (1.x, 2.16) ; import Excel (2.16, 4.x) | Absents (seuls les exports comptables existent) | Lot 6 : nécessaire à la **reprise des données** au démarrage |
| Procès-verbal de réception de chantier (3.18) | Absent | Lot 6 : il ouvre les garanties (module E) |
| Planning des chantiers et des équipes (3.12) | Absent (seul le planning des visites existe) | Lot 6, en vue calendrier simple |
| Livraisons de matériaux (3.x) | Sorties de stock faites, sans bon de livraison imprimable | Lot 6 : bon de livraison PDF |
| Envoi des documents par e-mail (5.x) ; SMS (5.x) | Aucun envoi : liens WhatsApp et PDF à télécharger | Module C |
| Mot de passe oublié | Absent ; le dirigeant réinitialise | Lot 6 |
| Notifications (6.x) | Tâches seulement, pas de centre de notifications | Module I |
| Statistiques du stock (4.x) | Valeur et alertes seulement | Module G |
| Petits manques du back-office | Pas de changement d'agent depuis la fiche client, pipeline sans glisser-déposer | Lot 6 (le glisser-déposer en option) |

---

## 2. Tri des fonctionnalités

| Fonctionnalité | Origine | Décision | Raison |
| --- | --- | --- | --- |
| Espace client | v2.0 phase 2 (7) + reporté | **Garder, élargir** | Propriétaires, locataires et clients travaux veulent suivre leurs affaires sans appeler ; la diaspora surtout |
| Proposer ses biens en ligne | Nouveau besoin (propriétaires) | **Garder, tout de suite** (lot 6) | Petit, sans compte, alimente le portefeuille |
| Paiement en ligne Wave / Orange Money | Reporté | **Garder** | Loyers et acomptes encaissés sans déplacement, rapprochement automatique |
| API WhatsApp Business, SMS, e-mail | Reporté (D-012) | **Garder, en option payante à l'usage** | Rappels et documents envoyés sans geste manuel ; coût par message |
| Signature électronique | Reporté (signature de 3.18) | **Adapter** : signature simple avec code par SMS, pas de signature qualifiée | Suffit pour états des lieux, devis, mandats, procès-verbaux ; les ventes se signent chez le notaire |
| SAV et garanties | v2.0 phase 2 (4) | **Garder, élargir** à la maintenance des biens loués | Même mécanique : une demande, une intervention, un coût sous garantie ou facturé |
| Ingénierie et plans | v2.0 phase 2 (5) | **Adapter** : dossier technique et autorisations du chantier | La conception se fait dans les logiciels d'architecte ; la gestion garde les plans, études et permis |
| Calculs de structure, CAO, métrés automatiques | Supposé dans « ingénierie » | **Retirer** | Hors d'un logiciel de gestion ; outils spécialisés existants |
| Application mobile native (6) | v2.0 phase 2 | **Retirer**, remplacer par l'application web installable | L'appli terrain fonctionne déjà hors ligne et s'installe ; une appli de store coûte deux développements et des publications |
| Notifications push | Lié à l'application mobile | **Garder** via l'application installée (Web Push) | Le besoin réel de l'application mobile |
| Prévisionnel de trésorerie | Reporté (5.20) | **Garder** | Données déjà là (échéances, loyers, achats, situations) |
| Objectifs de chiffre d'affaires | Reporté (5.27) | **Garder, simple** | Par activité et par mois, comparés au réalisé |
| Pointage bancaire par import de relevé | Simplifié (5.16) | **Sous condition** | Utile pour les virements ; dépend du format des relevés de la banque |
| Commandes fournisseurs | Reporté (4.18) | **Garder** | Bon de commande, réception partielle qui crée l'achat |
| Plusieurs dépôts et transferts | Reporté (4.9) | **Sous condition** | Seulement si l'agence a plusieurs dépôts (question ouverte) |
| Statistiques du stock | v2.0 (4.x) | **Garder, dans le pilotage** | Rotation, articles les plus vendus, marge par article |
| Accusés de lecture des e-mails | Reporté (3.8, 5.9) | **Retirer** | Les clients écrivent sur WhatsApp ; les pixels de suivi sont bloqués et peu fiables |
| Aide contextuelle | Reporté (6.20) | **Garder, sous forme de guides intégrés** | Une page d'aide par écran, à jour avec le logiciel |
| Tutoriels vidéo | Reporté (6.22) | **Retirer du développement** | Enregistrements d'écran faits à la formation, pas du code |
| Abonnement agenda | Remplace la synchro Google (2.10) | **Garder, léger** | Un lien d'agenda (iCal) en lecture pour voir visites et tâches dans Google Agenda ou le téléphone |
| Lead scoring automatique | Simplifié (2.5) | **Retirer** | Volume faible ; l'agent qualifie mieux |
| Fusion des doublons | Simplifié (2.17) | **Retirer**, sauf outil ponctuel après la reprise des données | Le téléphone unique empêche les doublons |
| ElasticSearch, PostGIS | Simplifié | **Retirer** | Volumes qui ne le justifient pas |

---

## 3. Lot 6 — consolidation et mise en service (avant la phase 2)

Objectif : un logiciel complet pour la phase 1 et prêt à recevoir les vraies données.

1. **Reprise des données** : import Excel des biens, clients, articles (et stock initial), à partir de modèles fournis ; contrôle ligne par ligne, rapport d'erreurs, simulation avant import ; outil ponctuel de fusion si l'import crée des doublons.
2. **Exports Excel des listes** : biens, clients, chantiers, stock, avec les filtres de l'écran.
3. **Carte des biens** : Leaflet + OpenStreetMap, au back-office (tous les biens) et sur le site (quartier approximatif, jamais l'adresse exacte, D-020).
4. **Procès-verbal de réception** de chantier : réception avec ou sans réserves, liste des réserves (photos, lot concerné, levée datée), PDF à signer ; la date de réception ouvre les garanties (module E).
5. **Planning des chantiers** : calendrier des chantiers (dates prévues et réelles, retards) et des équipes présentes, au mois et à la semaine.
6. **Bon de livraison** PDF pour les sorties vers chantier et les ventes livrées.
7. **Mot de passe oublié** par code envoyé par SMS ou par e-mail ; à défaut, réinitialisation par le dirigeant (existant).
8. **Formulaire public « Proposer mes biens »** : sans compte ; une fiche par bien (vente ou location, type, ville, quartier, prix souhaité, surface, pièces, situation foncière déclarée, quelques photos) ; les biens arrivent en brouillon, marqués « proposé par le propriétaire », invisibles sur le site ; tâche pour l'agent ; vérification foncière et mandat avant publication, comme aujourd'hui.
9. **Petits manques** : changement d'agent depuis la fiche client ; glisser-déposer du pipeline (option).
10. **Technique** : processus de file d'attente en production (prérequis des envois de messages), sauvegardes vérifiées, essai de restauration.

Estimation : **90 à 120 h**.

---

## 4. Conception de la phase 2

Chaque module se livre et se met en service seul. Les numéros (A1, A2…) servent de référence pour la suite.

### Module A — Espace client

**Pour qui** : propriétaires, locataires, clients travaux, acheteurs ou locataires en recherche. **Connexion** par numéro de téléphone et code à usage unique envoyé par SMS (ou WhatsApp), sans mot de passe à retenir ; le client n'a accès qu'à ce qui le concerne (fiche client existante). L'agence active ou désactive l'accès de chaque client.

- A1 — Accueil : ses biens, baux, chantiers, factures, ce qui reste à payer.
- A2 — **Propriétaire** : état de chaque bien confié (en vérification, publié, visites, offres, loué, vendu), visites et retours des visiteurs, mandat et échéance, loyers encaissés, relevés de gérance et reversements en PDF, documents du bien.
- A3 — Propriétaire : proposer un nouveau bien depuis son espace (reprend le formulaire du lot 6, déjà rempli de son identité).
- A4 — **Locataire** : bail, échéancier, quittances, reste à payer, état des lieux, demande d'intervention (module E), paiement en ligne (module B).
- A5 — **Client travaux** : devis à accepter ou refuser en ligne (avec signature, module D), suivi du chantier (reprend le lien de suivi), situations et factures, paiements.
- A6 — **Recherche d'un bien** : critères de recherche, biens favoris, alertes quand un bien correspondant est publié (rapprochement existant).
- A7 — Documents à télécharger (factures, reçus, quittances, procès-verbaux) et messagerie simple avec son agent (fil de messages relié à la fiche client).

Règles : rien d'interne n'est visible (notes privées, coûts, marges, pièces d'identité des autres) ; chaque connexion et chaque téléchargement sont journalisés (loi 2008-12) ; accès coupé dès que la fiche est archivée.

Dépend de : envoi de SMS (module C) pour le code de connexion. Estimation : **160 à 220 h**.

### Module B — Paiement en ligne

- B1 — Bouton « Payer » sur une facture, un appel de loyer ou un acompte (espace client, lien envoyé par WhatsApp) : Wave, Orange Money, Free Money, carte bancaire selon le prestataire.
- B2 — Rapprochement automatique : la confirmation du prestataire enregistre l'encaissement sur la facture (référence de transaction, reçu, quittance si le loyer est soldé), sans saisie.
- B3 — Suivi des paiements en ligne : en attente, réussis, échoués, frais retenus ; écarts signalés au comptable.
- B4 — Paiement depuis l'étranger (diaspora) par carte ou mobile money international, selon le prestataire.

Choix technique proposé : un **agrégateur de paiement sénégalais** (une seule intégration pour Wave, Orange Money, Free Money et la carte) plutôt que chaque opérateur séparément ; prestataire à choisir sur les frais par transaction et les délais de reversement. Estimation : **60 à 90 h**, plus les frais par transaction.

### Module C — Messages automatiques

- C1 — **WhatsApp Business** (API) : envoi des factures, quittances, reçus et devis en PDF, rappels de loyer et relances d'impayés, confirmations et rappels de visite, avancement de chantier ; modèles de messages validés par Meta.
- C2 — **SMS** : codes de connexion (module A), rappels pour les clients sans WhatsApp.
- C3 — **E-mail** : documents pour les clients qui le demandent (diaspora, entreprises).
- C4 — Réglages : canal préféré par client, accord du client pour les messages automatiques, plages horaires, coupure par type de message.
- C5 — Historique des envois sur la fiche client (envoyé, remis, échoué), sans suivi de lecture des e-mails.

Les relances restent d'abord des tâches pour l'agent (D-042) ; l'envoi automatique est une option activée par type de message. Coûts : facturation par conversation WhatsApp et par SMS, à demander aux fournisseurs. Estimation : **60 à 90 h**.

### Module D — Signature électronique simple

- D1 — Signature à l'écran (téléphone ou tablette) sur place : état des lieux, procès-verbal de réception, bon de livraison.
- D2 — Signature à distance par lien et code reçu par SMS : devis, mandat, bail, avenant.
- D3 — Preuve jointe au PDF : nom, téléphone, date et heure, empreinte du document ; document figé après signature.

Une signature électronique simple avec code par SMS suffit pour ces documents ; cadre juridique à confirmer avec un juriste (loi n° 2008-08 sur les transactions électroniques). Les actes de vente restent signés chez le notaire. Pas de signature qualifiée (certificats payants, peu utile ici). Estimation : **50 à 70 h**.

### Module E — Interventions : SAV, garanties, maintenance

Réunit le « SAV et garanties » du cahier des charges et les pannes des biens loués : une même mécanique de demande, intervention, coût.

- E1 — Demande d'intervention : par le locataire ou le client (espace client), par WhatsApp ou par l'agent ; photos, urgence, bien ou chantier concerné.
- E2 — Prise en charge : affectation à un technicien ou un tâcheron, date d'intervention, suivi sur l'appli terrain (photos avant et après, hors ligne).
- E3 — **Garanties après réception** (à partir du procès-verbal du lot 6) : levée des réserves, garantie de parfait achèvement, garanties biennale et décennale ; durées et règles à confirmer avec un juriste ; alerte avant la fin de chaque garantie.
- E4 — Qui paie : sous garantie (coût imputé au chantier d'origine), à la charge du propriétaire (déduit du prochain reversement de gérance) ou du locataire (facturé), ou de l'agence.
- E5 — Clôture avec accord du demandeur ; historique des interventions par bien et par chantier.

Estimation : **90 à 130 h**.

### Module F — Trésorerie et objectifs

- F1 — **Prévisionnel à 30 et 90 jours** : encaissements attendus (échéances des factures, loyers à appeler, situations prévues) et décaissements (fournisseurs, reversements aux propriétaires, tâcherons), solde prévu par semaine.
- F2 — **Objectifs** de chiffre d'affaires par activité et par mois (option : par agent), comparés au réalisé dans le tableau de bord.
- F3 — Pointage bancaire (sous condition) : import du relevé de la banque, rapprochement des virements avec les encaissements et les paiements fournisseurs.

Estimation : **60 à 90 h** (dont environ 30 h pour F3).

### Module G — Négoce avancé

- G1 — **Commandes fournisseurs** : bon de commande PDF envoyé au fournisseur, réception totale ou partielle qui crée l'achat (entrée en stock), reliquats suivis.
- G2 — Proposition de réapprovisionnement : articles sous le seuil avec quantité suggérée jusqu'au stock maximum, regroupés par fournisseur habituel.
- G3 — **Statistiques** dans le pilotage : rotation du stock, articles les plus vendus, marge par article et par catégorie, articles dormants.
- G4 — Devis et proforma de matériaux pour les clients du négoce (transformés en vente au comptoir).
- G5 — **Plusieurs dépôts** (sous condition) : stock par dépôt, transferts entre dépôts, inventaire par dépôt (environ 40 h de plus).

Estimation : **60 à 80 h**, plus G5 si besoin.

### Module H — Dossier technique et autorisations du chantier

Version utile de « Ingénierie et plans » pour une agence qui sous-traite ou fait faire la conception.

- H1 — Plans et documents techniques par chantier, avec versions (plans d'architecte, études de sol, notes de calcul, descriptifs) ; la dernière version est mise en avant, les anciennes restent consultables.
- H2 — **Autorisations** : liste de contrôle par chantier (permis de construire, autorisations de la mairie et des services concernés), dates de dépôt et d'obtention, pièces, alertes de délais, sur le modèle de la vérification foncière.
- H3 — Partage avec le client dans son espace (plans validés, permis obtenu).

Estimation : **40 à 60 h**.

### Module I — Notifications et aide

- I1 — **Centre de notifications** dans le back-office : tâches attribuées, paiements en ligne reçus, demandes d'intervention, alertes (budget, stock, garanties).
- I2 — **Notifications push** sur téléphone via l'application installée (sans store).
- I3 — **Abonnement agenda** : visites, tâches et interventions dans Google Agenda ou l'agenda du téléphone (lien en lecture seule).
- I4 — **Aide intégrée** : un guide court par écran et par rôle, accessible depuis l'écran ; les vidéos sont enregistrées à la formation.

Estimation : **40 à 60 h**.

---

## 5. Ce qu'on enlève

| Fonctionnalité | Pourquoi | Ce qui la remplace |
| --- | --- | --- |
| Application mobile native (6 fonctions) | Deux développements (Android, iOS), publications et validations des stores, mises à jour plus lentes | L'application web installable (déjà hors ligne pour le terrain) et les notifications push (I2) |
| Accusés de lecture des e-mails | Canal peu utilisé ; suivi bloqué par les messageries, donc trompeur | Statut d'envoi et de remise des messages (C5) |
| Tutoriels vidéo comme développement | Ce n'est pas du logiciel ; le chiffrage d'origine (4 h pour 12 vidéos) était irréaliste | Guides intégrés (I4) et vidéos enregistrées pendant la formation |
| Calculs d'ingénierie, CAO, métrés automatiques | Métier des logiciels d'architecte et d'ingénieur | Dossier technique et autorisations (module H) |
| Lead scoring automatique | Peu de prospects, scoring peu fiable | Statut choisi par l'agent et date du dernier contact (existant) |
| Fusion des doublons | Le téléphone unique empêche les doublons | Outil ponctuel après la reprise des données (lot 6) |
| ElasticSearch, PostGIS | Volumes qui ne le justifient pas, maintenance en plus | Recherche SQL et coordonnées simples (existant) |
| Signature électronique qualifiée | Coût des certificats, inutile pour ces documents | Signature simple avec code par SMS (module D) |
| Synchronisation bidirectionnelle Google Agenda | Complexe à maintenir | Abonnement agenda en lecture (I3) |

---

## 6. Découpage et ordre proposé

| Ordre | Lot | Contenu | Estimation | Dépend de |
| --- | --- | --- | --- | --- |
| 0 | Lot 6 | Consolidation, reprise des données, formulaire « Proposer mes biens » | 90-120 h | — |
| 1 | C | Messages automatiques (SMS au minimum) | 60-90 h | Contrats WhatsApp Business et SMS |
| 2 | A | Espace client | 160-220 h | C (codes par SMS) |
| 3 | B | Paiement en ligne | 60-90 h | A, contrat avec un agrégateur |
| 4 | D | Signature électronique | 50-70 h | C |
| 5 | E | Interventions, SAV, garanties | 90-130 h | Lot 6 (procès-verbal), A |
| 6 | F | Trésorerie et objectifs | 60-90 h | — |
| 7 | G | Négoce avancé | 60-80 h (+40 h dépôts) | — |
| 8 | H | Dossier technique et autorisations | 40-60 h | — |
| 9 | I | Notifications et aide | 40-60 h | — |

Total phase 2 : **environ 620 à 890 h** (plus 40 h avec plusieurs dépôts), lot 6 en plus. Ce sont des ordres de grandeur à affiner une fois les choix ci-dessous faits. Ils ne comprennent pas les coûts des services externes : SMS, conversations WhatsApp, frais de paiement, et éventuellement le stockage des fichiers chez un hébergeur.

Les modules F, G, H et I sont indépendants : ils peuvent être avancés ou retirés selon les priorités de l'agence sans toucher aux autres.

---

## 7. Décisions attendues du client

1. Ordre des priorités entre les modules ; en particulier : l'espace client est-il la priorité, et pour quels clients d'abord (propriétaires, locataires, clients travaux) ?
2. Budget mensuel accepté pour les messages (SMS, WhatsApp) et choix du prestataire de paiement en ligne (frais, délais de reversement).
3. Les clients paient-ils déjà en ligne ailleurs ? Part de la diaspora parmi les clients ?
4. L'agence a-t-elle ou prévoit-elle plusieurs dépôts (module G5) ?
5. Fait-elle elle-même des études et plans, ou les sous-traite-t-elle (module H) ? Quelles autorisations suit-elle pour ses chantiers ?
6. Garanties pratiquées après réception et leurs durées (avec son juriste) ; qui intervient en maintenance des biens loués ?
7. Banque utilisée et format des relevés (module F3).
8. Accord pour retirer l'application native au profit de l'application installable.
