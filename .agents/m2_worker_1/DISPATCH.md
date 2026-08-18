# DISPATCH — Milestone 2: Worker 1 (Security Hardening & Session Security Implementation)

You are a teamwork_preview_worker agent for Milestone 2.
Your working directory is: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\m2_worker_1`
Project root: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub`
Scope document: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\PROJECT.md`
Authoritative request: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\ORIGINAL_REQUEST.md`

## Files Owned Exclusively:
- `backend/src/server.ts`
- `backend/src/plugins/auth.ts`
- `backend/src/plugins/security.ts` (if creating CSRF/security plugin)
- `backend/src/schemas/` (validation schemas)
- `backend/src/routes/auth.ts`
- `backend/src/routes/mosques.ts`
- `backend/src/routes/platform.ts`
- `backend/src/routes/donations.ts`
- `backend/src/routes/programs.ts`
- `backend/src/routes/registrations.ts`
- `backend/src/routes/announcements.ts`
- `backend/src/routes/memberships.ts`
- `backend/src/routes/notifications.ts`
- `backend/src/routes/analytics.ts`
- `backend/test/current/security.integration.test.ts`
- `frontend/src/lib/api.ts`

## Inputs:
- Read explorer handoff reports:
  - `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\m2_explorer_1\handoff.md`
  - `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\m2_explorer_2\handoff.md`
  - `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\m2_explorer_3\handoff.md`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Task & Acceptance Criteria:
1. **HTTP-Only Cookie Authentication**:
   - Register `@fastify/cookie` in Fastify backend.
   - Issue `mh_session` cookie on login, register, switch-tenant, and platform login (`httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `secure: process.env.NODE_ENV === 'production'`).
   - Support dual authentication: extract token from cookie `mh_session` first, fallback to `Authorization: Bearer <token>`.
   - Implement `POST /api/auth/logout` and `POST /api/platform/auth/logout` clearing cookies.
2. **CSRF Protection**:
   - Implement CSRF protection middleware / plugin.
   - Provide `GET /api/auth/csrf` returning `{ csrfToken }` and setting `mh_csrf` cookie.
   - Enforce CSRF validation for all state-changing mutation requests (`POST`, `PUT`, `PATCH`, `DELETE`) authenticated via cookies. Return HTTP 403 on missing or invalid CSRF token.
3. **Strict CORS Configuration**:
   - Update CORS in `server.ts` with `credentials: true` and origin validation for dev (`localhost:3000`, `127.0.0.1:3000`) and production `CORS_ORIGIN`.
4. **Centralized Schema Validation**:
   - Attach Fastify JSON schemas to routes and ensure 400 Bad Request responses on invalid inputs.
5. **AuditEvent Logging Coverage**:
   - Ensure all sensitive administrative, financial, and lifecycle actions create structured `AuditEvent` records with `actor_id`, `mosque_id`, `action`, `target_type`, `target_id`, `summary`, `request_id`, `ip_address`.
6. **Frontend API Client Update**:
   - Update `frontend/src/lib/api.ts` to include `credentials: 'include'` and attach CSRF token headers on mutation requests.
7. **Security Integration Test Suite**:
   - Create `backend/test/current/security.integration.test.ts` covering cookie sessions, CSRF 403 enforcement, CORS credentials, schema validation, and audit persistence.
8. **Run Verification Commands**:
   - `npm --prefix backend run test`
   - `npm run test:logic`
   - `npm --prefix backend run build`
   - `npm --prefix frontend run build`
9. Write your detailed handoff report to `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\m2_worker_1\handoff.md` and send a message back.
