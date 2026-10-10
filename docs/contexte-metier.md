# Contexte métier

## Le client

**Borom Daradji** est une agence basée à Dakar qui exerce trois activités :

| Activité | Ce qu'elle recouvre |
| --- | --- |
| Immobilier | Vente et location de terrains, maisons, villas, appartements, locaux ; **gestion locative pour le compte de propriétaires** ; mandats |
| Travaux | Construction et rénovation multi-métiers (maçonnerie, plomberie, électricité, carrelage, menuiserie, climatisation…), avec équipes internes et tâcherons |
| Négoce | Vente de matériaux (ciment, fer, sable, graviers, peinture…) aux clients et approvisionnement des chantiers |

Le site vitrine actuel (`THackSRT/borom-daradji-properties`) annonce déjà ces services, dont la « gestion locative » et l'« état des lieux ». Ses coordonnées (téléphone, adresse) sont fictives.

## Utilisateurs

| Code | Rôle (valeur stockée) | Usage principal |
| --- | --- | --- |
| DIR | `dirigeant` | Accès total ; seul à gérer les comptes, les paramètres et le journal |
| AGT | `agent` | Biens, mandats, prospects, visites, baux |
| RES | `responsable_travaux` | Chantiers, devis, équipes, stock |
| CPT | `comptable` | Factures, encaissements, exports |
| COM | `commercial` | Prospection, devis, relances |
| CLI | aucun compte | Visiteurs du site et clients ; accès en lecture par lien privé (suivi de chantier) |

Petite équipe (estimation : 5 à 10 comptes). **Une même personne cumule souvent plusieurs rôles** : les rôles sont donc cumulables sur un compte.

## Réalités du terrain qui guident la conception

| Réalité | Conséquence dans le logiciel |
| --- | --- |
| Prospects et clients écrivent sur **WhatsApp**, rarement par email | Liens WhatsApp pré-remplis (`https://wa.me/221XXXXXXXXX?text=…`) sur chaque bien, client, facture. Rappels par WhatsApp ou SMS plutôt que par email. API WhatsApp Business seulement en phase 2. |
| Le **numéro de téléphone identifie le client** | Numéro normalisé `+221XXXXXXXXX` et unique ; le doublon est bloqué à la saisie. |
| Paiements en **espèces et mobile money** (Wave, Orange Money, Free Money / Mixx by Yas), souvent fractionnés | Encaissement multi-modes avec référence de transaction et capture d'écran ; reçu immédiat ; caisse journalière par personne. Pas de rapprochement bancaire par import CSV en phase 1. |
| **Le foncier est le premier risque** : titre foncier, bail, délibération, acte administratif ; doubles ventes et litiges | Statut juridique obligatoire sur chaque bien ; liste de vérification (état des droits réels, pièces du vendeur, plan…) ; **un bien non vérifié ne peut pas être publié**. |
| La **gestion locative** est un revenu récurrent, absente du cahier des charges v2.0 | Module location : baux, appels de loyer mensuels, quittances, arriérés, état des lieux avec photos, reversement au propriétaire moins la commission. |
| Une part des clients **fait construire ou achète depuis l'étranger** (diaspora) | Lien privé de suivi de chantier (photos datées, avancement, paiements) envoyé par WhatsApp. |
| Sur les chantiers, des **tâcherons** payés à la tâche ou à la journée ; le chef de chantier **achète sur place en espèces** | Pointage simple, avances et paiements des tâcherons, caisse de chantier avec photo du reçu. Coût réel = main-d'œuvre + matériaux + caisse. |
| Équipe terrain sur **smartphone Android**, 4G instable, coupures | Application web installable (PWA), photos compressées, saisies gardées hors ligne puis synchronisées. |
| Comptabilité tenue par un **cabinet externe**, référentiel **SYSCOHADA** | Exports Excel propres (ventes, encaissements, achats) avec numéros de compte paramétrables ; pas de comptabilité intégrée. |
| **Prix des matériaux variables** d'une livraison à l'autre | Valorisation au coût moyen unitaire pondéré (CMUP), historique des prix, prix de vente modifiable au comptoir. |
| Le logiciel stocke des **pièces d'identité** (CNI, passeports) | Loi sénégalaise n° 2008-12 sur les données personnelles, déclaration à la CDP (Commission de protection des données personnelles). Pièces visibles du seul dirigeant et de l'agent concerné ; chaque consultation est tracée. |

## Repères réglementaires et fiscaux

À confirmer avec le comptable du client avant d'implémenter la facturation (lot 2) :

- **TVA : 18 %** (valeur par défaut, paramétrable dans les paramètres de l'entreprise).
- Devise : **franc CFA BCEAO, code `XOF`**, sans centimes.
- Identifiants de l'entreprise sur les documents : **NINEA** et **RCCM**.
- Numérotation des factures **continue et sans trou** (exigence citée dans la v2.0).
- Conservation des factures : 10 ans (mention citée dans la v2.0).
- Le cahier des charges v2.0 cite le RGPD ; le texte applicable au Sénégal est la **loi n° 2008-12**.
- Points non vérifiés, à poser au comptable : TVA applicable à chaque activité (loyers, travaux, négoce), mentions obligatoires sur les factures, enregistrement des baux aux impôts, retenues à la source éventuelles.

## Glossaire

| Terme | Sens |
| --- | --- |
| Titre foncier (TF) | Titre de propriété définitif, inscrit à la Conservation foncière |
| État des droits réels | Document de la Conservation foncière listant propriétaire, hypothèques et charges d'un TF ; base de la vérification avant une vente |
| Délibération | Affectation d'un terrain du domaine national par une commune ; droit d'usage, pas un titre de propriété |
| Bail (emphytéotique) | Droit d'occupation de longue durée sur un terrain de l'État |
| NINEA | Numéro d'identification national des entreprises et des associations |
| RCCM | Registre du commerce et du crédit mobilier |
| Tâcheron | Artisan ou ouvrier payé à la tâche ou à la journée, souvent en espèces |
| Caution / avance | Pour une location : dépôt de garantie (en mois de loyer) et loyers payés d'avance à l'entrée |
| Quittance | Reçu de paiement d'un loyer |
| Reversement | Somme versée au propriétaire après encaissement des loyers, moins la commission de l'agence |
| CMUP | Coût moyen unitaire pondéré, méthode de valorisation du stock retenue |
| SYSCOHADA | Système comptable des pays de l'OHADA, utilisé au Sénégal |
