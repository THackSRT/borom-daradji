#!/bin/sh
# Démarrage du conteneur de développement de l'API (compose.yaml).
# Seul le serveur (php artisan serve) prépare le projet ; le planificateur
# attend qu'il soit prêt (depends_on: service_healthy).
set -e
cd /var/www/html

if [ "$2" = "artisan" ] && [ "$3" = "serve" ]; then
    # Dépendances PHP : au premier démarrage, puis quand composer.lock change.
    if [ ! -f vendor/autoload.php ] || [ composer.lock -nt vendor/autoload.php ]; then
        composer install --no-interaction --no-progress
        touch vendor/autoload.php
    fi

    if [ ! -f .env ]; then
        cp .env.example .env
    fi
    if ! grep -q '^APP_KEY=base64:' .env; then
        php artisan key:generate --no-interaction
    fi

    # Base vide : migrations et données de démo ; sinon migrations seules.
    if php artisan migrate:status >/dev/null 2>&1; then
        php artisan migrate --force
    else
        php artisan migrate --force --seed
    fi
    php artisan borom:sync-permissions

    # Lien relatif : valable dans le conteneur comme sur la machine.
    if [ -L public/storage ] || [ ! -e public/storage ]; then
        ln -sfn ../storage/app/public public/storage
    fi
fi

exec "$@"
