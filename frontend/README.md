# Frontend — site vitrine et back-office

React + Vite + TypeScript + Tailwind + shadcn/ui, repris du site `borom-daradji-properties` (charte bleu marine et or).

| Partie | Chemin | Contenu |
| --- | --- | --- |
| Site vitrine | `/`, `/biens`, `/travaux`, `/contact` | Pages publiques (`src/pages`, `src/components`) |
| Back-office | `/admin` | Écrans internes (`src/admin`), connexion par jeton à l'API Laravel |

## Développement

```sh
# Terminal 1 : l'API
cd backend && php artisan serve

# Terminal 2 : le front (http://localhost:8080, /api relayé vers http://localhost:8000)
cd frontend
npm ci
npm run dev
```

Back-office : http://localhost:8080/admin — comptes de démo dans le README principal.

## Vérifications

```sh
npm run typecheck
npm run lint
npm run build
```

En production, servir `dist/` et l'API sur le même domaine (`/api`), ou définir `VITE_API_URL` au moment du build.
