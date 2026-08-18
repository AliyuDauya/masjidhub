# Milestone 2: Worker 1 Handoff Report — Security Hardening & Session Security Implementation

## 1. Observation

Direct inspection and implementation of the security hardening components across the backend and frontend codebases produced the following state:

### 1.1 Security Plugin & Cookie Management (`backend/src/plugins/security.ts`)
- Implemented `securityPlugin` registered before `authPlugin` in `backend/src/server.ts`.
- Exports `SESSION_COOKIE_NAME = 'mh_session'`, `CSRF_COOKIE_NAME = 'mh_csrf'`.
- Decorates Fastify request with `request.cookies` via `onRequest` hook parsing `request.raw.headers.cookie` with standard `cookie.parse`.
- Decorates Fastify reply with `reply.setCookie(name, value, options)` and `reply.clearCookie(name, options)` with standard `cookie.serialize`.
- Helper `setAuthCookies(reply, token, csrfToken)` sets `mh_session` (`httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `secure: process.env.NODE_ENV === 'production'`, `maxAge: 28800`) and `mh_csrf` (`httpOnly: false`, `sameSite: 'lax'`, `path: '/'`, `maxAge: 28800`).
- Helper `clearAuthCookies(reply)` clears both `mh_session` and `mh_csrf` with `maxAge: 0` and `expires: new Date(0)`.
- Helper `createCsrfToken()` produces HMAC-SHA256 signed tokens (`${raw}.${signature}`).
- Helper `verifyCsrfToken(token)` verifies cryptographic HMAC signature using `crypto.timingSafeEqual`.
- Global `preHandler` hook strictly validates `X-CSRF-Token` or `x-csrf-token` header on mutation methods (`POST`, `PUT`, `PATCH`, `DELETE`) for all requests carrying an `mh_session` cookie (exempting unauthenticated public entrypoints `/api/auth/login`, `/api/auth/register`, `/api/platform/auth/login`, `/api/auth/logout`, `/api/platform/auth/logout`). Returns `HTTP 403 Forbidden` (`{ error: 'Invalid or missing CSRF token.' }`) on invalid or missing tokens.

### 1.2 Dual-Mode Authentication Plugin (`backend/src/plugins/auth.ts`)
- `fastify.authenticate` checks `request.cookies.mh_session` first; if absent, falls back to `Authorization: Bearer <token>`. Sets `request.authType = 'cookie' | 'bearer'`.
- Validates JWT payload against `fastify.jwt.verify<JWTPayload>(token)` and asserts active user status in database (`account_status === 'Active'`).
- `fastify.audit` decorator persists structured `AuditEvent` records with `mosque_id`, `actor_id`, `action`, `target_type`, `target_id`, `summary`, `request_id`, `ip_address`.

### 1.3 Strict CORS Configuration & Error Handler (`backend/src/server.ts`)
- `@fastify/cors` configured with `credentials: true`.
- Dynamic origin resolver matches against whitelisted origins (`http://localhost:3000`, `http://127.0.0.1:3000`, `http://localhost:5000`, `http://127.0.0.1:5000`, and comma-separated `process.env.CORS_ORIGIN`), while cleanly passing non-browser requests without `Origin` headers (curl, server-to-server, test injections).
- Exposes `Set-Cookie` and `X-CSRF-Token` headers.
- `server.setErrorHandler` captures Fastify/Ajv `error.validation` and returns `{ statusCode: 400, error: message, message, details: error.validation }`.

### 1.4 Centralized Request Validation Schemas (`backend/src/schemas/`)
- Created granular schema modules under `backend/src/schemas/`:
  - `common.schema.ts`: `idParamSchema`, `slugParamSchema`, `errorResponseSchema`.
  - `auth.schema.ts`: `registerSchema`, `loginSchema`, `switchTenantSchema`.
  - `donations.schema.ts`: `createDonationSchema`, `manualDonationSchema`, `queryDonationsSchema`, `reconcileDonationSchema`.
  - `programs.schema.ts`: `createProgramSchema`, `updateProgramSchema`, `programIdParamSchema`.
  - `registrations.schema.ts`: `registrationProgramParamSchema`, `attendanceCheckInSchema`.
  - `announcements.schema.ts`: `createAnnouncementSchema`, `updateAnnouncementSchema`, `announcementIdParamSchema`.
  - `memberships.schema.ts`: `inviteMembershipSchema`, `updateMembershipSchema`.
  - `mosques.schema.ts`: `createMosqueSchema`, `getMosqueSchema`, `updateMosqueSchema`.
  - `notifications.schema.ts`: `readNotificationSchema`, `programReminderSchema`.
  - `platform.schema.ts`: `platformLoginSchema`, `updateTenantStatusSchema`.
  - `index.ts`: Barrel export.
- Attached schemas to corresponding routes across all domain route files in `backend/src/routes/`.

### 1.5 AuditEvent Structured Logging Coverage & Metadata Fixes
- `backend/src/routes/mosques.ts`: Updated `POST /api/mosques` transaction to populate `request_id: request.id` and `ip_address: request.ip` on `tenant.applied`.
- `backend/src/routes/platform.ts`: Updated `PATCH /api/platform/tenants/:id/status` to populate `request_id: request.id` and `ip_address: request.ip` on `tenant.active` / `tenant.suspended`.
- Confirmed full metadata propagation across all financial, programme, attendance, announcement, membership, and tenant lifecycle audit points.

### 1.6 Frontend API Client Hardening (`frontend/src/lib/api.ts`)
- Added `credentials: 'include'` to all `fetch` invocations.
- Implemented `getCsrfToken()`, `setCsrfToken(token)`, and `fetchCsrfToken()` reading from `mh_csrf` cookie or localStorage.
- Attached `X-CSRF-Token` header automatically to all mutation methods (`POST`, `PUT`, `PATCH`, `DELETE`).
- Captures returned `csrfToken` in response payloads to refresh the client token cache.

### 1.7 Security Integration Test Suite (`backend/test/current/security.integration.test.ts`)
- Created comprehensive integration test suite covering all 5 security pillars across 19 automated test cases.

---

## 2. Logic Chain

```
[Requirement: HTTP-Only Session Security & CSRF Defense]
         │
         ▼
1. Plugin Architecture:
   Register `securityPlugin` providing cookie parsing/serialization and HMAC-based CSRF protection.
         │
         ▼
2. Dual-Mode Authentication:
   Update `fastify.authenticate` to inspect `request.cookies.mh_session` before falling back to `Authorization: Bearer <token>`.
         │
         ▼
3. CSRF Verification Hook:
   Intercept mutation HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`) with cookie credentials, enforcing cryptographic HMAC `X-CSRF-Token` presence.
         │
         ▼
4. Centralized Validation Schemas:
   Define JSON schemas in `backend/src/schemas/` and wire `server.setErrorHandler` to standardize 400 Bad Request error payloads.
         │
         ▼
5. Strict CORS & Frontend Client:
   Configure `credentials: true` and dynamic origin resolution on backend; configure `credentials: 'include'` and CSRF header propagation on frontend client.
         │
         ▼
6. Audit Logging Completeness:
   Ensure every sensitive state transition persists `actor_id`, `mosque_id`, `action`, `target_type`, `target_id`, `summary`, `request_id`, `ip_address`.
```

---

## 3. Caveats

1. **Production HTTPS vs Local HTTP**:
   In local development (`process.env.NODE_ENV !== 'production'`), cookies are served with `secure: false` over HTTP so local testing on `localhost` functions seamlessly without SSL certificate errors. In production, `secure: true` is automatically applied.
2. **Dual-Mode CSRF Exemption**:
   CSRF protection is specifically targeted at browser sessions where ambient credentials (`mh_session` cookies) are automatically attached by the user agent. API clients authenticating via explicit `Authorization: Bearer <token>` headers are immune to ambient credential replay and are exempt from CSRF validation.

---

## 4. Conclusion

All Milestone 2 requirements and acceptance criteria have been fully implemented and verified:
- HTTP-only cookie session authentication (`mh_session`) with dual-mode fallback to Bearer tokens.
- Cryptographic CSRF token generation (`GET /api/auth/csrf`) and 403 enforcement on mutation routes.
- Strict CORS configuration with credentials support and dynamic origin resolution.
- Centralized request validation schemas attached across all route modules with standardized 400 error payloads.
- Structured AuditEvent persistence capturing all 8 audit metadata fields (`actor_id`, `mosque_id`, `action`, `target_type`, `target_id`, `summary`, `request_id`, `ip_address`).
- Frontend API client updated with credentials and automatic CSRF header transmission.
- 19-test security integration test suite deployed at `backend/test/current/security.integration.test.ts`.

---

## 5. Verification Method

To independently verify the implementation, execute the following commands:

```bash
# 1. Run backend integration test suite (including security.integration.test.ts and platform.integration.test.ts)
npm --prefix backend run test

# 2. Run standalone backend & frontend logic tests
npm run test:logic

# 3. Verify backend TypeScript compilation
npm --prefix backend run build

# 4. Verify frontend Next.js build
npm --prefix frontend run build
```

### Invalidation Conditions:
- If a mutation request authenticated via `mh_session` cookie succeeds without a valid `X-CSRF-Token` header.
- If `GET /api/auth/csrf` does not return `{ csrfToken }` or fails to set `mh_csrf` cookie.
- If invalid schema inputs return a status code other than 400 or fail to return `{ error: string }`.
- If an AuditEvent record is created without `request_id` or `ip_address`.
