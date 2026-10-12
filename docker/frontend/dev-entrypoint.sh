#!/bin/sh
# Démarrage du conteneur de développement du front (compose.yaml) :
# installe les dépendances au premier démarrage, puis quand package-lock.json change.
set -e
cd /app

stamp=node_modules/.package-lock.sha256
current=$(sha256sum package-lock.json | cut -d' ' -f1)
if [ ! -f "$stamp" ] || [ "$(cat "$stamp")" != "$current" ]; then
    npm ci --no-audit --no-fund
    echo "$current" > "$stamp"
fi

exec "$@"
