# Project: MasjidHub Sovereign Multi-Tenant Mosque Platform

## Architecture
- **Backend**: Fastify 5 server with TypeScript, Prisma ORM, and SQLite.
  - Multi-tenancy via `tenantHook` resolving `X-Mosque-Slug` or route `:slug` against active `Mosque` records.
  - Authentication via `@fastify/jwt` and `@fastify/cookie` with dual-mode support (HTTP-only `mh_session` cookies + Authorization Bearer header).
  - CSRF defense on mutation routes (`POST`, `PUT`, `PATCH`, `DELETE`).
  - Strict CORS with credentials resolution.
  - Centralized schema validation via Fastify / Ajv.
  - Comprehensive `AuditEvent` structured logging for administrative and financial operations.
  - 5 Tenant-local roles: `tenant_admin`, `finance_officer`, `programme_officer`, `communications_officer`, `member`, plus platform `super_admin`.
- **Frontend**: Next.js 16 App Router (`src/app`), React 19, Tailwind CSS v4, custom design tokens, and modular API client (`src/lib/api.ts`).
  - Public platform landing page, directory, onboarding.
  - Public tenant portal (Iqamah timetable, announcements, programmes registration, donations with instant digital receipt).
  - Tenant admin workspace with role-based navigation tabs (`announcements`, `programs`, `donations`, `members`, `audit`, `settings`).
  - In-app notification center with unread count badge and read toggling.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Baseline Prisma SQLite Migration | Versioned baseline migration (`20250101000000_initial`) replacing unversioned schema pushes | M1 (DONE) | ORIGINAL_REQUEST §R1 |
| 2 | Clean Environment Initialization | Automated migration deployment via `prisma migrate deploy` | M1 (DONE) | ORIGINAL_REQUEST §R1 |
| 3 | Deterministic Demo Seeding | Idempotent seed script populating demo mosques, 5 roles, programmes, donations | M1 (DONE) | ORIGINAL_REQUEST §R1 |
| 4 | HTTP-Only Cookie Authentication | Secure `mh_session` cookie issuance and extraction for browser sessions | M2 (DONE) | ORIGINAL_REQUEST §R2 |
| 5 | CSRF Protection | Enforce CSRF token verification (HTTP 403 on invalid/missing) on mutation routes | M2 (DONE) | ORIGINAL_REQUEST §R2 |
| 6 | Centralized Request Validation | JSON schemas on Fastify routes for robust input validation | M2 (DONE) | ORIGINAL_REQUEST §R2 |
| 7 | Strict Production CORS | Configured CORS origin validation with `credentials: true` | M2 (DONE) | ORIGINAL_REQUEST §R2 |
| 8 | Structured Audit Event Logging | Comprehensive `AuditEvent` creation on privileged admin & financial actions | M2 (DONE) | ORIGINAL_REQUEST §R2 |
| 9 | Programme Lifecycle Management | Admin UI & API for programme creation, editing, capacity limits | M3 (DONE) | ORIGINAL_REQUEST §R3 |
| 10 | Attendee Check-in & Reminders | Attendance status toggling (`Attended`) and attendee reminder dispatch | M3 (DONE) | ORIGINAL_REQUEST §R3 |
| 11 | Donation Reconciliation & Offline Entry | UI controls for donation reconciliation (`Reconciled`) and manual cash recording | M3 (DONE) | ORIGINAL_REQUEST §R3 |
| 12 | CSV Ledger Export | Structured CSV ledger export of donations with receipt number, amounts, statuses | M3 (DONE) | ORIGINAL_REQUEST §R3 |
| 13 | In-App Notification Center | Member and admin notification inbox with unread counter badge and mark-as-read | M3 (DONE) | ORIGINAL_REQUEST §R3 |
| 14 | Tenant Audit Log Viewer | Dedicated audit tab in workspace displaying structured audit events for admins | M3 (DONE) | ORIGINAL_REQUEST §R3 |
| 15 | Role-Based Workspace Views | Dynamic navigation tab filtering for the 5 tenant-local roles | M3 (DONE) | ORIGINAL_REQUEST §R3 |
| 16 | 5-Role Integration Test Suite | Automated tests verifying permissions and 403 restrictions across all 5 roles | M4 | ORIGINAL_REQUEST §R4 |
| 17 | Multi-Mosque Global Users | Automated tests for users holding active memberships across multiple mosques | M4 | ORIGINAL_REQUEST §R4 |
| 18 | Adversarial Multi-Tenant Isolation | Adversarial tests across 3+ tenants verifying zero data leakage / cross-tenant mutations | M4 | ORIGINAL_REQUEST §R4 |
| 19 | Opaque-Box E2E Test Suite | 4-tier requirement-driven E2E test runner verifying full user workflows | E2E Track | ORIGINAL_REQUEST §Acceptance |
| 20 | Final Integration & Adversarial Hardening | Pass 100% E2E tests + Tier 5 white-box coverage hardening | Final Milestone | ORIGINAL_REQUEST §Acceptance |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Track | Requirement-driven opaque-box test suite across Tiers 1-4 | none | IN_PROGRESS |
| M1 | Versioned DB Migrations & Setup | Baseline SQLite migration, migration deploy scripts, idempotent 5-role seed | none | DONE |
| M2 | Security Hardening & Session Security | HTTP-only cookies, CSRF protection, schema validation, CORS with credentials, audit events | M1 | DONE |
| M3 | Admin Workflows & Frontend Completion | Programs UI & check-in, donation reconciliation & cash modal & CSV export, notifications, audit UI | M2 | DONE |
| M4 | Automated Test Suite & Multi-Tenant Isolation | Integration tests for 5 roles, multi-mosque global users, adversarial cross-tenant isolation | M2, M3 | IN_PROGRESS |
| M5 | Final Milestone: 100% E2E Pass & Hardening | Pass 100% E2E test suite + Tier 5 white-box adversarial hardening | E2E, M4 | PLANNED |

## Interface Contracts
### Auth & Session Contracts
- `POST /api/auth/login`: Accepts `{ email, password, mosque_id? }`, returns `{ user, membership, token, csrfToken }`, sets `mh_session` cookie (`HttpOnly; SameSite=Lax; Path=/`).
- `GET /api/auth/csrf`: Returns `{ csrfToken }` and sets `mh_csrf` cookie.
- `POST /api/auth/logout`: Clears `mh_session` and `mh_csrf` cookies.
- CSRF Header: Requests with mutation methods (`POST`, `PUT`, `PATCH`, `DELETE`) authenticated via cookies must include header `X-CSRF-Token` or `x-csrf-token`.

### Admin Programme & Attendance Contracts
- `POST /api/admin/programs`: Body `{ title, description, category, start_date, end_date, location, max_capacity, visibility }`. Allowed: `['tenant_admin', 'programme_officer']`.
- `PUT /api/admin/programs/:id`: Body subset of above. Allowed: `['tenant_admin', 'programme_officer']`.
- `PATCH /api/admin/registrations/:id/attendance`: Body `{ status: 'Attended' | 'Registered' | 'Cancelled' }`. Allowed: `['tenant_admin', 'programme_officer']`.

### Admin Donation & Reconciliation Contracts
- `POST /api/admin/donations/manual`: Body `{ amount_minor, currency, category, donor_name?, donor_email?, notes? }`. Allowed: `['tenant_admin', 'finance_officer']`.
- `PATCH /api/admin/donations/:id/reconcile`: Updates status to `Reconciled`, records `verified_by`. Allowed: `['tenant_admin', 'finance_officer']`.
- `GET /api/admin/donations/export.csv`: Returns CSV stream. Allowed: `['tenant_admin', 'finance_officer']`.

### Notification & Audit Contracts
- `GET /api/members/notifications`: Returns user's in-app notifications.
- `PATCH /api/members/notifications/:id/read`: Marks notification `is_read: true`.
- `GET /api/admin/audit-events`: Returns recent audit events with actor, action, target, summary, IP, timestamp. Allowed: `['tenant_admin']`.

## Code Layout
- `backend/prisma/`: Schema, migrations, seed script.
- `backend/src/plugins/`: Fastify plugins (`auth.ts`, `db.ts`, `security.ts`).
- `backend/src/routes/`: Route modules (`auth.ts`, `mosques.ts`, `programs.ts`, `registrations.ts`, `donations.ts`, `announcements.ts`, `memberships.ts`, `notifications.ts`, `platform.ts`, `analytics.ts`).
- `backend/src/middleware/`: Tenant isolation hook (`tenantHook.ts`).
- `backend/test/`: Test runners, current integration tests (`test/current/`).
- `frontend/src/app/`: Next.js App Router pages and layouts.
- `frontend/src/components/`: Reusable UI components (Notification Center, modals, forms).
- `frontend/src/lib/`: API client (`api.ts`), utilities.
- `frontend/__tests__/`: Frontend component & logic tests.
