# Insurance Portal Web

Standalone frontend service for the Insurance Portal microservice architecture.

## Service details

- Service name: `insurance-portal-web`
- Port: `9092`
- Frontend URL: `http://localhost:9092`
- Backend portal service URL: `http://localhost:9090`
- API base path: `/api/v1`

## Installation

```bash
cd apps/insurance-portal-web
npm install
```

## Environment setup

Copy `.env.example` to `.env` and update values as needed.

```bash
cp .env.example .env
```

### Important env values

- `VITE_APP_NAME` — application display name
- `VITE_APP_ENV` — `development` or `production`
- `VITE_APP_PORT` — frontend port
- `VITE_API_BASE_URL` — backend API base URL
- `VITE_AUTH_API_URL` — auth-specific API endpoint
- `VITE_FILE_UPLOAD_API_URL` — file upload API endpoint
- `VITE_TIRAMIS_API_URL` — TIRAMIS service URL
- `VITE_WEBSOCKET_URL` — WebSocket URL

## Development

Run the service locally on port `9092`:

```bash
npm run dev
```

Or use the alias command:

```bash
npm run start
```

## Production build

```bash
npm run build:prod
```

## Preview production build

```bash
npm run preview
```

## Notes

- The frontend uses `src/api/client.ts` with a centralized `VITE_API_BASE_URL`.
- The backend portal service must allow CORS from `http://localhost:9092`.
- Authentication and token refresh are handled centrally in `src/api/client.ts`.
- Existing routes, auth flow, and UI behavior are preserved.

## Troubleshooting

- If the app does not start on port `9092`, verify `vite.config.ts` contains `server.port: 9092`.
- If API calls fail, verify `.env` contains the correct `VITE_API_BASE_URL` and the backend is running on `http://localhost:9090`.
- For CORS issues, ensure the backend `CORS_ALLOWED_ORIGINS` includes `http://localhost:9092`.

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
