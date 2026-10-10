# syntax=docker/dockerfile:1
# Image PHP de l'API Laravel. Contexte de construction : la racine du dépôt.
#   dev  : outils de développement, code monté depuis ./backend (compose.yaml)
#   prod : code et dépendances intégrés, PHP-FPM (compose.prod.yaml)

FROM php:8.3-fpm-alpine AS base

# gd (photos converties en WebP, D-019), intl (montant en lettres des factures),
# zip, pdo_pgsql, opcache, pcntl (arrêt propre du planificateur), bcmath.
COPY --from=mlocati/php-extension-installer:2 /usr/bin/install-php-extensions /usr/local/bin/
RUN install-php-extensions gd intl zip pdo_pgsql opcache pcntl bcmath

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
COPY docker/backend/php.ini $PHP_INI_DIR/conf.d/zz-borom.ini

WORKDIR /var/www/html


# --- Développement ---------------------------------------------------------
FROM base AS dev

# Même identifiant que l'utilisateur de la machine : les fichiers créés dans
# ./backend (vendor, storage, .env) lui appartiennent. Identifiants numériques :
# pas de compte à créer, n'importe quel UID convient.
ARG UID=1000
ARG GID=1000
RUN mkdir -p /home/app && chown "$UID:$GID" /home/app

COPY --chmod=755 docker/backend/dev-entrypoint.sh /usr/local/bin/borom-dev-entrypoint
USER ${UID}:${GID}
ENV HOME=/home/app \
    PHP_CLI_SERVER_WORKERS=4
ENTRYPOINT ["borom-dev-entrypoint"]
# --no-reload obligatoire : sans lui, artisan serve retire au serveur PHP les
# variables du conteneur (DB_CONNECTION=pgsql…) et l'API retombe sur backend/.env.
# Il permet aussi plusieurs requêtes à la fois (PHP_CLI_SERVER_WORKERS). Après une
# modification de backend/.env : docker compose restart backend.
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000", "--no-reload"]


# --- Dépendances de production -----------------------------------------------
FROM base AS vendor

COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist \
    --no-scripts --no-autoloader


# --- Production --------------------------------------------------------------
FROM base AS prod

RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
COPY docker/backend/opcache-prod.ini $PHP_INI_DIR/conf.d/zz-opcache.ini

COPY --from=vendor /var/www/html/vendor ./vendor
COPY backend/ ./
RUN composer dump-autoload --optimize --no-dev --no-interaction \
    && mkdir -p storage/app/public storage/app/private storage/logs \
        storage/framework/cache/data storage/framework/sessions storage/framework/views \
    && chown -R www-data:www-data storage bootstrap/cache

COPY --chmod=755 docker/backend/prod-entrypoint.sh /usr/local/bin/borom-entrypoint

# Tout tourne sans les droits root, PHP-FPM compris.
USER www-data
ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr
ENTRYPOINT ["borom-entrypoint"]
CMD ["php-fpm"]
