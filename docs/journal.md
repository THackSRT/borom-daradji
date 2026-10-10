# Journal de suivi

**À lire en premier par toute nouvelle session.** Mettre à jour à la fin de chaque session : l'état actuel, puis une entrée datée en haut de l'historique.

## État actuel

- **Lot en cours** : lot 0 (socle) — API terminée, front non commencé.
- **Branche** : `lot-0-socle` (seule branche du dépôt ; `main` n'existe pas encore).
- **Tests** : 39 tests, tous verts (`cd backend && php artisan test`).
- **Déploiement** : aucun serveur pour l'instant.

## Prochaines actions, dans l'ordre

1. Créer `main` à partir de `lot-0-socle` et en faire la branche par défaut sur GitHub (à demander à l'utilisateur avant de le faire).
2. Traduire en français les messages de validation génériques de Laravel (`lang/fr/validation.php`).
3. Lot 1, côté API : modèles, migrations et routes décrits dans [`perimetre-et-lots.md`](perimetre-et-lots.md#lot-1--biens-et-prospects-prochain-lot), en commençant par `clients` et `properties` (le reste en dépend).
4. Créer `frontend/` en reprenant le code de `THackSRT/borom-daradji-properties`, brancher le site sur `GET /api/public/properties`, puis le back-office (connexion, comptes, paramètres pour clore le lot 0).

## Questions ouvertes pour le client

Les trois premières bloquent le lot 2. Noter la réponse et la date ici quand elle arrive.

- [ ] L'agence gère-t-elle des biens pour des propriétaires (encaissement et reversement des loyers) ? Combien de baux, quel taux de commission ?
- [ ] Conditions habituelles de location : mois de caution, d'avance, commission d'agence.
- [ ] Les baux sont-ils enregistrés aux impôts, et par qui ?
- [ ] Liste des points de vérification foncière à exiger avant publication d'un bien (proposition par défaut dans le lot 1).
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

### 2026-10-10 — Analyse, proposition, lot 0

- Analysé le site existant `borom-daradji-properties` (React/Vite/shadcn généré par Lovable, données en dur, formulaires sans envoi, admin factice, bug du filtre par quartier, métadonnées Lovable dans `index.html`).
- Analysé le cahier des charges v2.0 et le chiffrage du client ; erreurs listées dans [`sources.md`](sources.md).
- Rédigé une proposition révisée adaptée au terrain (gestion locative, foncier, mobile money, WhatsApp, diaspora, tâcherons, hors ligne) : 6 lots, 1 270 h. Contenu repris dans `docs/`.
- Choix de Laravel validé par l'utilisateur après comparaison avec Spring Boot et AdonisJS (D-002).
- Implémenté le lot 0 côté API : authentification, rôles, comptes, paramètres de l'entreprise, journal d'activité, commande `borom:create-director`, seeder de démo, 39 tests, CI GitHub. Commit `cf6c425` poussé sur `lot-0-socle`.
- Rédigé cette documentation de reprise (`CLAUDE.md`, `docs/`).
