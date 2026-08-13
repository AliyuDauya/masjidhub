# MasjidHub

MasjidHub is a multi-tenant mosque operations platform for tenant onboarding, role-based administration, donations and receipts, announcements, programmes, registrations, reminders, reporting, and audit history.

## Stack

- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- API: Node.js, Fastify, TypeScript
- Data: Prisma and SQLite
- Security: JWT, bcrypt, Helmet, CORS, rate limiting, tenant membership authorization

SQLite is an intentional project constraint. Tenant isolation is therefore enforced through explicit `mosque_id` ownership, tenant-local memberships, compound relational constraints, centralized authorization hooks, and isolation tests rather than database row-level security.

## Structure

```text
backend/   Fastify API, Prisma schema and backend tests
frontend/  Next.js public portal, tenant workspace and platform console
```

## Setup

Requirements: Node.js 20 or newer and npm.

```bash
npm --prefix backend ci
npm --prefix frontend ci
npm run db:setup
```

`db:setup` deploys all committed Prisma migrations, generates Prisma Client, and then intentionally loads the local demonstration data. Migration deployment is non-interactive and does not reset an existing database. To deploy schema changes without replacing application data, run `npm run db:migrate`; run `npm run db:generate` after dependency or schema changes when needed.

Copy the example environment files and replace the JWT secret before deployment:

```bash
backend/.env.example  -> backend/.env
frontend/.env.example -> frontend/.env.local
```

Run the services in separate terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

- Web application: http://localhost:3000
- API: http://localhost:5000
- Platform console: http://localhost:3000/platform

## Demonstration accounts

| Purpose | Mosque | Email | Password |
|---|---|---|---|
| Platform administrator | — | `platform@masjidhub.local` | `platformPass123` |
| Tenant administrator | `al-noor` | `ahmad@alnoor.org` | `adminPass123` |
| Tenant administrator | `al-huda` | `yusuf@alhuda.org` | `adminPass123` |
| Multi-mosque member | either tenant | `ali@example.org` | `memberPass123` |

The seed step deletes and recreates local demonstration records. Because `db:setup` intentionally includes that step, do not run `db:setup`, `db:seed`, or `db:reset:demo` against a database containing records you need to preserve. `db:reset:demo` is the explicitly destructive local reset command; it drops the database, reapplies migrations, and runs the seed command. Normal schema deployment uses `db:migrate` and is non-destructive.

For future schema changes, create and commit a new migration during development, then use `npm run db:migrate` in non-interactive environments. Back up the SQLite database before production upgrades. Prisma migrations are forward-only; rollback means restoring a tested backup or applying a new corrective migration.

## Tenant and role model

A global user can have a separate membership in several mosques. Every signed tenant token identifies the active membership and mosque. Server authorization reloads that membership on protected requests, so role or membership suspension takes effect without waiting for token expiry.

Tenant roles are:

- `tenant_admin`
- `finance_officer`
- `programme_officer`
- `communications_officer`
- `member`

New public accounts always receive the member role. Privileged roles can only be assigned by a tenant administrator. New mosque applications remain pending until activated through the platform console.

## Verification

```bash
npm --prefix backend test
npm --prefix backend run build
npm --prefix frontend test
npm --prefix frontend run build
```

The online donation endpoint is a prototype record-and-receipt flow. It does not process or hold real funds.
