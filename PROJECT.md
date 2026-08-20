# Project: MasjidHub 3-Portal Login Restructuring & Platform Multi-Tenant Security

## Architecture
MasjidHub is a Next.js (v16.2 App Router) + Fastify multi-tenant mosque management platform.
- **Frontend**: Next.js App Router, React 19, Tailwind CSS v4, League Spartan typography, Royal Emerald (`#0d4734`) and Metallic Gold (`#c89b3c`) design tokens.
  - Global routes: `/login`, `/register`, `/platform`, `/`
  - Tenant routes: `/mosque/[slug]`, `/mosque/[slug]/login`, `/mosque/[slug]/dashboard`, `/mosque/[slug]/admin`, `/mosque/[slug]/admin/analytics`
  - API Client: `frontend/src/lib/api.ts` with automatic `X-Mosque-Slug`, CSRF cookie extraction (`mh_csrf`), and credentials handling.
- **Backend**: Fastify v5, Prisma ORM, SQLite / PostgreSQL, JWT authentication, dual session support (`mh_session` HttpOnly cookie & Bearer token), CSRF HMAC-SHA256 token verification (`mh_csrf` cookie & `X-CSRF-Token` header).
  - Auth routes: `/api/auth/login`, `/api/auth/register`, `/api/auth/csrf`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/switch-tenant/:slug`, `/api/members/join`
  - Platform routes: `/api/platform/auth/login`, `/api/platform/auth/logout`, `/api/platform/tenants`, `/api/platform/tenants/:id/status`, `/api/platform/metrics`
  - Tenant middleware: `tenantHook` resolving `X-Mosque-Slug` header and route params.
- **Role Model**:
  - Global User: `User` (with optional `platform_role: 'super_admin'`).
  - Mosque Membership: `Membership` linking `User` to `Mosque` with roles `member`, `tenant_admin`, `finance_officer`, `programme_officer`, `communications_officer`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | 3-Section Segmented Login UI | Restructure `/login` and `/mosque/[slug]/login` with 3 dedicated portal tabs (Member/Worshipper, Mosque Admin/Imam, Platform Operator) | M1 | ORIGINAL_REQUEST §R1 |
| F2 | Worshipper Portal Authentication & Routing | Tab 1 signs in via `POST /api/auth/login` with selected mosque slug and routes directly to `/mosque/[slug]/dashboard` | M1 | ORIGINAL_REQUEST §R1.1 |
| F3 | Mosque Admin & Imam Workspace Authentication & Routing | Tab 2 signs in via `POST /api/auth/login` with selected mosque slug and routes directly to `/mosque/[slug]/admin` | M1 | ORIGINAL_REQUEST §R1.2 |
| F4 | Sovereign Platform Operator Authentication & Routing | Tab 3 signs in via `POST /api/platform/auth/login` (no tenant slug needed), persists platform token, and routes directly to `/platform` | M1 | ORIGINAL_REQUEST §R1.3 |
| F5 | Destination Mosque Selector Dropdown | Reactive dropdown listing active mosques from `GET /api/mosques`, syncing with URL slug and form submissions | M2 | ORIGINAL_REQUEST §R1, R2 |
| F6 | Responsive Royal Emerald & Gold Aesthetic | Royal Emerald (`#0d4734`), Warm Metallic Gold (`#c89b3c`), Ivory (`#fcfbfa`), role badges, clear descriptions, placeholder hints, mobile responsiveness | M2 | ORIGINAL_REQUEST §R2 |
| F7 | Quick Links & Onboarding Gateways | Quick links for new worshippers to create global accounts and for mosques to onboard new tenants (`/register`) | M2 | ORIGINAL_REQUEST §R2 |
| F8 | Session, Cookies & CSRF Protection Invariants | Ensure `mh_session` (HttpOnly), `mh_csrf` (HMAC-SHA256), Bearer tokens, and CSRF mutation headers work flawlessly across all 3 portals | M3 | ORIGINAL_REQUEST §R3 |
| F9 | Multi-Tenant Auto-Membership & Switching | Preserve automatic member record creation on new mosque login and 1-click tenant switching | M3 | ORIGINAL_REQUEST §R3 |
| F10 | Comprehensive Test Suites & Production Build | 100% passing backend tests (`test:node`), frontend tests (`test:node`), Next.js production build (`build`), and Tier 1-5 E2E test suite | M4 | ORIGINAL_REQUEST §Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | 3 Dedicated Role-Based Login Sections & Routing | Implement 3-tab segmented login interface in `/login` and `/mosque/[slug]/login`, connecting Worshipper -> `/mosque/[slug]/dashboard`, Admin -> `/mosque/[slug]/admin`, and Operator -> `/platform` | None | PLANNED |
| M2 | Responsive Emerald/Gold UI & Mosque Selection | Polish Royal Emerald (`#0d4734`) / Gold (`#c89b3c`) visuals, role badges, placeholder hints, reactive mosque selector dropdown, and onboarding quick links | M1 | PLANNED |
| M3 | Auth Security & Multi-Tenant Session Preservation | Verify and harden cookie handling (`mh_session`, `mh_csrf`), CSRF protection on mutations, and auto-membership linking across all 3 portals | M1, M2 | PLANNED |
| M4 | E2E Testing Suite, Build Verification & Adversarial Hardening | Design and run Tier 1-5 test suites, verify `npm --prefix backend run test:node`, `npm --prefix frontend run test:node`, and `npm --prefix frontend run build` | M1, M2, M3 | PLANNED |

## Interface Contracts

### Frontend Auth Client ↔ Backend Auth APIs
- **Worshipper / Member Login**:
  - Request: `POST /api/auth/login`, Headers: `Content-Type: application/json`, `X-Mosque-Slug: <slug>`
  - Body: `{ "email": string, "password": string }`
  - Response (200): `{ "token": string, "csrfToken": string, "user": { "user_id": number, "name": string, "email": string }, "membership": { "membership_id": number, "mosque_id": number, "role": string } }`
  - Cookies Set: `mh_session` (HttpOnly), `mh_csrf`
  - Destination: `/mosque/<slug>/dashboard`

- **Mosque Admin / Imam Login**:
  - Request: `POST /api/auth/login`, Headers: `Content-Type: application/json`, `X-Mosque-Slug: <slug>`
  - Body: `{ "email": string, "password": string }`
  - Response (200): `{ "token": string, "csrfToken": string, "user": { "user_id": number, "name": string, "email": string }, "membership": { "membership_id": number, "mosque_id": number, "role": string } }`
  - Destination: `/mosque/<slug>/admin`

- **Sovereign Platform Operator Login**:
  - Request: `POST /api/platform/auth/login`, Headers: `Content-Type: application/json`
  - Body: `{ "email": string, "password": string }`
  - Response (200): `{ "token": string, "csrfToken": string, "user": { "user_id": number, "name": string, "email": string, "platform_role": "super_admin" } }`
  - Destination: `/platform`

### Mosque Option Interface
- Endpoint: `GET /api/mosques`
- Response: `Array<{ mosque_id: number, name: string, slug: string, address?: string, brand_color?: string }>`

## Code Layout
- `frontend/src/app/login/page.tsx`: Global login page with 3-section role tabs, destination mosque selector, role badges, and quick links.
- `frontend/src/app/mosque/[slug]/login/page.tsx`: Mosque-specific login page with preset slug, 3-section role tabs, and contextual links.
- `frontend/src/components/auth/RoleBasedLoginForm.tsx`: Shared/reusable 3-portal login component if factored out, or encapsulated directly in page components.
- `frontend/src/lib/api.ts`: API client for CSRF header injection, Bearer tokens, and fetch credentials.
- `frontend/src/app/globals.css`: Design system CSS variables, buttons, and glass navigation classes.
- `frontend/__tests__/standalone_runner.js`: Standalone Node test runner for frontend validation.
- `backend/test/standalone_runner.js`: Standalone Node test runner for backend validation.
- `backend/test/e2e/`: E2E integration test suites.
