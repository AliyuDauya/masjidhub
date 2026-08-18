# Milestone 2: Adversarial Challenger 1 Handoff Report — Session Security & CSRF Protections

## 1. Observation

Direct code analysis, adversarial attack vector modeling, and integration test authoring across the codebase yielded the following observations:

### 1.1 CSRF Token Generation & Verification Robustness (`backend/src/plugins/security.ts`)
- **HMAC Construction**: `createCsrfToken()` (lines 32–36) produces tokens formatted as `${raw}.${signature}` where `raw` contains 24 bytes of entropy (`48` hex characters) and `signature` is an HMAC-SHA256 digest (`64` hex characters) computed with `CSRF_SECRET`.
- **Timing-Safe Verification**: `verifyCsrfToken()` (lines 38–47) strictly checks:
  1. `if (!token || typeof token !== 'string') return false;`
  2. `const parts = token.split('.'); if (parts.length !== 2) return false;`
  3. `const [raw, signature] = parts; if (!raw || !signature) return false;`
  4. `if (signature.length !== expected.length) return false;` (protects `crypto.timingSafeEqual` against unhandled `TypeError` on mismatched buffer byte lengths)
  5. `return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));` (prevents side-channel timing attacks)

### 1.2 CSRF Enforcement on Mutation Methods (`backend/src/plugins/security.ts`)
- Global `preHandler` hook (lines 130–151):
  - Filters on HTTP verbs: `mutationMethods = ['POST', 'PUT', 'PATCH', 'DELETE']`
  - Inspects `request.cookies?.[SESSION_COOKIE_NAME]` (`mh_session`).
  - Strips query string from path: `const path = request.url.split('?')[0];`
  - Exempts only public unauthenticated entrypoints: `/api/auth/login`, `/api/auth/register`, `/api/platform/auth/login`, `/api/auth/logout`, `/api/platform/auth/logout`.
  - Checks headers: `request.headers['x-csrf-token'] || request.headers['x-xsrf-token']`.
  - Rejects missing or invalid CSRF tokens with `HTTP 403 Forbidden` (`{ error: 'Invalid or missing CSRF token.' }`).

### 1.3 Dual-Mode Authentication Logic (`backend/src/plugins/auth.ts`)
- `fastify.authenticate` (lines 53–82):
  - Priority 1: `request.cookies?.[SESSION_COOKIE_NAME]` -> sets `request.authType = 'cookie'`
  - Priority 2 (Fallback): `request.headers.authorization` matching `/^Bearer$/i` -> sets `request.authType = 'bearer'`
  - Verifies JWT token and checks active user status in database.
  - Non-browser API clients using Bearer tokens without `mh_session` cookie bypass CSRF check safely because ambient credentials are not in play, satisfying dual-mode API requirements.

### 1.4 Cookie Flags and Lifecycle (`backend/src/plugins/security.ts` & `backend/src/routes/auth.ts`)
- Login / Register sets `mh_session` cookie with `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `maxAge: 28800` (and `secure: true` in production).
- Login / Register / `GET /api/auth/csrf` sets `mh_csrf` cookie with `httpOnly: false` (allowing client JavaScript to read and attach as header), `sameSite: 'lax'`, `path: '/'`, `maxAge: 28800`.
- Logout (`POST /api/auth/logout` and `POST /api/platform/auth/logout`) sets `maxAge: 0` and `expires: new Date(0)` for both `mh_session` and `mh_csrf`.

### 1.5 Adversarial Test Suites
- Authored `backend/test/current/adversarial_csrf_session.integration.test.ts` implementing 7 attack vectors:
  1. Mutation requests (`POST`, `PUT`, `PATCH`, `DELETE`) with session cookie missing `X-CSRF-Token` -> 403 Forbidden.
  2. Forged, tampered, truncated, multi-dot, and wrong-key CSRF tokens -> 403 Forbidden.
  3. HMAC unit robustness against non-string and single-byte bitflips.
  4. Dual-mode Bearer token mutation validation & mixed cookie+bearer CSRF enforcement.
  5. Cookie security attributes (`HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=28800`, logout clearing).
  6. Header casing (`X-CSRF-Token`, `x-csrf-token`, `x-xsrf-token`).
  7. Safe read methods (`GET`, `OPTIONS`) unhindered.
- Added standalone unit verification suites in `backend/test/standalone_runner.js` and `frontend/__tests__/standalone_runner.js`.

---

## 2. Logic Chain

```
[M2 Security Hardening Verification Goal]
                   │
                   ▼
1. Stress-Test Missing CSRF on Cookie Mutations:
   Any state-changing request (POST, PUT, PATCH, DELETE) bearing `mh_session`
   without `X-CSRF-Token` is intercepted by `security.ts:130` preHandler and rejected with 403.
                   │
                   ▼
2. Stress-Test Forged & Tampered Tokens:
   Forged tokens, modified payloads, altered HMAC signatures, wrong secret keys,
   and length-mismatched strings fail `verifyCsrfToken()` and trigger 403.
                   │
                   ▼
3. Stress-Test Timing Attacks:
   `verifyCsrfToken()` validates length before calling `crypto.timingSafeEqual()`,
   preventing unhandled buffer length exceptions while ensuring constant-time comparison.
                   │
                   ▼
4. Verify Dual-Mode Authorization:
   Pure Bearer token requests omit cookies; `securityPlugin` skips CSRF check,
   and `authPlugin` authenticates via Bearer header, permitting valid automated API mutations.
                   │
                   ▼
5. Verify Cookie Attribute Safety:
   Session cookies cannot be read via `document.cookie` (HttpOnly), CSRF cookies are accessible
   to frontend JavaScript for header inclusion, and both cookies are revoked upon logout.
```

---

## 3. Caveats

1. **Local Development vs Production SSL**:
   In local development (`NODE_ENV !== 'production'`), `secure: false` is configured to allow testing over plaintext HTTP on `localhost`. In production (`NODE_ENV === 'production'`), `secure: true` is automatically enforced.
2. **Mixed Credential Edge Case**:
   If an attacker submits both `mh_session` cookie AND a Bearer token, the CSRF preHandler strictly enforces CSRF token presence because browser ambient credentials are present on the request wire. This is the correct defensive behavior.

---

## 4. Conclusion

The Session Security and CSRF defense implementation is robust, cryptographically sound, and meets all Milestone 2 requirements without bypass vulnerabilities or regressions.

### Explicit Verdict: **APPROVE**

---

## 5. Verification Method

To independently execute and verify the adversarial test suite and logic checks:

```bash
# 1. Run all backend integration tests (including adversarial test suite)
npm --prefix backend run test

# 2. Run backend and frontend logic tests
npm run test:logic

# 3. Verify backend TypeScript compilation
npm --prefix backend run build

# 4. Verify frontend Next.js compilation
npm --prefix frontend run build
```

### Invalidation Conditions:
- If any mutation request (`POST`, `PUT`, `PATCH`, `DELETE`) with an `mh_session` cookie succeeds without a valid `X-CSRF-Token` header.
- If a forged, tampered, or mismatched HMAC CSRF token is accepted.
- If `mh_session` is issued without `HttpOnly` or fails to clear on logout.
- If authorized Bearer token API requests fail to execute mutations when no session cookie is present.
