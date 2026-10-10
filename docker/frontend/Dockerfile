# syntax=docker/dockerfile:1
# Site vitrine et back-office React. Contexte de construction : la racine du dépôt.
#   dev  : serveur Vite, code monté depuis ./frontend (compose.yaml)
#   prod : fichiers construits servis par Caddy, qui relaie aussi l'API
#          vers PHP-FPM et gère le HTTPS (compose.prod.yaml)

# --- Développement ---------------------------------------------------------
FROM node:22-alpine AS dev

# Même identifiant que l'utilisateur de la machine : Vite écrit des fichiers
# temporaires dans ./frontend. node_modules vit dans un volume Docker.
ARG UID=1000
ARG GID=1000
WORKDIR /app
RUN mkdir -p node_modules /home/app && chown "$UID:$GID" node_modules /home/app
COPY --chmod=755 docker/frontend/dev-entrypoint.sh /usr/local/bin/borom-dev-entrypoint
USER ${UID}:${GID}
ENV HOME=/home/app
ENTRYPOINT ["borom-dev-entrypoint"]
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]


# --- Construction -------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build


# --- Production --------------------------------------------------------------
FROM caddy:2.10-alpine AS prod

COPY docker/frontend/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv/www
