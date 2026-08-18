# Backend Architecture & Security Survey Handoff Report

## Executive Summary
This investigation surveyed the Fastify backend architecture, authentication and session management, cookie policies, CSRF handling, CORS configuration, route validation schemas, `AuditEvent` logging infrastructure, and administrative API endpoints for the MasjidHub platform. The backend is well-structured around Fastify plugins (`authPlugin`, `dbPlugin`), middleware hooks (`tenantHook`), and modular domain routes. However, hardening is required for Requirement R2 (HTTP-only session cookies, CSRF protection on mutation endpoints, strict CORS with credentials, and centralized schema validation) and verification of administrative workflows (R3).

---

## 1. Observation

### 1.1 Server Setup & Plugin Registration
- **File**: `backend/src/server.ts` (lines 19–55)
  - `buildServer()` initializes Fastify (`logger: true`).
  - Registers `@fastify/cors` with `origin: process.env.CORS_ORIGIN || '*'`.
  - Registers `@fastify/helmet`.
  - Registers `@fastify/rate-limit` (max 100 requests per 1 minute window).
  - Registers `dbPlugin` (`src/plugins/db.ts`) and `authPlugin` (`src/plugins/auth.ts`).
  - Registers domain route plugins: `mosqueRoutes`, `authRoutes`, `announcementRoutes`, `programRoutes`, `registrationRoutes`, `donationRoutes`, `analyticsRoutes`, `platformRoutes`, `membershipRoutes`, `notificationRoutes`.

### 1.2 Authentication & Authorization Mechanisms
- **File**: `backend/src/plugins/auth.ts` (lines 30–109)
  - JWT configured via `@fastify/jwt` with `secret: process.env.JWT_SECRET || 'development-only-change-me'` and `expiresIn: '8h'`.
  - Decorators defined:
    - `fastify.authenticate`: Executes `request.jwtVerify()`, verifies user existence and `account_status === 'Active'`.
    - `fastify.requireMembership(roles = [])`: Enforces `authenticate`, checks tenant matching (`payload.mosque_id === request.tenant.mosque_id`), verifies database `Membership` record is `Active`, checks role against whitelist, attaches `request.membership`.
    - `fastify.adminOnly`: Shorthand for `requireMembership(['tenant_admin'])`.
    - `fastify.platformOnly`: Verifies user has `platform_role === 'super_admin'`.
    - `fastify.audit(request, action, targetType, targetId, summary)`: Writes an `AuditEvent` record with `mosque_id`, `actor_id`, `action`, `target_type`, `target_id`, `summary`, `request_id`, `ip_address`.
- **File**: `backend/src/routes/auth.ts` (lines 20–107)
  - `POST /api/auth/register`: Creates User + Membership (role `member`), audits `membership.registered`, returns JWT token in JSON response.
  - `POST /api/auth/login`: Validates password with `bcrypt.compare`, verifies active tenant membership, returns `{ token, user, membership }`.
  - `GET /api/auth/me`: Protected by `fastify.authenticate`, returns user profile and mosque memberships.
  - `POST /api/auth/switch-tenant/:slug`: Validates membership in target mosque, signs and returns new scoped JWT token.
- **File**: `frontend/src/lib/api.ts` (lines 7–16)
  - Current frontend stores JWT tokens in `localStorage` (`masjidhub:<slug>:token` or `masjidhub:platform:token`) and transmits them via `Authorization: Bearer <token>`.

### 1.3 Multi-Tenant Isolation Hook
- **File**: `backend/src/middleware/tenantHook.ts` (lines 3–24)
  - Reads tenant identifier from `X-Mosque-Slug` header or `:slug` route parameter.
  - Rejects missing slugs with HTTP 400.
  - Queries `mosque` table by slug; returns HTTP 404 if not found.
  - Checks `mosque.status === 'Active'`; returns HTTP 423 (Locked) if `Pending` or `Suspended`.
  - Attaches validated `request.tenant = mosque`.

### 1.4 CSRF and Cookie Handling Current State
- No `@fastify/cookie` or `@fastify/csrf-protection` plugins are registered in `server.ts` or `package.json`.
- State-changing mutation routes (`POST`, `PUT`, `PATCH`, `DELETE`) currently rely solely on Bearer token validation or `tenantHook` without CSRF token verification.

### 1.5 CORS Configuration Current State
- `backend/src/server.ts` line 25:
  ```ts
  server.register(cors, {
    origin: process.env.CORS_ORIGIN || '*',
  });
  ```
  - Missing `credentials: true`.
  - Wildcard `*` will be rejected by browsers once HTTP-only cookie authentication is enabled with credentials.

### 1.6 Request Validation Current State
- Parameter validation is implemented via ad-hoc procedural conditionals inside individual route handlers (e.g. `if (!title || !description) reply.status(400)...`).
- No centralized Fastify JSON Schema / Ajv or TypeBox schemas are attached to route definitions.

### 1.7 AuditEvent Model & Call Sites
- **Prisma Model**: `backend/prisma/schema.prisma` lines 173–189 (`AuditEvent` with `audit_id`, `mosque_id`, `actor_id`, `action`, `target_type`, `target_id`, `summary`, `request_id`, `ip_address`, `created_at`).
- **Call Sites**:
  - `auth.ts:52`: `membership.registered`
  - `donations.ts:37`: `donation.completed`
  - `donations.ts:57`: `donation.recorded`
  - `donations.ts:82`: `donation.reconciled`
  - `donations.ts:89`: `donations.exported`
  - `programs.ts:54`: `program.created`
  - `programs.ts:98`: `program.updated`
  - `programs.ts:133`: `program.deleted`
  - `registrations.ts:26`: `registration.created`
  - `registrations.ts:43`: `registration.cancelled`
  - `registrations.ts:64`: `attendance.recorded`
  - `announcements.ts:81`: `announcement.created`
  - `announcements.ts:126`: `announcement.updated`
  - `announcements.ts:161`: `announcement.deleted`
  - `memberships.ts:26`: `membership.invited`
  - `memberships.ts:38`: `membership.updated`
  - `mosques.ts:42`: `tenant.applied`
  - `mosques.ts:64`: `tenant.updated`
  - `notifications.ts:26`: `program.reminders_sent`
  - `platform.ts:26`: `tenant.active` / `tenant.suspended`
- **Audit Listing**: `GET /api/admin/audit-events` in `backend/src/routes/notifications.ts` (lines 30–32).

### 1.8 Administrative Endpoints (R3 Backend Scope)
- **Program Lifecycle**:
  - `POST /api/admin/programs` (`['tenant_admin', 'programme_officer']`) — Creates program with `max_capacity`.
  - `PUT /api/admin/programs/:id` (`['tenant_admin', 'programme_officer']`) — Updates title, dates, capacity, location.
  - `DELETE /api/admin/programs/:id` (`['tenant_admin', 'programme_officer']`) — Deletes program.
  - `GET /api/admin/programs/:id/registrations` (`['tenant_admin', 'programme_officer']`) — Fetches attendees list with user contact info.
  - `PATCH /api/admin/registrations/:id/attendance` (`['tenant_admin', 'programme_officer']`) — Marks attendee check-in (`status: 'Attended'`, sets `attended_at`).
  - `POST /api/programs/:id/register` — Enforces program capacity ceiling when `max_capacity > 0`.
- **Donation Management & Reconciliation**:
  - `POST /api/donations` — Public/member online donation with integer minor units (`amount_minor`) and unique receipt formatting (`MH-...`).
  - `POST /api/admin/donations/manual` (`['tenant_admin', 'finance_officer']`) — Offline cash donation recording with actor linkage.
  - `GET /api/admin/donations` (`['tenant_admin', 'finance_officer']`) — List donations with filters (`status`, `category`, `reconciliation_status`, `search`).
  - `PATCH /api/admin/donations/:id/reconcile` (`['tenant_admin', 'finance_officer']`) — Updates `reconciliation_status: 'Reconciled'` and records `verified_by`.
  - `GET /api/admin/donations/export.csv` (`['tenant_admin', 'finance_officer']`) — Generates CSV ledger export with receipt number, date, amount, currency, category, method, status, reconciliation status.
- **In-App Notifications & Audit**:
  - `GET /api/members/notifications` (`fastify.requireMembership()`) — Lists user notifications.
  - `PATCH /api/members/notifications/:id/read` (`fastify.requireMembership()`) — Marks notification as read.
  - `POST /api/admin/programs/:id/reminders` (`['tenant_admin', 'programme_officer']`) — Sends notification reminders to registered attendees.
  - `GET /api/admin/audit-events` (`fastify.adminOnly`) — Returns recent 200 audit events.

---

## 2. Logic Chain

1. **Security Requirement R2 — HTTP-Only Cookies**:
   - *Premise*: Browser session tokens stored in `localStorage` are accessible to JavaScript and vulnerable to XSS exfiltration.
   - *Observation*: `backend/src/plugins/auth.ts` and `frontend/src/lib/api.ts` currently transmit tokens via JSON payload and `localStorage`.
   - *Inference*: The backend must register `@fastify/cookie`, issue `Set-Cookie: mh_session=...; HttpOnly; SameSite=Lax; Path=/` on login/register/tenant-switch, support extracting session tokens from cookies in `authPlugin`, and provide logout endpoints to clear cookies. Dual-support (cookie + Bearer header) should be retained so programmatic API calls and existing integration tests continue working seamlessly.

2. **Security Requirement R2 — CSRF Protection**:
   - *Premise*: When authentication relies on ambient browser credentials (HTTP-only cookies), cross-origin requests can forge state-changing actions.
   - *Observation*: No CSRF token mechanism exists on any `POST`, `PUT`, `PATCH`, or `DELETE` endpoints.
   - *Inference*: A CSRF defense mechanism (e.g. `@fastify/csrf-protection` or double-submit cookie / signed token validation) must be registered. A CSRF token endpoint (e.g., `GET /api/auth/csrf` or cookie `mh_csrf_token`) must be provided, and all mutation requests must validate `X-CSRF-Token` / `x-xsrf-token` header, returning HTTP 403 Forbidden when missing or invalid.

3. **Security Requirement R2 — Strict CORS Configuration**:
   - *Premise*: With `credentials: true`, wildcard CORS (`*`) is invalid and blocked by browser fetch standards.
   - *Observation*: `server.ts` uses `origin: process.env.CORS_ORIGIN || '*'`.
   - *Inference*: CORS must be updated with `credentials: true` and an explicit origin resolver: in development, allowing `http://localhost:3000`, `http://127.0.0.1:3000`; in production, validating against `CORS_ORIGIN` whitelist.

4. **Security Requirement R2 — Centralized Route Validation Schemas**:
   - *Premise*: Procedural request body parsing in route handlers is repetitive, lacks consistent error responses, and allows malformed inputs through to database queries.
   - *Observation*: Handlers in `auth.ts`, `donations.ts`, `programs.ts`, `memberships.ts`, etc., manually check fields and return ad-hoc error strings.
   - *Inference*: Centralizing Fastify request schemas (`schema: { body: ..., querystring: ..., params: ... }`) ensures automatic 400 Bad Request validation by Ajv before handler execution.

5. **Requirement R3 Backend Alignment**:
   - *Observation*: The database schema (`schema.prisma`), Prisma migrations, and route handlers for programs, registrations, donations, CSV export, notifications, and audit logging are implemented and functional.
   - *Inference*: The backend APIs for R3 are already in place and provide the necessary endpoints for frontend consumption.

---

## 3. Caveats
1. **Vitest Test Suite Configuration**:
   - In `backend/vitest.config.ts`, the test runner is configured with `include: ['test/current/**/*.test.ts']`. The unit test files under `backend/test/routes/` are legacy mock-based tests from early development and are not included in the primary Vitest run. The active integration suite is in `test/current/`.
2. **Dual Authentication Support**:
   - While HTTP-only cookies are required for browser security, automated CLI/test runners (`test:logic` / `standalone_runner.js` / Vitest integration tests) often send `Authorization: Bearer <token>`. The `authPlugin` should support both cookie-based session extraction and Authorization header extraction.
3. **CSRF Exemption for Machine/Bearer Requests**:
   - When requests authenticate via `Authorization: Bearer <token>` (non-browser clients/tests), CSRF checks can be bypassed or satisfied, whereas cookie-authenticated browser requests must strictly enforce CSRF tokens.

---

## 4. Conclusion
1. **Architecture Status**: The Fastify backend has a clean structure with clear tenant isolation, role-based access control across all 5 roles (`tenant_admin`, `finance_officer`, `programme_officer`, `communications_officer`, `member`), and structured `AuditEvent` logging.
2. **Key Implementation Tasks for R2 & R3**:
   - **Cookie Auth**: Add `@fastify/cookie`, issue HTTP-only `mh_session` cookie on login/register/switch-tenant, add logout routes (`/api/auth/logout`, `/api/platform/auth/logout`), update `authPlugin` to read from cookie or header.
   - **CSRF Defense**: Register `@fastify/csrf-protection` (or custom double-submit token middleware), expose `GET /api/auth/csrf`, enforce 403 on invalid/missing CSRF tokens for state mutations.
   - **CORS Hardening**: Configure CORS with `credentials: true` and strict origin whitelisting.
   - **Centralized Validation Schemas**: Add Fastify JSON/Ajv schemas for route payloads, query parameters, and route parameters.
   - **Frontend API Client Sync**: Update `frontend/src/lib/api.ts` to include `credentials: 'include'` and send `X-CSRF-Token` headers.

---

## 5. Verification Method

### 5.1 Standalone Test Runner Verification
```bash
npm --prefix backend run test:node
```
*Expected*: All 10 logic verification tests pass with 0 failures.

### 5.2 Vitest Integration Test Suite
```bash
npm --prefix backend test
```
*Expected*: Integration tests in `test/current/platform.integration.test.ts` pass with 0 errors.

### 5.3 Database Setup and Seed
```bash
npm --prefix backend run db:setup
```
*Expected*: Prisma migration deploy succeeds, Prisma client generates, and seed data populates demo tenants (`al-noor`, `al-huda`), users, programs, and donations.

### 5.4 Security Verification Tests (Post-Implementation)
- **Cookie Auth**: Test that `POST /api/auth/login` returns a `Set-Cookie` header containing `mh_session` with `HttpOnly` and `SameSite=Lax`.
- **CSRF**: Test that `POST /api/donations` with a session cookie but without a valid `X-CSRF-Token` header returns HTTP 403 Forbidden.
- **CORS**: Test that OPTIONS preflight requests from an authorized origin return `Access-Control-Allow-Credentials: true` and proper `Access-Control-Allow-Origin`.
- **Validation**: Test that requests with missing or invalid schema payloads return HTTP 400 Bad Request.
