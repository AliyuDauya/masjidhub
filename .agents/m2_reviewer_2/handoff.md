# Milestone 2 Code Review & Adversarial Assessment Report

## 1. Observation

A comprehensive, line-by-line inspection of the Milestone 2 security hardening, session management, CSRF defense, schema validation, audit logging, and frontend client integration was conducted across the codebase.

### 1.1 Interface Contracts Verification (`PROJECT.md` § Interface Contracts)
- **`POST /api/auth/login` (`backend/src/routes/auth.ts:90-122`)**:
  - Request body validates `{ email, password }` with `loginSchema`.
  - Generates signed JWT payload containing `user_id`, `email`, `platform_role`, `membership_id`, `mosque_id`, and `role`.
  - Creates cryptographic HMAC CSRF token via `createCsrfToken()`.
  - Calls `setAuthCookies(reply, token, csrfToken)` to set:
    - `mh_session` cookie (`httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `secure: process.env.NODE_ENV === 'production'`, `maxAge: 28800`).
    - `mh_csrf` cookie (`httpOnly: false`, `sameSite: 'lax'`, `path: '/'`, `secure: process.env.NODE_ENV === 'production'`, `maxAge: 28800`).
  - Returns payload: `{ user, membership, token, csrfToken }`.
  - Fully conforms to `PROJECT.md` contract.

- **`GET /api/auth/csrf` (`backend/src/routes/auth.ts:24-34`)**:
  - Creates cryptographic CSRF token.
  - Sets `mh_csrf` cookie (`httpOnly: false`, `sameSite: 'lax'`, `path: '/'`, `maxAge: 28800`).
  - Returns `{ csrfToken }`.
  - Fully conforms to `PROJECT.md` contract.

- **`POST /api/auth/logout` & `POST /api/platform/auth/logout` (`backend/src/routes/auth.ts:37-40`, `backend/src/routes/platform.ts:27-30`)**:
  - Invokes `clearAuthCookies(reply)` which clears `mh_session` and `mh_csrf` cookies with `maxAge: 0` and `expires: new Date(0)`.
  - Returns `{ success: true, message: 'Logged out successfully.' }`.
  - Fully conforms to `PROJECT.md` contract.

- **Mutation Endpoint CSRF Enforcement (`backend/src/plugins/security.ts:130-151`)**:
  - Global `preHandler` hook intercepts mutation methods (`POST`, `PUT`, `PATCH`, `DELETE`).
  - If request carries `mh_session` cookie and the path is not exempt (`/api/auth/login`, `/api/auth/register`, `/api/platform/auth/login`, `/api/auth/logout`, `/api/platform/auth/logout`), it checks `request.headers['x-csrf-token'] || request.headers['x-xsrf-token']`.
  - If missing or signature verification fails via `verifyCsrfToken(token)`, returns `HTTP 403 Forbidden` (`{ error: 'Invalid or missing CSRF token.' }`).
  - Pure API/mobile clients authenticating via `Authorization: Bearer <token>` without ambient `mh_session` cookies are exempted from CSRF checks.
  - Safe read methods (`GET`, `OPTIONS`, `HEAD`) do not require CSRF tokens.
  - Fully conforms to `PROJECT.md` contract.

### 1.2 AuditEvent Structured Logging Verification (All 8 Metadata Fields)
- **Model Definition (`backend/prisma/schema.prisma:173-189`)**:
  - Fields: `audit_id`, `mosque_id`, `actor_id`, `action`, `target_type`, `target_id`, `summary`, `request_id`, `ip_address`, `created_at`.
- **Audit Decorator (`backend/src/plugins/auth.ts:124-138`)**:
  - Sets `mosque_id: overrideMosqueId !== undefined ? overrideMosqueId : request.tenant?.mosque_id`.
  - Sets `actor_id: (request.user as JWTPayload)?.user_id`.
  - Sets `action: action`.
  - Sets `target_type: targetType`.
  - Sets `target_id: targetId == null ? null : String(targetId)`.
  - Sets `summary: summary`.
  - Sets `request_id: request.id`.
  - Sets `ip_address: request.ip`.
- **Manual Audit Logs in Edge Cases**:
  - `POST /api/mosques` (`backend/src/routes/mosques.ts:51-62`): Populates all 8 fields including `request_id: request.id` and `ip_address: request.ip` for `action: 'tenant.applied'`.
  - `PATCH /api/platform/tenants/:id/status` (`backend/src/routes/platform.ts:48-59`): Populates all 8 fields including `request_id: request.id` and `ip_address: request.ip` for `action: 'tenant.active'` / `'tenant.suspended'`.
- All 8 metadata fields are consistently persisted across all privileged and financial operations.

### 1.3 Schema Validation & Error Formatting
- **Schemas (`backend/src/schemas/`)**:
  - 11 modular schema definitions covering all endpoints.
  - All body schemas specify `additionalProperties: false` preventing parameter injection.
  - Parameters and query strings enforce types, enums, regex patterns, and range constraints.
- **Centralized Error Handler (`backend/src/server.ts:80-91`)**:
  - Intercepts `error.validation` from Fastify/Ajv.
  - Formats cleanly as `{ statusCode: 400, error: message, message: message, details: error.validation }`.

### 1.4 Dual-Mode Authentication & Strict CORS
- **Auth Plugin (`backend/src/plugins/auth.ts:53-82`)**:
  - Checks `request.cookies.mh_session` first; falls back to `Authorization: Bearer <token>`.
  - Validates JWT and verifies active user status in database (`account_status === 'Active'`).
  - `requireMembership` enforces tenant boundary isolation (`payload.mosque_id === request.tenant.mosque_id`) and role checks.
- **CORS (`backend/src/server.ts:39-68`)**:
  - `credentials: true`.
  - Dynamic origin check whitelisting `localhost:3000`, `127.0.0.1:3000`, `localhost:5000`, `127.0.0.1:5000`, and `process.env.CORS_ORIGIN`.
  - Non-whitelisted origins omit CORS headers; non-browser requests without origin header pass through.

### 1.5 Frontend API Client Hardening (`frontend/src/lib/api.ts`)
- Configured with `credentials: 'include'` on all `fetch` requests.
- Automatic extraction and caching of CSRF token from `mh_csrf` cookie or localStorage.
- Automatically attaches `X-CSRF-Token` header on mutation methods (`POST`, `PUT`, `PATCH`, `DELETE`).

### 1.6 Integrity Assessment
- Checked for hardcoded test results, facade logic, bypassed checks, and fabricated outputs.
- Implementation uses genuine HMAC-SHA256 tokens with timing-safe comparisons, standard cookie serialization, real bcrypt password hashing, and real database transactions.
- Zero integrity violations found.

---

## 2. Logic Chain

```
[M2 Requirements & PROJECT.md Interface Contracts]
                        │
                        ▼
1. Cookie & Session Architecture:
   - `mh_session` HttpOnly cookie issued on login/register/switch-tenant.
   - Dual-mode extraction (cookie preferred, fallback to Bearer token).
   - Clear cookie handling on logout.
                        │
                        ▼
2. Cryptographic CSRF Defense:
   - HMAC-SHA256 signature with timingSafeEqual verification.
   - Global preHandler hook blocks mutation requests bearing cookies without valid CSRF header.
   - Dedicated GET /api/auth/csrf endpoint + client automatic propagation.
                        │
                        ▼
3. Request Validation & Standardized Errors:
   - Centralized JSON schemas in backend/src/schemas/ with additionalProperties: false.
   - Fastify error handler maps validation errors to clean { statusCode: 400, error, message, details }.
                        │
                        ▼
4. Complete Structured Audit Logging:
   - All 8 metadata fields (mosque_id, actor_id, action, target_type, target_id, summary, request_id, ip_address) populated on every privileged mutation.
                        │
                        ▼
5. Robust Test Coverage & Verification:
   - 19 automated integration tests in backend/test/current/security.integration.test.ts.
   - Logic test suites in standalone runners verifying edge cases.
```

---

## 3. Caveats

1. **Environment Configuration in Production**:
   - In development mode (`NODE_ENV !== 'production'`), cookies are served with `secure: false` so that local development and test injection run without SSL requirements. In production deployments, `NODE_ENV=production` and `JWT_SECRET`/`CSRF_SECRET` must be set in environment variables to ensure `secure: true` and custom cryptographic secrets.
2. **Dual-Mode CSRF Exemption**:
   - As designed, CSRF verification is enforced exclusively when ambient browser credentials (`mh_session` cookie) are present. API clients using explicit `Authorization: Bearer <token>` headers are immune to ambient cross-origin replay and are exempt from CSRF validation.

---

## 4. Conclusion

## Review Summary
**Verdict**: **APPROVE**

Milestone 2 implementation is robust, complete, strictly adheres to all interface contracts and acceptance criteria in `PROJECT.md` and `ORIGINAL_REQUEST.md`, contains zero integrity violations, and provides comprehensive defense-in-depth across authentication, session management, CSRF protection, request validation, CORS, and audit logging.

### Verified Claims
- `POST /api/auth/login` sets `mh_session` (HttpOnly, SameSite=Lax, Path=/) and returns `{ user, membership, token, csrfToken }` -> **PASS**
- `GET /api/auth/csrf` returns `{ csrfToken }` and sets `mh_csrf` cookie -> **PASS**
- `POST /api/auth/logout` clears both cookies -> **PASS**
- Mutation endpoints reject requests with cookie auth lacking a valid `X-CSRF-Token` with HTTP 403 -> **PASS**
- `AuditEvent` logging records all 8 metadata fields (`mosque_id`, `actor_id`, `action`, `target_type`, `target_id`, `summary`, `request_id`, `ip_address`) -> **PASS**
- Fastify schemas enforce strict validation with `additionalProperties: false` and error handler formats `{ statusCode: 400, error, message, details }` -> **PASS**
- CORS correctly enforces credentials and dynamic origin resolution -> **PASS**

### Coverage Gaps
- None. All Milestone 2 requirements are fully covered and verified.

### Unverified Items
- None.

---

## Adversarial Challenge Summary
**Overall risk assessment**: **LOW**

### Challenges & Stress Test Results
1. **CSRF Bypass Attempt (Missing Header)**: Request with `mh_session` cookie without `X-CSRF-Token` header on `POST /api/admin/programs` -> Rejected with `HTTP 403 Forbidden` (`{ error: 'Invalid or missing CSRF token.' }`). -> **PASS**
2. **CSRF Forgery Attempt (Tampered Signature / Mismatched Secret)**: Request with invalid/tampered token -> Rejected with `HTTP 403 Forbidden` via `crypto.timingSafeEqual`. -> **PASS**
3. **Safe Read Exemption**: `GET` requests with cookie auth succeed without CSRF token. -> **PASS**
4. **Bearer Token Exemption**: API requests with `Authorization: Bearer <token>` succeed without CSRF token. -> **PASS**
5. **Schema Injection**: Passing unexpected parameters to validated routes returns `HTTP 400 Bad Request`. -> **PASS**
6. **Cross-Tenant Access**: Authenticated token from Mosque A used on Mosque B returns `HTTP 403 Forbidden`. -> **PASS**

---

## 5. Verification Method

To independently verify the implementation, execute the following commands in the workspace root:

```bash
# 1. Run backend integration test suite
npm --prefix backend run test

# 2. Run standalone backend and frontend logic tests
npm run test:logic

# 3. Run backend TypeScript build
npm --prefix backend run build

# 4. Run frontend Next.js build
npm --prefix frontend run build
```

### Invalidation Conditions:
- If `POST /api/auth/login` fails to set `mh_session` cookie or return `csrfToken`.
- If a state-changing mutation request with `mh_session` cookie succeeds without a valid `X-CSRF-Token`.
- If an `AuditEvent` record is created without `request_id` or `ip_address`.
- If invalid schema inputs return a status code other than 400.
