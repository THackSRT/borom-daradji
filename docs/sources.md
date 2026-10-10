# Documents sources

Le client a fourni deux documents, qui ne sont **pas versionnés dans ce dépôt** (ils sont marqués « Confidentiel ») :

- `BOROM_DARADJI_Modules_Fonctionnalites_Acteurs.docx` — cahier des charges fonctionnel, version 2.0 du 13 février 2026 ;
- `BOROM_DARADJI_Quotas_Horaires_Template.xlsx` — chiffrage en heures.

Ce fichier en résume le contenu utile et les erreurs relevées. Demander les originaux à l'utilisateur si un détail manque.

Une proposition révisée a aussi été rédigée pour le client (document Claude privé, accessible seulement depuis le compte de l'utilisateur). Son contenu est repris dans [`contexte-metier.md`](contexte-metier.md), [`perimetre-et-lots.md`](perimetre-et-lots.md) et [`architecture.md`](architecture.md).

## Cahier des charges v2.0 (docx)

125 fonctions en phase 1, 22 en phase 2, réparties en 6 modules, avec une matrice d'accès par acteur (DIR, AGT, RES, CPT, COM, CLI) : ✅ complet, 👁️ lecture, ❌ aucun.

| Module | Fonctions | Contenu |
| --- | --- | --- |
| 1. Biens immobiliers | 13 | Fiche bien, photos (20, WebP), modification historisée, archivage, recherche multicritères, carte Leaflet, mandats (alerte J-7), workflow de statut, documents PDF, historique, export, site vitrine, rapprochement biens-prospects |
| 2. CRM | 17 | Fiche client (CNI, solvabilité A/B/C, tags), lead scoring, critères prospect, journal des échanges, visites et comptes-rendus, calendrier, relances J+3/J+7/J+30, rappels, vue 360°, notes privées, import/export, fusion des doublons |
| 3. Travaux | 22 | Chantiers, statuts, devis multi-lots (catalogue de corps de métier), modèles, PDF, envoi, suivi des devis, planning, équipes, avancement par lot, photos géolocalisées, journal, livraisons, PV de réception, budget prévu/réel, alertes |
| 4. Stock | 20 | Articles, entrées, sorties (chantier, vente, perte), transferts, inventaire, tableau de bord, alertes, historique, statistiques, valorisation, fournisseurs, commandes, import Excel, export |
| 5. Facturation et trésorerie | 27 | Devis → facture, acomptes, situations, solde, avoirs, numérotation sans trou, PDF (NINEA, TVA 18 %, Wave/Orange Money), envoi, SMS, paiements, échéancier, relances J-7/J+3/J+15/J+30, pointage bancaire, tableaux de bord CA, impayés, prévisionnel 30 jours, exports compatibles Sage/Ciel, balances, objectifs |
| 6. Administration | 26 (10 détaillées) | Utilisateurs, rôles et permissions, tableau de bord, notifications, recherche globale, carte, journal d'audit (1 an), paramètres entreprise, aide contextuelle, tutoriels vidéo |

Phase 2 annoncée : ingénierie et plans (5), SAV et garanties (4), application mobile (6), espace client (7).

## Chiffrage (xlsx)

749 h pour 90 fonctions détaillées (sur 125), 899 h avec 20 % de marge, réparties en sprints 1 à 6 ; annonce 14 semaines en 7 sprints de 2 semaines avec 2 développeurs. Les sommes par ligne et par module sont exactes, mais saisies en dur, sans formules.

## Erreurs et incohérences relevées

1. 35 fonctions sur 125 ne sont pas chiffrées (modules 4, 5, 6), alors que le total est présenté comme couvrant les 125.
2. Deux totaux contradictoires : 899 h (récapitulatif) et « ≈ 750-800 h, 18-20 semaines » (note de la feuille détaillée).
3. Charge par sprint déséquilibrée : 192 h au sprint 1 et 171,5 h au sprint 4 pour une capacité de 160 h ; 42 h au sprint 6 ; 6 sprints utilisés pour 7 annoncés.
4. Dépendances inversées : tableau de bord global au sprint 1, vue client 360° (devis, factures) au sprint 2, vente directe générant une facture au sprint 4 alors que la facturation est au sprint 5.
5. Postes absents : déploiement, maquettes, reprise des données, recette, formation, gestion de projet ; tests à 10 % seulement.
6. Estimations irréalistes : 4 h pour 12 tutoriels vidéo, 13,5 h pour des permissions par module, action et donnée.
7. Valorisation du stock (4.16) : « FIFO » puis « prix moyen pondéré », deux méthodes différentes.
8. « 15 corps de métier » (3.10) mais 14 listés ; la peinture, proposée sur le site, n'y figure pas.
9. Section 8 « Modules Phase 2 » annoncée au sommaire mais absente ; module 6 détaillé sur 10 fonctions sur 26.
10. Récapitulatif par acteur contradictoire avec le détail (ex. : agent noté « lecture » sur le stock et la facturation alors qu'il n'a aucun accès à la plupart des fonctions).
11. Acteur client décrit comme « visiteur externe » mais ayant accès à des factures et des PV, ce qui suppose un compte.
12. Fonctions de phase 2 comptées en phase 1 : 4.9, 4.18, 5.10, signature de 3.18.
13. Référence au RGPD au lieu de la loi sénégalaise n° 2008-12 ; coquille « IMMOBILIERRE » dans le titre.
14. Notes techniques orientées PHP (TCPDF, PhpSpreadsheet) et lourdes (ElasticSearch, PostGIS) ; voir les simplifications dans [`perimetre-et-lots.md`](perimetre-et-lots.md).
15. **Absence de la gestion locative**, alors que le site du client la propose : ajoutée au lot 2.
