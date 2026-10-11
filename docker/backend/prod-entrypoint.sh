#!/bin/sh
# Démarrage de l'image de production (compose.prod.yaml).
# Le conteneur « app » (PHP-FPM) met en cache la configuration, applique les
# migrations et synchronise les permissions ; les autres commandes (planificateur,
# commandes artisan ponctuelles) démarrent directement.
set -e
cd /var/www/html

if [ "$1" = "php-fpm" ]; then
    if [ -z "$APP_KEY" ]; then
        echo "APP_KEY manquante dans .env.prod : la générer avec « make prod-key »." >&2
        exit 1
    fi

    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
    php artisan event:cache

    if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
        # La base peut mettre quelques secondes à accepter les connexions.
        tries=0
        until php artisan migrate --force; do
            tries=$((tries + 1))
            if [ "$tries" -ge 10 ]; then
                echo "Migrations impossibles : base de données injoignable." >&2
                exit 1
            fi
            sleep 3
        done
        php artisan borom:sync-permissions
    fi
fi

exec "$@"
