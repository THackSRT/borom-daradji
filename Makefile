# Raccourcis Docker. « make » ou « make help » liste les commandes.
# Sans make (Windows) : recopier la commande docker compose de la cible voulue.

export UID := $(shell id -u 2>/dev/null || echo 1000)
export GID := $(shell id -g 2>/dev/null || echo 1000)

DEV  = docker compose
PROD = docker compose -f compose.prod.yaml --env-file .env.prod
STAMP := $(shell date +%Y%m%d-%H%M%S)

.DEFAULT_GOAL := help
.PHONY: help up down logs sh artisan fresh test test-mysql check \
	prod-key prod-up prod-down prod-logs prod-director prod-artisan prod-backup

help: ## Liste des commandes
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  make %-14s %s\n", $$1, $$2}'

# --- Développement -----------------------------------------------------------

up: ## Démarre l'environnement de dev (http://localhost:8080)
	$(DEV) up -d --build
	@echo "Site et back-office : http://localhost:8080 (premier démarrage : quelques minutes, voir make logs)"

down: ## Arrête l'environnement de dev (les données restent)
	$(DEV) down

logs: ## Suit les journaux des conteneurs de dev
	$(DEV) logs -f

sh: ## Ouvre un terminal dans le conteneur de l'API
	$(DEV) exec backend sh

artisan: ## Lance une commande artisan : make artisan c="route:list"
	$(DEV) exec backend php artisan $(c)

fresh: ## Recrée la base de dev avec les données de démo
	$(DEV) exec backend php artisan migrate:fresh --seed --force

test: ## Tests et formatage de l'API (SQLite en mémoire)
	$(DEV) exec backend php artisan test
	$(DEV) exec backend vendor/bin/pint --test

test-mysql: ## Tests de l'API sur MySQL (base borom_test, séparée)
	$(DEV) exec backend sh -c 'sed -e "s/value=\"sqlite\"/value=\"mysql\"/g" -e "s/value=\":memory:\"/value=\"borom_test\"/g" phpunit.xml > phpunit.mysql.xml && php artisan test --configuration=phpunit.mysql.xml; status=$$?; rm -f phpunit.mysql.xml; exit $$status'

check: test ## Toutes les vérifications avant un commit (API et front)
	$(DEV) exec frontend npm run typecheck
	$(DEV) exec frontend npm run lint
	$(DEV) exec frontend npm run build

# --- Production --------------------------------------------------------------

prod-key: ## Génère une APP_KEY à copier dans .env.prod
	@docker run --rm php:8.3-fpm-alpine php -r 'echo "APP_KEY=base64:".base64_encode(random_bytes(32)).PHP_EOL;'

prod-up: ## Construit et démarre la production
	$(PROD) up -d --build

prod-down: ## Arrête la production (les données restent)
	$(PROD) down

prod-logs: ## Suit les journaux de production
	$(PROD) logs -f

prod-director: ## Crée le premier compte dirigeant
	$(PROD) exec app php artisan borom:create-director

prod-artisan: ## Lance une commande artisan en production : make prod-artisan c="about"
	$(PROD) exec app php artisan $(c)

prod-backup: ## Sauvegarde la base et les fichiers dans ./backups
	mkdir -p backups
	$(PROD) exec -T db sh -c 'exec mysqldump --single-transaction --routines -uroot -p"$$MYSQL_ROOT_PASSWORD" "$$MYSQL_DATABASE"' | gzip > backups/base-$(STAMP).sql.gz
	$(PROD) exec -T app tar -czf - -C /var/www/html storage/app > backups/fichiers-$(STAMP).tar.gz
	@echo "Sauvegarde : backups/base-$(STAMP).sql.gz et backups/fichiers-$(STAMP).tar.gz"
