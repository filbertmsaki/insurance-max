# Tiramis Service

This repository now contains a single NestJS service: `tiramis`.

## Structure

- `apps/tiramis` - standalone service entrypoint, config, database, and modules
- `libs/shared-config` - shared config and database factories used by `tiramis`
- `libs/persistence` - shared base entity abstractions
- `libs/contracts` - reusable message patterns and integration contracts
- `libs/shared-kernel` - reusable technical helpers for future growth

## Useful commands

```bash
npm install
npm run build
npm run start
npm run start:dev
npm run test
npm run test:e2e
```

## Environment files

- `apps/tiramis/.env`
- `apps/tiramis/.env.example`

## Database migration

```bash
npm run migration:run:tiramis
```
