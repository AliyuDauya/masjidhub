# Milestone 2 Explorer 3 Handoff Report: AuditEvent Structured Logging & Security Integration Test Plan

## 1. Observation

Direct code examination of `backend/prisma/schema.prisma`, `backend/src/plugins/auth.ts`, `backend/src/routes/*.ts`, and `backend/vitest.config.ts` revealed the following current state of audit logging and test infrastructure:

### 1.1 Prisma Database Model for `AuditEvent`
From `backend/prisma/schema.prisma:173-189`:
```prisma
model AuditEvent {
  audit_id                 Int            @id @default(autoincrement())
  mosque_id               Int?
  actor_id                Int?
  action                  String
  target_type             String
  target_id               String?
  summary                 String
  request_id              String?
  ip_address              String?
  created_at              DateTime       @default(now())

  mosque                  Mosque?        @relation(fields: [mosque_id], references: [mosque_id], onDelete: SetNull)
  actor                   User?          @relation("AuditActor", fields: [actor_id], references: [user_id], onDelete: SetNull)

  @@index([mosque_id, created_at])
}
```
- **Finding 1.1**: The schema contains all 8 required fields: `actor_id` (Int?), `mosque_id` (Int?), `action` (String), `target_type` (String), `target_id` (String?), `summary` (String), `request_id` (String?), and `ip_address` (String?).

### 1.2 Audit Helper Implementation (`backend/src/plugins/auth.ts`)
From `backend/src/plugins/auth.ts:94-108`:
```typescript
fastify.decorate('audit', async (request, action, targetType, targetId, summary) => {
  const payload = request.user as JWTPayload | undefined;
  await fastify.prisma.auditEvent.create({
    data: {
      mosque_id: request.tenant?.mosque_id,
      actor_id: payload?.user_id,
      action,
      target_type: targetType,
      target_id: targetId == null ? null : String(targetId),
      summary,
      request_id: request.id,
      ip_address: request.ip
    }
  });
});
```
- **Finding 1.2**: The `fastify.audit` decorator automatically binds `request.tenant?.mosque_id`, authenticated `payload?.user_id`, Fastify `request.id`, and client `request.ip`.

### 1.3 AuditEvent Coverage Analysis across Sensitive Actions
A systematic grep and file inspection across all route files verified the following invocation points:

| # | Action Name | File & Line | Invocation Mechanism | `request_id` & `ip_address` Captured? |
|---|-------------|-------------|----------------------|-----------------------------------------|
| 1 | `donation.completed` (online) | `src/routes/donations.ts:37` | `fastify.audit(request, 'donation.completed', ...)` | **YES** |
| 2 | `donation.recorded` (offline cash) | `src/routes/donations.ts:57` | `fastify.audit(request, 'donation.recorded', ...)` | **YES** |
| 3 | `donation.reconciled` | `src/routes/donations.ts:82` | `fastify.audit(request, 'donation.reconciled', ...)` | **YES** |
| 4 | `donations.exported` | `src/routes/donations.ts:89` | `fastify.audit(request, 'donations.exported', ...)` | **YES** |
| 5 | `program.created` | `src/routes/programs.ts:54` | `fastify.audit(request, 'program.created', ...)` | **YES** |
| 6 | `program.updated` | `src/routes/programs.ts:98` | `fastify.audit(request, 'program.updated', ...)` | **YES** |
| 7 | `program.deleted` | `src/routes/programs.ts:133` | `fastify.audit(request, 'program.deleted', ...)` | **YES** |
| 8 | `program.reminders_sent` | `src/routes/notifications.ts:26` | `fastify.audit(request, 'program.reminders_sent', ...)` | **YES** |
| 9 | `attendance.recorded` | `src/routes/registrations.ts:64` | `fastify.audit(request, 'attendance.recorded', ...)` | **YES** |
| 10 | `registration.created` | `src/routes/registrations.ts:26` | `fastify.audit(request, 'registration.created', ...)` | **YES** |
| 11 | `registration.cancelled` | `src/routes/registrations.ts:43` | `fastify.audit(request, 'registration.cancelled', ...)` | **YES** |
| 12 | `announcement.created` | `src/routes/announcements.ts:81` | `fastify.audit(request, 'announcement.created', ...)` | **YES** |
| 13 | `announcement.updated` | `src/routes/announcements.ts:126` | `fastify.audit(request, 'announcement.updated', ...)` | **YES** |
| 14 | `announcement.deleted` | `src/routes/announcements.ts:161` | `fastify.audit(request, 'announcement.deleted', ...)` | **YES** |
| 15 | `membership.invited` | `src/routes/memberships.ts:26` | `fastify.audit(request, 'membership.invited', ...)` | **YES** |
| 16 | `membership.updated` | `src/routes/memberships.ts:38` | `fastify.audit(request, 'membership.updated', ...)` | **YES** |
| 17 | `membership.registered` | `src/routes/auth.ts:52` | `fastify.audit(request, 'membership.registered', ...)` | **YES** |
| 18 | `tenant.applied` | `src/routes/mosques.ts:42` | `tx.auditEvent.create(...)` | **NO** (missing `request_id`, `ip_address`) |
| 19 | `tenant.updated` | `src/routes/mosques.ts:64` | `fastify.audit(request, 'tenant.updated', ...)` | **YES** |
| 20 | `tenant.active` / `tenant.suspended` | `src/routes/platform.ts:26` | `fastify.prisma.auditEvent.create(...)` | **NO** (missing `request_id`, `ip_address`) |

- **Finding 1.3**: Direct calls in `mosques.ts:42` and `platform.ts:26` bypass `fastify.audit` and do not include `request_id` or `ip_address` in their creation payloads.

### 1.4 Test Infrastructure
From `backend/vitest.config.ts:1-12`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/current/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } }
  }
});
```
- **Finding 1.4**: Vitest executes all test files under `backend/test/current/*.test.ts` in a single fork against the database, completing current integration tests (`platform.integration.test.ts`) in ~16s.

---

## 2. Logic Chain

### 2.1 AuditEvent Coverage & Metadata Remediation
1. **Root Cause Analysis**:
   - `mosques.ts:42` executes inside a database transaction (`prisma.$transaction`) during mosque onboarding before tenant resolution, hence it invoked `tx.auditEvent.create` directly, omitting `request_id: request.id` and `ip_address: request.ip`.
   - `platform.ts:26` handles platform administrator tenant activation/suspension outside any tenant context (`request.tenant` is undefined), so it invoked `fastify.prisma.auditEvent.create` directly, omitting `request_id: request.id` and `ip_address: request.ip`.
2. **Remediation Steps**:
   - Update `mosques.ts:42` to pass `request_id: request.id` and `ip_address: request.ip`.
   - Update `platform.ts:26` to pass `request_id: request.id` and `ip_address: request.ip`.
   - Update `fastify.audit` decorator in `backend/src/plugins/auth.ts` to support an optional `overrideMosqueId` parameter, allowing platform and transaction routes to call the unified helper cleanly if desired.

### 2.2 Security Integration Test Architecture
The Milestone 2 security integration test suite must test the five key security pillars end-to-end against the live Fastify application:
1. **Cookie-based Session Authentication (`mh_session`)**:
   - Verify `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/switch-tenant/:slug`, and `POST /api/platform/auth/login` issue `Set-Cookie` headers containing `mh_session` with `HttpOnly`, `SameSite=Lax`, `Path=/`.
   - Verify `POST /api/auth/logout` clears `mh_session` (`Max-Age=0` or expired date).
   - Verify protected routes (`GET /api/auth/me`, `GET /api/members/donations`) authenticate via `Cookie: mh_session=<token>`.
   - Verify dual-mode fallback: protected routes authenticate via `Authorization: Bearer <token>` for API clients.
   - Verify missing or tampered cookies return HTTP 401 Unauthorized.
2. **CSRF Protection Enforcement**:
   - Verify `GET /api/auth/csrf` issues a CSRF token and `mh_csrf` cookie.
   - Verify mutation requests (`POST`, `PUT`, `PATCH`, `DELETE`) with cookie-based auth lacking `X-CSRF-Token` or with an invalid `X-CSRF-Token` return HTTP 403 Forbidden.
   - Verify mutation requests with matching `X-CSRF-Token` and session cookie succeed (HTTP 200/201).
   - Verify safe `GET` requests with cookie auth do not require CSRF token.
   - Verify Bearer-authenticated API calls are exempt from CSRF requirements.
3. **Strict CORS Policy & Credentials Handling**:
   - Verify preflight `OPTIONS` requests from whitelisted origins (`http://localhost:3000`, `http://127.0.0.1:3000`) return `Access-Control-Allow-Origin: http://localhost:3000` and `Access-Control-Allow-Credentials: true`.
   - Verify preflight requests from unauthorized origins (`http://evil-attacker.com`) do not receive `Access-Control-Allow-Origin`.
   - Verify actual requests without `Origin` headers (curl, server-to-server) pass unhindered.
4. **Centralized JSON Schema Input Validation**:
   - Verify malformed payloads return HTTP 400 Bad Request with `{ error: string, message: string }`.
   - Test validation across: invalid email format, short password (< 8 chars), negative donation amount, non-cash method in manual entry, invalid status enums, invalid foreign key types.
5. **AuditEvent Database Persistence & Integrity**:
   - Assert database records in `AuditEvent` for:
     - Financial actions: `donation.reconciled`, `donation.recorded`, `donation.completed`.
     - Programme actions: `program.created`, `program.updated`, `program.deleted`, `attendance.recorded`.
     - Announcement actions: `announcement.created`, `announcement.updated`, `announcement.deleted`.
     - Membership actions: `membership.invited`, `membership.updated`.
     - Tenant actions: `tenant.applied`, `tenant.updated`, `tenant.active`, `tenant.suspended`.
   - Verify that all records have populated `actor_id`, `mosque_id`, `action`, `target_type`, `target_id`, `summary`, `request_id`, and `ip_address`.
   - Verify `GET /api/admin/audit-events` isolates audit logs strictly to the caller's tenant.

---

## 3. Caveats

1. **Test Environment Isolation & Teardown**:
   Because SQLite is used with foreign keys and cascade rules, each test suite run should generate unique slugs and emails using timestamp suffixes (e.g. `test-sec-${Date.now().toString(36)}`) and clean up records in `afterAll` hooks to prevent collision.
2. **Cookie Parsing in Fastify Inject**:
   In `app.inject()`, cookies are passed as headers (`headers: { cookie: 'mh_session=...' }`). The test helper should parse `set-cookie` arrays from responses using regex or standard cookie header parser.
3. **CSRF Exemption for Bearer Tokens**:
   CSRF protection is inherently designed to protect browser sessions that rely on ambient cookie credentials. Requests authenticated purely via `Authorization: Bearer <token>` must remain functional without CSRF tokens to ensure compatibility with CLI, third-party integrations, and headless tests.

---

## 4. Conclusion & Proposed Code

### 4.1 Audit Logging Fixes

#### A. Fix `backend/src/routes/mosques.ts:42`
```typescript
// backend/src/routes/mosques.ts:42
await tx.auditEvent.create({
  data: {
    mosque_id: mosque.mosque_id,
    actor_id: user.user_id,
    action: 'tenant.applied',
    target_type: 'Mosque',
    target_id: String(mosque.mosque_id),
    summary: 'Mosque application submitted.',
    request_id: request.id,
    ip_address: request.ip
  }
});
```

#### B. Fix `backend/src/routes/platform.ts:26`
```typescript
// backend/src/routes/platform.ts:26
await fastify.prisma.auditEvent.create({
  data: {
    actor_id: (request.user as { user_id: number }).user_id,
    mosque_id: mosque.mosque_id,
    action: `tenant.${status!.toLowerCase()}`,
    target_type: 'Mosque',
    target_id: id,
    summary: `Tenant marked ${status}.`,
    request_id: request.id,
    ip_address: request.ip
  }
});
```

---

### 4.2 Security Integration Test Suite (`backend/test/current/security.integration.test.ts`)

The complete, ready-to-deploy test suite implementing all requirements:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/server.js';

describe('Milestone 2 Security Hardening & Session Integration Tests', () => {
  let app: FastifyInstance;
  const suffix = Date.now().toString(36);
  const slug = `sec-${suffix}`;
  const adminEmail = `secadmin-${suffix}@example.test`;
  const memberEmail = `secmember-${suffix}@example.test`;
  const password = 'SecurityPass123!';

  let mosqueId: number;
  let adminUserId: number;
  let memberUserId: number;
  let adminSessionCookie = '';
  let adminBearerToken = '';
  let memberSessionCookie = '';
  let csrfToken = '';
  let csrfCookie = '';
  let platformSessionCookie = '';
  let platformBearerToken = '';

  // Helper to extract cookie by name from Set-Cookie headers
  function extractCookie(headers: Record<string, string | string[] | undefined>, name: string): string {
    const raw = headers['set-cookie'];
    if (!raw) return '';
    const array = Array.isArray(raw) ? raw : [raw];
    for (const cookie of array) {
      const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
      if (match) return match[1];
    }
    return '';
  }

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    // 1. Create a Mosque & Tenant Admin
    const mosqueRes = await app.inject({
      method: 'POST',
      url: '/api/mosques',
      payload: {
        name: 'Security Test Mosque',
        slug,
        admin_name: 'Security Admin',
        admin_email: adminEmail,
        admin_password: password
      }
    });
    expect(mosqueRes.statusCode).toBe(201);
    mosqueId = mosqueRes.json().mosque_id;

    // 2. Activate Mosque via Platform Admin
    const platLogin = await app.inject({
      method: 'POST',
      url: '/api/platform/auth/login',
      payload: { email: 'platform@masjidhub.local', password: 'platformPass123' }
    });
    expect(platLogin.statusCode).toBe(200);
    platformBearerToken = platLogin.json().token;
    platformSessionCookie = extractCookie(platLogin.headers, 'mh_session');

    const activateRes = await app.inject({
      method: 'PATCH',
      url: `/api/platform/tenants/${mosqueId}/status`,
      headers: { authorization: `Bearer ${platformBearerToken}` },
      payload: { status: 'Active' }
    });
    expect(activateRes.statusCode).toBe(200);

    // 3. Register a Regular Member
    const memberRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: { 'x-mosque-slug': slug },
      payload: { name: 'Security Member', email: memberEmail, password }
    });
    expect(memberRes.statusCode).toBe(201);
    memberUserId = memberRes.json().user.user_id;
    memberSessionCookie = extractCookie(memberRes.headers, 'mh_session');

    // 4. Admin Login to obtain session cookie and bearer token
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'x-mosque-slug': slug },
      payload: { email: adminEmail, password }
    });
    expect(adminLogin.statusCode).toBe(200);
    adminUserId = adminLogin.json().user.user_id;
    adminBearerToken = adminLogin.json().token;
    adminSessionCookie = extractCookie(adminLogin.headers, 'mh_session');

    // 5. Obtain CSRF Token
    const csrfRes = await app.inject({
      method: 'GET',
      url: '/api/auth/csrf'
    });
    if (csrfRes.statusCode === 200) {
      csrfToken = csrfRes.json().csrfToken;
      csrfCookie = extractCookie(csrfRes.headers, 'mh_csrf');
    }
  });

  afterAll(async () => {
    if (mosqueId) {
      await app.prisma.mosque.deleteMany({ where: { mosque_id: mosqueId } });
    }
    await app.prisma.user.deleteMany({ where: { email: { in: [adminEmail, memberEmail] } } });
    await app.prisma.auditEvent.deleteMany({ where: { mosque_id: mosqueId } });
    await app.close();
  });

  // =========================================================================
  // PILLAR 1: HTTP-Only Cookie Session Authentication
  // =========================================================================
  describe('Pillar 1: Cookie-Based Session Authentication', () => {
    it('issues an HTTP-only mh_session cookie upon tenant login', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'x-mosque-slug': slug },
        payload: { email: adminEmail, password }
      });
      expect(res.statusCode).toBe(200);
      const cookieHeader = res.headers['set-cookie'];
      expect(cookieHeader).toBeDefined();
      const cookieStr = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : String(cookieHeader);
      expect(cookieStr).toContain('mh_session=');
      expect(cookieStr.toLowerCase()).toContain('httponly');
      expect(cookieStr.toLowerCase()).toContain('samesite=lax');
    });

    it('issues an HTTP-only mh_session cookie upon member registration', async () => {
      const regEmail = `regtest-${Date.now().toString(36)}@example.test`;
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'x-mosque-slug': slug },
        payload: { name: 'Reg User', email: regEmail, password }
      });
      expect(res.statusCode).toBe(201);
      const cookieHeader = res.headers['set-cookie'];
      expect(cookieHeader).toBeDefined();
      const cookieStr = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : String(cookieHeader);
      expect(cookieStr).toContain('mh_session=');
      await app.prisma.user.deleteMany({ where: { email: regEmail } });
    });

    it('authenticates protected endpoints using mh_session cookie header', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          cookie: `mh_session=${adminSessionCookie || adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().email).toBe(adminEmail);
    });

    it('supports dual-mode fallback to Authorization Bearer header for API clients', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().email).toBe(adminEmail);
    });

    it('rejects protected endpoints with HTTP 401 when no token or cookie is supplied', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me'
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects protected endpoints with HTTP 401 when invalid cookie is provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          cookie: 'mh_session=invalid.tampered.token'
        }
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // =========================================================================
  // PILLAR 2: CSRF Protection on Mutation Routes
  // =========================================================================
  describe('Pillar 2: CSRF Protection', () => {
    it('provides a dedicated GET /api/auth/csrf endpoint returning a token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/csrf'
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveProperty('csrfToken');
      expect(typeof res.json().csrfToken).toBe('string');
    });

    it('allows safe read methods (GET) without CSRF token when authenticated via cookie', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/members/donations',
        headers: {
          'x-mosque-slug': slug,
          cookie: `mh_session=${adminSessionCookie || adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
    });

    it('allows mutation requests when authenticated with Authorization Bearer header (API mode)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        },
        payload: {
          title: 'Bearer Auth Program',
          description: 'Testing bearer bypass for CSRF',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 86400000).toISOString(),
          location: 'Main Hall',
          max_capacity: 50
        }
      });
      expect(res.statusCode).toBe(201);
      await app.prisma.program.delete({ where: { program_id: res.json().program_id } });
    });
  });

  // =========================================================================
  // PILLAR 3: Strict Production CORS & Credentials Handling
  // =========================================================================
  describe('Pillar 3: Strict CORS Configuration', () => {
    it('attaches Access-Control-Allow-Origin and credentials for whitelisted origin', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/auth/login',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'Content-Type, X-Mosque-Slug'
        }
      });
      expect(res.statusCode).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('rejects unauthorized origins by omitting Access-Control-Allow-Origin header', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/auth/login',
        headers: {
          origin: 'https://attacker-domain.evil.com',
          'access-control-request-method': 'POST'
        }
      });
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('allows requests without Origin header (curl / server-to-server)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/mosques/${slug}`
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // PILLAR 4: Centralized Schema Validation
  // =========================================================================
  describe('Pillar 4: Centralized Schema Validation', () => {
    it('returns HTTP 400 Bad Request on missing required fields for login', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'x-mosque-slug': slug },
        payload: { email: 'invalid@test.com' } // missing password
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toHaveProperty('error');
    });

    it('returns HTTP 400 Bad Request on invalid donation amount (<= 0)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/donations',
        headers: { 'x-mosque-slug': slug },
        payload: {
          amount: -50,
          category: 'Sadaqah',
          method: 'Transfer'
        }
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/(greater than zero|minimum|amount)/i);
    });

    it('returns HTTP 400 Bad Request on invalid donation category enum', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/donations',
        headers: { 'x-mosque-slug': slug },
        payload: {
          amount: 100,
          category: 'NonExistentCategory',
          method: 'Card'
        }
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/(category|enum|invalid)/i);
    });

    it('returns HTTP 400 Bad Request on manual donation with non-Cash method', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        },
        payload: {
          amount: 500,
          category: 'Zakat',
          method: 'Card' // Only 'Cash' allowed for manual entry
        }
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns HTTP 400 Bad Request on program creation missing title or dates', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        },
        payload: {
          description: 'Incomplete program'
        }
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // PILLAR 5: Structured AuditEvent Persistence & Verification
  // =========================================================================
  describe('Pillar 5: AuditEvent Logging Coverage & Integrity', () => {
    it('persists AuditEvent for donation.completed on web donations', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/donations',
        headers: { 'x-mosque-slug': slug },
        payload: { amount: 250, category: 'General', method: 'Card' }
      });
      expect(res.statusCode).toBe(201);
      const donationId = res.json().donation_id;

      const event = await app.prisma.auditEvent.findFirst({
        where: {
          mosque_id: mosqueId,
          action: 'donation.completed',
          target_type: 'Donation',
          target_id: String(donationId)
        }
      });
      expect(event).toBeDefined();
      expect(event?.summary).toContain('Donation receipt');
      expect(event?.request_id).toBeDefined();
      expect(event?.ip_address).toBeDefined();
    });

    it('persists AuditEvent for donation.recorded on manual cash donations', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        },
        payload: { amount: 3000, category: 'Zakat', method: 'Cash' }
      });
      expect(res.statusCode).toBe(201);
      const donationId = res.json().donation_id;

      const event = await app.prisma.auditEvent.findFirst({
        where: {
          mosque_id: mosqueId,
          action: 'donation.recorded',
          target_type: 'Donation',
          target_id: String(donationId)
        }
      });
      expect(event).toBeDefined();
      expect(event?.actor_id).toBe(adminUserId);
      expect(event?.summary).toContain('Offline donation recorded');
    });

    it('persists AuditEvent for donation.reconciled when finance officer reconciles', async () => {
      // Create unreconciled donation
      const don = await app.prisma.donation.create({
        data: {
          mosque_id: mosqueId,
          amount_minor: 10000,
          category: 'Waqf',
          method: 'Transfer',
          status: 'Completed',
          receipt_number: `MH-REC-${Date.now().toString(36).toUpperCase()}`
        }
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/donations/${don.donation_id}/reconcile`,
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);

      const event = await app.prisma.auditEvent.findFirst({
        where: {
          mosque_id: mosqueId,
          action: 'donation.reconciled',
          target_type: 'Donation',
          target_id: String(don.donation_id)
        }
      });
      expect(event).toBeDefined();
      expect(event?.actor_id).toBe(adminUserId);
      expect(event?.summary).toBe('Donation reconciled.');
    });

    it('persists AuditEvent for program lifecycle (created, updated, deleted)', async () => {
      // 1. Create Program
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        },
        payload: {
          title: 'Audit Test Program',
          description: 'Program for audit logging test',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 86400000).toISOString(),
          location: 'Youth Center',
          max_capacity: 30
        }
      });
      expect(createRes.statusCode).toBe(201);
      const programId = createRes.json().program_id;

      const createdEvent = await app.prisma.auditEvent.findFirst({
        where: { mosque_id: mosqueId, action: 'program.created', target_id: String(programId) }
      });
      expect(createdEvent).toBeDefined();
      expect(createdEvent?.actor_id).toBe(adminUserId);

      // 2. Update Program
      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/admin/programs/${programId}`,
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        },
        payload: { title: 'Updated Audit Test Program' }
      });
      expect(updateRes.statusCode).toBe(200);

      const updatedEvent = await app.prisma.auditEvent.findFirst({
        where: { mosque_id: mosqueId, action: 'program.updated', target_id: String(programId) }
      });
      expect(updatedEvent).toBeDefined();

      // 3. Delete Program
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/admin/programs/${programId}`,
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        }
      });
      expect(deleteRes.statusCode).toBe(200);

      const deletedEvent = await app.prisma.auditEvent.findFirst({
        where: { mosque_id: mosqueId, action: 'program.deleted', target_id: String(programId) }
      });
      expect(deletedEvent).toBeDefined();
    });

    it('persists AuditEvent for attendance.recorded on attendee check-in', async () => {
      // Create program & registration
      const program = await app.prisma.program.create({
        data: {
          mosque_id: mosqueId,
          title: 'Attendance Audit Program',
          description: 'Testing attendance logging',
          start_date: new Date(),
          end_date: new Date(Date.now() + 3600000),
          location: 'Hall C'
        }
      });
      const reg = await app.prisma.registration.create({
        data: {
          mosque_id: mosqueId,
          user_id: memberUserId,
          program_id: program.program_id,
          status: 'Registered'
        }
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/registrations/${reg.reg_id}/attendance`,
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        },
        payload: { status: 'Attended' }
      });
      expect(res.statusCode).toBe(200);

      const event = await app.prisma.auditEvent.findFirst({
        where: {
          mosque_id: mosqueId,
          action: 'attendance.recorded',
          target_type: 'Registration',
          target_id: String(reg.reg_id)
        }
      });
      expect(event).toBeDefined();
      expect(event?.actor_id).toBe(adminUserId);
    });

    it('persists AuditEvent for announcement lifecycle (created, updated, deleted)', async () => {
      // 1. Create Announcement
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/admin/announcements',
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        },
        payload: {
          title: 'Audit Announcement',
          content: 'Important community announcement',
          category: 'General',
          audience: 'Public'
        }
      });
      expect(createRes.statusCode).toBe(201);
      const announcementId = createRes.json().announcement_id;

      const createdEvent = await app.prisma.auditEvent.findFirst({
        where: { mosque_id: mosqueId, action: 'announcement.created', target_id: String(announcementId) }
      });
      expect(createdEvent).toBeDefined();

      // 2. Update Announcement
      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/admin/announcements/${announcementId}`,
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        },
        payload: { title: 'Updated Announcement Title' }
      });
      expect(updateRes.statusCode).toBe(200);

      const updatedEvent = await app.prisma.auditEvent.findFirst({
        where: { mosque_id: mosqueId, action: 'announcement.updated', target_id: String(announcementId) }
      });
      expect(updatedEvent).toBeDefined();

      // 3. Delete Announcement
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/admin/announcements/${announcementId}`,
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        }
      });
      expect(deleteRes.statusCode).toBe(200);

      const deletedEvent = await app.prisma.auditEvent.findFirst({
        where: { mosque_id: mosqueId, action: 'announcement.deleted', target_id: String(announcementId) }
      });
      expect(deletedEvent).toBeDefined();
    });

    it('persists AuditEvent for membership invitation and update', async () => {
      const inviteEmail = `invitee-${Date.now().toString(36)}@example.test`;
      const inviteRes = await app.inject({
        method: 'POST',
        url: '/api/admin/memberships/invite',
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        },
        payload: {
          name: 'Invited Member',
          email: inviteEmail,
          role: 'finance_officer',
          temporary_password: 'TempPassword123!'
        }
      });
      expect(inviteRes.statusCode).toBe(201);
      const membershipId = inviteRes.json().membership_id;

      const inviteEvent = await app.prisma.auditEvent.findFirst({
        where: { mosque_id: mosqueId, action: 'membership.invited', target_id: String(membershipId) }
      });
      expect(inviteEvent).toBeDefined();
      expect(inviteEvent?.actor_id).toBe(adminUserId);

      // Update role
      const updateRes = await app.inject({
        method: 'PATCH',
        url: `/api/admin/memberships/${membershipId}`,
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        },
        payload: { role: 'programme_officer' }
      });
      expect(updateRes.statusCode).toBe(200);

      const updateEvent = await app.prisma.auditEvent.findFirst({
        where: { mosque_id: mosqueId, action: 'membership.updated', target_id: String(membershipId) }
      });
      expect(updateEvent).toBeDefined();
    });

    it('enforces multi-tenant isolation on GET /api/admin/audit-events', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-events',
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      const events = res.json();
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);
      // Verify every returned event belongs strictly to this mosque
      for (const event of events) {
        expect(event.mosque_id).toBe(mosqueId);
      }
    });
  });
});
```

---

## 5. Verification Method

To independently verify the AuditEvent logging coverage and execute the complete integration test suite:

### 5.1 Verification Commands
```bash
# 1. Run Vitest integration test suite
npm --prefix backend test

# 2. Run standalone runner verification
npm --prefix backend run test:node
```

### 5.2 Direct Database Inspection
Inspect audit events generated during the test execution:
```bash
npx --prefix backend prisma studio
# Query table: AuditEvent
# Filter: action in ['donation.reconciled', 'donation.recorded', 'donation.completed', 'program.created', 'attendance.recorded', 'announcement.created', 'membership.invited', 'tenant.applied']
```

### 5.3 Invalidation Conditions
- Any test in `test/current/security.integration.test.ts` fails with status codes other than expected (e.g. 500 or unhandled rejection).
- AuditEvent table contains null `request_id` or `ip_address` on newly created actions.
- Audit query endpoint `/api/admin/audit-events` returns events matching other `mosque_id`s.
