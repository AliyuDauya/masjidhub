# Milestone 1: Explorer 3 — Package Scripts, Environment Setup & Verification Command Matrix Report

## 1. Observation

### 1.1 Script Orchestration Across `package.json` Files

1. **Root `package.json` (`C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\package.json`)**:
   ```json
   {
     "name": "masjidhub-monorepo",
     "version": "1.0.0",
     "private": true,
     "description": "Unified multi-tenant administrative ecosystem for mosques",
     "scripts": {
       "test:backend": "npm --prefix backend test",
       "test:frontend": "npm --prefix frontend test",
       "test": "npm --prefix backend test && npm --prefix frontend test",
       "test:logic": "npm --prefix backend run test:node && npm --prefix frontend run test:node",
       "dev:backend": "npm --prefix backend run dev",
       "dev:frontend": "npm --prefix frontend run dev",
       "db:migrate": "npm --prefix backend run db:migrate",
       "db:generate": "npm --prefix backend run db:generate",
       "db:seed": "npm --prefix backend run db:seed",
       "db:setup": "npm --prefix backend run db:setup",
       "db:reset:demo": "npm --prefix backend run db:reset:demo"
     }
   }
   ```

2. **Backend `package.json` (`C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\backend\package.json`)**:
   ```json
   {
     "name": "backend",
     "version": "1.0.0",
     "description": "MasjidHub Backend API",
     "main": "src/server.ts",
     "type": "module",
     "scripts": {
       "dev": "tsx watch src/server.ts",
       "build": "tsc",
       "test": "vitest run",
       "test:node": "node test/standalone_runner.js",
       "db:migrate": "prisma migrate deploy",
       "db:generate": "prisma generate",
       "db:seed": "tsx prisma/seed.ts",
       "db:setup": "npm run db:migrate && npm run db:generate && npm run db:seed",
       "db:reset:demo": "prisma migrate reset --force"
     },
     "dependencies": {
       "@fastify/cors": "^9.0.1",
       "@fastify/helmet": "^11.1.1",
       "@fastify/jwt": "^8.0.1",
       "@fastify/rate-limit": "^9.1.0",
       "@prisma/client": "^5.14.0",
       "bcryptjs": "^2.4.3",
       "fastify": "^4.28.1",
       "fastify-plugin": "^4.5.1"
     },
     "devDependencies": {
       "@types/bcryptjs": "^2.4.6",
       "@types/node": "^20.12.12",
       "prisma": "^5.14.0",
       "tsx": "^4.11.0",
       "typescript": "^5.4.5",
       "vitest": "^1.6.0"
     }
   }
   ```

3. **Frontend `package.json` (`C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\frontend\package.json`)**:
   ```json
   {
     "name": "frontend",
     "version": "0.1.0",
     "private": true,
     "type": "module",
     "scripts": {
       "dev": "next dev",
       "build": "next build",
       "start": "next start",
       "lint": "eslint",
       "test": "vitest run",
       "test:node": "node __tests__/standalone_runner.js"
     },
     "dependencies": {
       "next": "16.2.10",
       "react": "19.2.4",
       "react-dom": "19.2.4"
     },
     "devDependencies": {
       "@tailwindcss/postcss": "^4",
       "@testing-library/react": "^16.0.0",
       "@types/node": "^20",
       "@types/react": "^19",
       "@types/react-dom": "^19",
       "@vitejs/plugin-react": "^4.3.0",
       "eslint": "^9",
       "eslint-config-next": "16.2.10",
       "jsdom": "^24.0.0",
       "tailwindcss": "^4",
       "typescript": "^5",
       "vitest": "^1.6.0"
     }
   }
   ```

### 1.2 Environment Variables & Datasource Configuration

1. **Prisma Datasource (`backend/prisma/schema.prisma:1-8`)**:
   ```prisma
   datasource db {
     provider = "sqlite"
     url      = "file:./masjidhub.db"
   }

   generator client {
     provider = "prisma-client-js"
   }
   ```
2. **Backend Seed Script (`backend/prisma/seed.ts:4-8`)**:
   ```typescript
   const prisma = new PrismaClient(
     process.env.DATABASE_URL
       ? { datasources: { db: { url: process.env.DATABASE_URL } } }
       : undefined
   );
   ```
3. **Backend Server (`backend/src/server.ts:25-27, 60`)**:
   ```typescript
   server.register(cors, {
     origin: process.env.CORS_ORIGIN || '*',
   });
   ...
   const port = Number(process.env.PORT) || 5000;
   ```
4. **Backend Auth Plugin (`backend/src/plugins/auth.ts:31-38`)**:
   ```typescript
   const secret = process.env.JWT_SECRET;
   if (!secret && process.env.NODE_ENV === 'production') {
     throw new Error('JWT_SECRET is required in production.');
   }
   fastify.register(fastifyJwt, {
     secret: secret || 'development-only-change-me',
     sign: { expiresIn: '8h' }
   });
   ```
5. **Frontend API Client (`frontend/src/lib/api.ts:1`)**:
   ```typescript
   export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
   ```
6. **Environment Template Files**:
   - `backend/.env.example`:
     ```
     JWT_SECRET="replace-with-a-long-random-secret"
     CORS_ORIGIN="http://localhost:3000"
     PORT=5000
     ```
   - `frontend/.env.example`:
     ```
     NEXT_PUBLIC_API_URL=http://localhost:5000
     ```

### 1.3 Prisma Baseline Migration & Seed State

1. **Migration directory (`backend/prisma/migrations/20250101000000_initial/migration.sql`)**: Contains baseline DDL creating tables: `Mosque`, `User`, `Membership`, `Donation`, `Announcement`, `Program`, `Registration`, `Notification`, `AuditEvent`.
2. **Migration lock (`backend/prisma/migrations/migration_lock.toml`)**: `provider = "sqlite"`.
3. **Seed script (`backend/prisma/seed.ts:31-36`)**:
   - Currently seeds `tenant_admin` and `member` roles for `al-noor` and `al-huda`.
   - Missing seed entries for `finance_officer`, `programme_officer`, and `communications_officer`.

---

## 2. Logic Chain

1. **Cross-Package Invocation Pattern**:
   - The root `package.json` acts as an orchestrator using `npm --prefix <package>` delegation.
   - Running `npm run db:migrate` from root invokes `npm --prefix backend run db:migrate`, which runs `prisma migrate deploy` inside `backend/`.
   - Because `--prefix backend` sets the working directory to `backend/`, Prisma executes in the context of `backend/`, finding `backend/prisma/schema.prisma` and reading `file:./masjidhub.db`.
   - SQLite resolves `./masjidhub.db` relative to `backend/prisma/`, producing `backend/prisma/masjidhub.db`.
   - When `db:seed` runs via `npm --prefix backend run db:seed` (`tsx prisma/seed.ts`), PrismaClient resolves the same database at `backend/prisma/masjidhub.db`.
   - Therefore, cross-package invocation from repository root is fully deterministic and consistent with running directly inside `backend/`.

2. **Environment Variable Fallback Resilience**:
   - In local development and CI testing without explicit `.env` files:
     - Prisma connects to `file:./masjidhub.db` by default.
     - Backend server defaults to `PORT=5000` and `CORS_ORIGIN='*'`.
     - Auth plugin defaults to `secret='development-only-change-me'` when `NODE_ENV !== 'production'`.
     - Frontend defaults `NEXT_PUBLIC_API_URL` to `http://localhost:5000`.
   - If custom DB paths or production deployments are required:
     - `DATABASE_URL` is supported dynamically in `seed.ts` via `{ datasources: { db: { url: process.env.DATABASE_URL } } }`.
     - `JWT_SECRET` is strictly enforced in production (`NODE_ENV === 'production'`).

3. **Orchestration Chains**:
   - `npm run db:setup` triggers `db:migrate && db:generate && db:seed`:
     1. `prisma migrate deploy`: applies `20250101000000_initial` baseline migration.
     2. `prisma generate`: creates TypeScript client artifacts in `backend/node_modules/@prisma/client`.
     3. `tsx prisma/seed.ts`: populates demo entities idempotently.
   - `npm run db:reset:demo` triggers `prisma migrate reset --force`:
     1. Drops all tables in `backend/prisma/masjidhub.db`.
     2. Re-applies all migrations in `backend/prisma/migrations/`.
     3. Automatically executes seed script via Prisma seed hook or manual step.

4. **Identified Enhancement Opportunities**:
   - **Seed Role Coverage**: `seed.ts` should be expanded to seed demo accounts for all 5 roles (`tenant_admin`, `finance_officer`, `programme_officer`, `communications_officer`, `member`) to satisfy R1 §3 and prepare for M3/M4 role workflows.
   - **Root Build Script**: Adding `"build": "npm --prefix backend run build && npm --prefix frontend run build"` to root `package.json` will allow single-command compilation verification across the monorepo.

---

## 3. Caveats

1. **Interactive Shell Permissions**: Direct execution of background commands during read-only exploration was not executed to avoid permission prompt blocking; all analyses are verified via direct inspection of package scripts, configuration files, and source code.
2. **Prisma Seed Config in `package.json`**: Prisma CLI `migrate reset` can automatically invoke a seed script if configured in `backend/package.json` under `"prisma": { "seed": "tsx prisma/seed.ts" }`. Currently `db:setup` explicitly runs `db:seed`, which is robust, but adding the `"prisma"` config block in `backend/package.json` provides an additional layer of automation.

---

## 4. Conclusion

- The monorepo script orchestration across root `package.json`, `backend/package.json`, and `frontend/package.json` is properly structured, using standard `npm --prefix` delegation.
- Environment variable defaults allow zero-config execution for local development and test runs while supporting production overrides (`JWT_SECRET`, `CORS_ORIGIN`, `PORT`, `DATABASE_URL`, `NEXT_PUBLIC_API_URL`).
- All Milestone 1 requirements (`db:migrate`, `db:generate`, `db:seed`, `db:setup`, `db:reset:demo`) are mapped to clean, reproducible npm commands.
- The verification command matrix below provides the exact verification procedure for acceptance criteria.

---

## 5. Verification Method (Milestone 1 Command Matrix)

The following matrix specifies the exact commands, execution directories, expected outcomes, and invalidation conditions for validating Milestone 1:

| AC ID | Target Scope | Command | Working Directory | Expected Result | Invalidation / Failure Conditions |
|---|---|---|---|---|---|
| **M1-V1** | Baseline Migration | `npm --prefix backend run db:migrate` (or `npm run db:migrate`) | Project Root | Exit code `0`. Output indicates `1 migration applied` or `No pending migrations`. SQLite database file `backend/prisma/masjidhub.db` is created/updated with schema tables. | Non-zero exit code, SQL error, migration folder mismatch. |
| **M1-V2** | Client Generation | `npm --prefix backend run db:generate` (or `npm run db:generate`) | Project Root | Exit code `0`. Output: `✔ Generated Prisma Client` into `backend/node_modules/@prisma/client`. | Non-zero exit code, generator syntax error. |
| **M1-V3** | Seed Execution | `npm --prefix backend run db:seed` (or `npm run db:seed`) | Project Root | Exit code `0`. Demo mosques (`al-noor`, `al-huda`), users, memberships, announcements, programs, registrations, and donations populated. | Non-zero exit code, missing relations, unique constraint error. |
| **M1-V4** | Seed Idempotency | `npm run db:seed && npm run db:seed` | Project Root | Both consecutive runs complete with exit code `0` without duplicate key errors or constraint violations. | Unique constraint error or failure on 2nd run. |
| **M1-V5** | Full DB Setup Pipeline | `npm --prefix backend run db:setup` (or `npm run db:setup`) | Project Root | Sequentially runs `db:migrate`, `db:generate`, `db:seed`. Exit code `0`. | Any sub-step fails. |
| **M1-V6** | Reset Pipeline | `npm --prefix backend run db:reset:demo` (or `npm run db:reset:demo`) | Project Root | Drops SQLite database, applies migrations, seeds data. Exit code `0`. | Prompt hanging (requires `--force`), migration failure. |
| **M1-V7** | Standalone Logic Tests | `npm run test:logic` | Project Root | Runs `backend` test runner and `frontend` test runner. Both pass with 0 failures, exit code `0`. | Any failed assertion in node test runners. |
| **M1-V8** | Backend TypeScript Build | `npm --prefix backend run build` | Project Root | `tsc` completes with exit code `0` and emits artifacts in `backend/dist/`. | TypeScript compilation / type errors. |
| **M1-V9** | Frontend Next.js Build | `npm --prefix frontend run build` | Project Root | `next build` completes with exit code `0` and outputs production bundle in `frontend/.next/`. | Next.js build errors or broken imports. |
