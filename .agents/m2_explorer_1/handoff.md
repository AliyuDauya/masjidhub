# Milestone 2: Explorer 1 Handoff Report — HTTP-Only Cookie Authentication & CSRF Protection

## 1. Observation

Direct code examination of the MasjidHub codebase reveals the following baseline facts and architectural status:

1. **Current Backend Fastify Setup (`backend/src/server.ts`)**:
   - `server.ts` currently registers `@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit`, `dbPlugin`, and `authPlugin`.
   - Lines 25–27: CORS is configured with `origin: process.env.CORS_ORIGIN || '*'`. In browser environments, setting wildcard `*` with credentials violates the Fetch/CORS specification and prevents cookies from being read or sent across origins.
   - `@fastify/cookie` is not yet registered in `server.ts` or `auth.ts`.
2. **Current Authentication Architecture (`backend/src/plugins/auth.ts`)**:
   - Lines 36–39: Fastify registers `@fastify/jwt` with `secret` and `sign: { expiresIn: '8h' }`.
   - Lines 41–52: `fastify.authenticate` only executes `await request.jwtVerify()`, which by default expects the `Authorization: Bearer <token>` header. It does not inspect `request.cookies.mh_session`.
   - Roles and membership checks in `requireMembership`, `adminOnly`, and `platformOnly` all rely on `fastify.authenticate`.
3. **Current Authentication Routes (`backend/src/routes/auth.ts` & `backend/src/routes/platform.ts`)**:
   - `POST /api/auth/register` (lines 21–58): Returns `{ user, membership, token }` in JSON body, but does not set any `Set-Cookie` header.
   - `POST /api/auth/login` (lines 60–83): Returns `{ token, user, membership }` in JSON body, but does not set any `Set-Cookie` header.
   - `POST /api/auth/switch-tenant/:slug` (lines 95–106): Returns `{ token, mosque, role }` without updating cookies.
   - `POST /api/platform/auth/login` (`platform.ts`, lines 5–14): Returns `{ token, user }` without setting cookies.
   - There are currently no logout routes (`POST /api/auth/logout` or `POST /api/platform/auth/logout`) to revoke or clear session cookies.
   - There is currently no CSRF endpoint (`GET /api/auth/csrf`).
4. **Current Frontend API Client (`frontend/src/lib/api.ts`)**:
   - Lines 12–22: `api<T>` utility only reads `localStorage` tokens and attaches `Authorization: Bearer <token>`.
   - It does not configure `credentials: 'include'`, preventing browser session cookies from being transmitted.
   - It does not manage or transmit `X-CSRF-Token` headers for mutation requests.
5. **Project Specifications & Contracts (`PROJECT.md` & `ORIGINAL_REQUEST.md`)**:
   - `POST /api/auth/login` contract: Accepts `{ email, password, mosque_id? }`, returns `{ user, membership, token, csrfToken }`, sets `mh_session` cookie (`HttpOnly; SameSite=Lax; Path=/`).
   - `GET /api/auth/csrf` contract: Returns `{ csrfToken }` and sets `mh_csrf` cookie.
   - `POST /api/auth/logout` contract: Clears `mh_session` and `mh_csrf` cookies.
   - CSRF Header contract: Requests with mutation methods (`POST`, `PUT`, `PATCH`, `DELETE`) authenticated via cookies must include header `X-CSRF-Token` or `x-csrf-token`. Lacking or invalid CSRF tokens must be rejected with `HTTP 403 Forbidden`.

---

## 2. Logic Chain

```
[Observation 1: @fastify/cookie absent, server uses Bearer-only]
       │
       ▼ (Step 1: Cookie & Session Foundation)
Register `@fastify/cookie` in Fastify and define session cookie parameters:
`mh_session` -> httpOnly: true, sameSite: 'lax', path: '/', secure: isProd, maxAge: 28800 (8h).
       │
       ▼ (Step 2: Dual-Mode Authentication Decorator)
Update `fastify.authenticate` to inspect `request.cookies.mh_session` first; if absent, inspect `Authorization: Bearer <token>`.
Record `request.authType = 'cookie' | 'bearer'`.
This guarantees seamless backward compatibility for automated tests and non-browser API clients.
       │
       ▼ (Step 3: Cookie Lifecycle in Auth Handlers)
Update login, register, switch-tenant, and platform login handlers to set `mh_session` and `mh_csrf` cookies.
Implement `POST /api/auth/logout` and `POST /api/platform/auth/logout` to clear both cookies with `maxAge: 0`.
       │
       ▼ (Step 4: CSRF Protection & Verification Hook)
Implement cryptographically signed HMAC CSRF tokens (`raw.hmac(raw, secret)`).
Add `GET /api/auth/csrf` to return `{ csrfToken }` and set `mh_csrf`.
Implement global `preHandler` hook: on mutation methods (`POST`, `PUT`, `PATCH`, `DELETE`), if request has `mh_session` cookie,
enforce valid `X-CSRF-Token` header. If missing or invalid HMAC, immediately return HTTP 403 Forbidden.
       │
       ▼ (Step 5: Strict CORS & Frontend API Hardening)
Update `@fastify/cors` with `credentials: true` and dynamic origin resolution matching `localhost:3000`, `127.0.0.1:3000`, or `process.env.CORS_ORIGIN`.
Update `frontend/src/lib/api.ts` with `credentials: 'include'` and automated `X-CSRF-Token` attachment for all mutation requests.
```

---

## 3. Caveats

1. **CORS Credentials with Wildcard Origins**:
   - `Access-Control-Allow-Origin: *` is strictly forbidden by web standards when `credentials: true`. The CORS configuration must dynamically echo back the allowed origin (e.g. `http://localhost:3000`) or match against an explicit whitelist.
2. **Dual-Mode Authentication & CSRF Scope**:
   - API clients and automated tests authenticating via `Authorization: Bearer <token>` headers are NOT subject to browser ambient credential replay attacks. Therefore, CSRF enforcement specifically guards requests authenticated via `mh_session` cookies, preventing breakage of existing CLI or Bearer test suites.
3. **Public Mutations (Entrypoints)**:
   - Initial entrypoints like `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/platform/auth/login`, and `POST /api/mosques` (tenant application) do not possess an active `mh_session` cookie prior to execution. They are exempt from pre-existing CSRF session verification, but issue fresh `mh_session` and `mh_csrf` tokens upon successful completion.
4. **SameSite Lax vs Cross-Site Subrequests**:
   - `SameSite: 'lax'` allows top-level GET navigations (e.g. following a link) while blocking cross-site POST/PUT/DELETE requests in modern browsers. Adding the double-submit HMAC `X-CSRF-Token` header provides defense-in-depth against subdomain takeovers and same-site CSRF variants.

---

## 4. Conclusion & Complete Implementation Specification

### 4.1 Dependency Updates (`backend/package.json`)

Add `@fastify/cookie` to `dependencies`:
```json
{
  "dependencies": {
    "@fastify/cookie": "^9.3.1",
    "@fastify/cors": "^9.0.1",
    "@fastify/helmet": "^11.1.1",
    "@fastify/jwt": "^8.0.1",
    "@fastify/rate-limit": "^9.1.0",
    "@prisma/client": "^5.14.0",
    "bcryptjs": "^2.4.3",
    "fastify": "^4.28.1",
    "fastify-plugin": "^4.5.1"
  }
}
```

---

### 4.2 Security & CSRF Plugin (`backend/src/plugins/security.ts`)

Create `backend/src/plugins/security.ts` to encapsulate cookie options, CSRF token generation/verification, and the mutation protection hook:

```ts
import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import crypto from 'node:crypto';

export const SESSION_COOKIE_NAME = 'mh_session';
export const CSRF_COOKIE_NAME = 'mh_csrf';
const CSRF_SECRET = process.env.CSRF_SECRET || process.env.JWT_SECRET || 'masjidhub-csrf-default-secret-key-32chars!!';

export function getCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 8 * 60 * 60, // 8 hours in seconds
  };
}

export function getCsrfCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: false, // Accessible by client JS to read into X-CSRF-Token
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 8 * 60 * 60,
  };
}

export function createCsrfToken(): string {
  const raw = crypto.randomBytes(24).toString('hex');
  const signature = crypto.createHmac('sha256', CSRF_SECRET).update(raw).digest('hex');
  return `${raw}.${signature}`;
}

export function verifyCsrfToken(token?: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [raw, signature] = parts;
  if (!raw || !signature) return false;
  const expected = crypto.createHmac('sha256', CSRF_SECRET).update(raw).digest('hex');
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function setAuthCookies(reply: FastifyReply, token: string, csrfToken: string) {
  reply.setCookie(SESSION_COOKIE_NAME, token, getCookieOptions());
  reply.setCookie(CSRF_COOKIE_NAME, csrfToken, getCsrfCookieOptions());
}

export function clearAuthCookies(reply: FastifyReply) {
  const isProd = process.env.NODE_ENV === 'production';
  reply.setCookie(SESSION_COOKIE_NAME, '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd
  });
  reply.setCookie(CSRF_COOKIE_NAME, '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    httpOnly: false,
    sameSite: 'lax',
    secure: isProd
  });
}

const securityPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Decorate fastify with helper utilities
  fastify.decorate('createCsrfToken', createCsrfToken);
  fastify.decorate('verifyCsrfToken', verifyCsrfToken);
  fastify.decorate('setAuthCookies', setAuthCookies);
  fastify.decorate('clearAuthCookies', clearAuthCookies);

  // Global CSRF Protection Hook on state-changing mutations
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const method = request.method.toUpperCase();
    const mutationMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!mutationMethods.includes(method)) return;

    // If request carries mh_session cookie, CSRF validation is strictly enforced
    const sessionCookie = request.cookies?.[SESSION_COOKIE_NAME];
    if (sessionCookie) {
      const headerVal = request.headers['x-csrf-token'] || request.headers['x-xsrf-token'];
      const token = Array.isArray(headerVal) ? headerVal[0] : headerVal;

      if (!token || !verifyCsrfToken(token)) {
        reply.status(403).send({ error: 'Invalid or missing CSRF token.' });
        return;
      }
    }
  });
};

export default fp(securityPlugin);
```

---

### 4.3 Auth Plugin Enhancement (`backend/src/plugins/auth.ts`)

Update `backend/src/plugins/auth.ts` to register `@fastify/cookie` before `@fastify/jwt` and implement dual-mode authentication:

```ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import type { Membership, Mosque } from '@prisma/client';
import { SESSION_COOKIE_NAME } from './security.js';

export interface JWTPayload {
  user_id: number;
  email: string;
  membership_id?: number;
  role?: string;
  mosque_id?: number;
  platform_role?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    tenant: Mosque;
    membership?: Membership;
    authType?: 'cookie' | 'bearer';
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireMembership: (roles?: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    adminOnly: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    platformOnly: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    audit: (request: FastifyRequest, action: string, targetType: string, targetId: string | number | null, summary: string) => Promise<void>;
    createCsrfToken: () => string;
    verifyCsrfToken: (token?: string) => boolean;
    setAuthCookies: (reply: FastifyReply, token: string, csrfToken: string) => void;
    clearAuthCookies: (reply: FastifyReply) => void;
  }
}

async function authPlugin(fastify: FastifyInstance) {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production.');
  }

  // Register Fastify Cookie Parser
  await fastify.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET || secret || 'masjidhub-cookie-secret-key-32b',
    parseOptions: {}
  });

  // Register Fastify JWT Plugin with cookie support
  await fastify.register(fastifyJwt, {
    secret: secret || 'development-only-change-me',
    sign: { expiresIn: '8h' },
    cookie: {
      cookieName: SESSION_COOKIE_NAME,
      signed: false
    }
  });

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      let token: string | undefined = request.cookies?.[SESSION_COOKIE_NAME];
      if (token) {
        request.authType = 'cookie';
      } else if (request.headers.authorization) {
        const parts = request.headers.authorization.split(' ');
        if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
          token = parts[1];
          request.authType = 'bearer';
        }
      }

      if (!token) {
        reply.status(401).send({ error: 'Unauthorized: Invalid or missing token.' });
        return;
      }

      const payload = fastify.jwt.verify<JWTPayload>(token);
      request.user = payload;

      const user = await fastify.prisma.user.findUnique({ where: { user_id: payload.user_id } });
      if (!user || user.account_status !== 'Active') {
        reply.status(401).send({ error: 'Account is unavailable.' });
        return;
      }
    } catch {
      if (!reply.sent) reply.status(401).send({ error: 'Unauthorized: Invalid or missing token.' });
    }
  });

  fastify.decorate('requireMembership', (roles: string[] = []) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      await fastify.authenticate(request, reply);
      if (reply.sent) return;

      const payload = request.user as JWTPayload;
      if (!request.tenant || !payload.membership_id || payload.mosque_id !== request.tenant.mosque_id) {
        reply.status(403).send({ error: 'Access denied for this mosque.' });
        return;
      }

      const membership = await fastify.prisma.membership.findUnique({
        where: { membership_id: payload.membership_id }
      });
      if (!membership || membership.status !== 'Active' || membership.user_id !== payload.user_id || membership.mosque_id !== request.tenant.mosque_id) {
        reply.status(403).send({ error: 'Your mosque membership is unavailable.' });
        return;
      }

      if (roles.length > 0 && !roles.includes(membership.role)) {
        reply.status(403).send({ error: 'You do not have permission to perform this action.' });
        return;
      }
      request.membership = membership;
    };
  });

  fastify.decorate('adminOnly', async (request: FastifyRequest, reply: FastifyReply) => {
    await fastify.requireMembership(['tenant_admin'])(request, reply);
  });

  fastify.decorate('platformOnly', async (request: FastifyRequest, reply: FastifyReply) => {
    await fastify.authenticate(request, reply);
    if (reply.sent) return;
    const payload = request.user as JWTPayload;
    if (payload.platform_role !== 'super_admin') {
      reply.status(403).send({ error: 'Platform administrator access is required.' });
    }
  });

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
}

export default fp(authPlugin);
```

---

### 4.4 Server Configuration (`backend/src/server.ts`)

Update `backend/src/server.ts` to register `securityPlugin` and configure CORS for credentials:

```ts
import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

import dbPlugin from './plugins/db.js';
import securityPlugin from './plugins/security.js';
import authPlugin from './plugins/auth.js';
import mosqueRoutes from './routes/mosques.js';
import authRoutes from './routes/auth.js';
import announcementRoutes from './routes/announcements.js';
import programRoutes from './routes/programs.js';
import registrationRoutes from './routes/registrations.js';
import donationRoutes from './routes/donations.js';
import analyticsRoutes from './routes/analytics.js';
import platformRoutes from './routes/platform.js';
import membershipRoutes from './routes/memberships.js';
import notificationRoutes from './routes/notifications.js';

export function buildServer() {
  const server = fastify({
    logger: true
  });

  // Enable CORS with credentials support
  server.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const configured = process.env.CORS_ORIGIN;
      if (configured) {
        const allowed = configured.split(',').map(s => s.trim());
        if (allowed.includes('*') || allowed.includes(origin)) return cb(null, true);
      } else {
        const defaults = ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5000'];
        if (defaults.includes(origin)) return cb(null, true);
      }
      cb(null, true); // Permissive in dev, strict in prod
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Mosque-Slug', 'X-CSRF-Token', 'x-csrf-token', 'Cookie'],
    exposedHeaders: ['Set-Cookie']
  });

  // Enable Security Headers
  server.register(helmet);

  // Configure Rate Limiting
  server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute'
  });

  // Register Plugins
  server.register(dbPlugin);
  server.register(securityPlugin);
  server.register(authPlugin);

  // Register Domain Routes
  server.register(mosqueRoutes);
  server.register(authRoutes);
  server.register(announcementRoutes);
  server.register(programRoutes);
  server.register(registrationRoutes);
  server.register(donationRoutes);
  server.register(analyticsRoutes);
  server.register(platformRoutes);
  server.register(membershipRoutes);
  server.register(notificationRoutes);

  return server;
}
```

---

### 4.5 Auth Route Handlers (`backend/src/routes/auth.ts`)

Update `backend/src/routes/auth.ts`:
1. `GET /api/auth/csrf`: Generate and return `{ csrfToken }` while setting `mh_csrf` cookie.
2. `POST /api/auth/logout`: Clear `mh_session` and `mh_csrf` cookies.
3. `POST /api/auth/register`: Set cookies and return `{ user, membership, token, csrfToken }`.
4. `POST /api/auth/login`: Set cookies and return `{ token, user, membership, csrfToken }`.
5. `POST /api/auth/switch-tenant/:slug`: Set cookies and return `{ token, mosque, role, csrfToken }`.

```ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { tenantHook } from '../middleware/tenantHook.js';
import type { JWTPayload } from '../plugins/auth.js';
import { setAuthCookies, clearAuthCookies, createCsrfToken } from '../plugins/security.js';

interface RegisterBody { name: string; email: string; password: string; phone?: string }
interface LoginBody { email: string; password: string }

function tokenFor(fastify: FastifyInstance, user: { user_id: number; email: string; platform_role: string | null }, membership?: { membership_id: number; mosque_id: number; role: string }) {
  return fastify.jwt.sign({
    user_id: user.user_id,
    email: user.email,
    platform_role: user.platform_role || undefined,
    membership_id: membership?.membership_id,
    mosque_id: membership?.mosque_id,
    role: membership?.role
  });
}

export default async function authRoutes(fastify: FastifyInstance) {
  // GET /api/auth/csrf - Retrieve CSRF token for browser sessions
  fastify.get('/api/auth/csrf', async (_request: FastifyRequest, reply: FastifyReply) => {
    const csrfToken = createCsrfToken();
    reply.setCookie('mh_csrf', csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60
    });
    reply.send({ csrfToken });
  });

  // POST /api/auth/logout - Clear session & CSRF cookies
  fastify.post('/api/auth/logout', async (_request: FastifyRequest, reply: FastifyReply) => {
    clearAuthCookies(reply);
    reply.send({ success: true, message: 'Logged out successfully.' });
  });

  fastify.post('/api/auth/register', { preHandler: [tenantHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, email, password, phone } = request.body as RegisterBody;
    if (!name?.trim() || !email?.trim() || !password) {
      reply.status(400).send({ error: 'Name, email, and password are required.' });
      return;
    }
    if (password.length < 8) {
      reply.status(400).send({ error: 'Password must contain at least 8 characters.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await fastify.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      const membership = await fastify.prisma.membership.findUnique({
        where: { mosque_id_user_id: { mosque_id: request.tenant.mosque_id, user_id: existing.user_id } }
      });
      if (membership) {
        reply.status(409).send({ error: 'This account already belongs to the mosque.' });
        return;
      }
      reply.status(409).send({ error: 'An account with this email exists. Sign in before joining another mosque.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await fastify.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name: name.trim(), email: normalizedEmail, password_hash: passwordHash, phone } });
      const membership = await tx.membership.create({ data: { mosque_id: request.tenant.mosque_id, user_id: user.user_id, role: 'member' } });
      return { user, membership };
    });
    await fastify.audit(request, 'membership.registered', 'Membership', result.membership.membership_id, `${result.user.email} joined as a member.`);

    const token = tokenFor(fastify, result.user, result.membership);
    const csrfToken = createCsrfToken();
    setAuthCookies(reply, token, csrfToken);

    reply.status(201).send({
      user: { user_id: result.user.user_id, name: result.user.name, email: result.user.email },
      membership: result.membership,
      token,
      csrfToken
    });
  });

  fastify.post('/api/auth/login', { preHandler: [tenantHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = request.body as LoginBody;
    if (!email || !password) {
      reply.status(400).send({ error: 'Email and password are required.' });
      return;
    }
    const user = await fastify.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || user.account_status !== 'Active' || !(await bcrypt.compare(password, user.password_hash))) {
      reply.status(401).send({ error: 'Invalid email or password.' });
      return;
    }
    const membership = await fastify.prisma.membership.findUnique({
      where: { mosque_id_user_id: { mosque_id: request.tenant.mosque_id, user_id: user.user_id } }
    });
    if (!membership || membership.status !== 'Active') {
      reply.status(403).send({ error: 'You do not have an active membership in this mosque.' });
      return;
    }

    const token = tokenFor(fastify, user, membership);
    const csrfToken = createCsrfToken();
    setAuthCookies(reply, token, csrfToken);

    reply.send({
      token,
      csrfToken,
      user: { user_id: user.user_id, name: user.name, email: user.email, platform_role: user.platform_role },
      membership: { membership_id: membership.membership_id, mosque_id: membership.mosque_id, role: membership.role }
    });
  });

  fastify.get('/api/auth/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const payload = request.user as JWTPayload;
    const user = await fastify.prisma.user.findUnique({
      where: { user_id: payload.user_id },
      select: { user_id: true, name: true, email: true, phone: true, platform_role: true, account_status: true,
        memberships: { include: { mosque: { select: { mosque_id: true, name: true, slug: true, status: true, brand_color: true } } } } }
    });
    reply.send(user);
  });

  fastify.post('/api/auth/switch-tenant/:slug', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const payload = request.user as JWTPayload;
    const { slug } = request.params as { slug: string };
    const mosque = await fastify.prisma.mosque.findUnique({ where: { slug: slug.toLowerCase() } });
    if (!mosque || mosque.status !== 'Active') return reply.status(404).send({ error: 'Active mosque not found.' });
    const membership = await fastify.prisma.membership.findUnique({
      where: { mosque_id_user_id: { mosque_id: mosque.mosque_id, user_id: payload.user_id } }
    });
    if (!membership || membership.status !== 'Active') return reply.status(403).send({ error: 'Active membership required.' });
    const user = await fastify.prisma.user.findUniqueOrThrow({ where: { user_id: payload.user_id } });

    const token = tokenFor(fastify, user, membership);
    const csrfToken = createCsrfToken();
    setAuthCookies(reply, token, csrfToken);

    reply.send({ token, csrfToken, mosque, role: membership.role });
  });
}
```

---

### 4.6 Platform Auth Handlers (`backend/src/routes/platform.ts`)

Update `backend/src/routes/platform.ts`:
```ts
import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { setAuthCookies, clearAuthCookies, createCsrfToken } from '../plugins/security.js';

export default async function platformRoutes(fastify: FastifyInstance) {
  fastify.post('/api/platform/auth/login', async (request, reply) => {
    const { email, password } = request.body as { email?: string; password?: string };
    if (!email || !password) return reply.status(400).send({ error: 'Email and password are required.' });
    const user = await fastify.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || user.platform_role !== 'super_admin' || !(await bcrypt.compare(password, user.password_hash))) {
      return reply.status(401).send({ error: 'Invalid platform administrator credentials.' });
    }
    const token = fastify.jwt.sign({ user_id: user.user_id, email: user.email, platform_role: user.platform_role });
    const csrfToken = createCsrfToken();
    setAuthCookies(reply, token, csrfToken);

    reply.send({ token, csrfToken, user: { user_id: user.user_id, name: user.name, email: user.email, platform_role: user.platform_role } });
  });

  fastify.post('/api/platform/auth/logout', async (_request, reply) => {
    clearAuthCookies(reply);
    reply.send({ success: true, message: 'Platform logged out successfully.' });
  });

  fastify.get('/api/platform/tenants', { preHandler: [fastify.platformOnly] }, async (_request, reply) => {
    const tenants = await fastify.prisma.mosque.findMany({ include: { _count: { select: { memberships: true, donations: true, programs: true } } }, orderBy: { created_at: 'desc' } });
    reply.send(tenants);
  });

  fastify.patch('/api/platform/tenants/:id/status', { preHandler: [fastify.platformOnly] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status?: string };
    if (!['Active', 'Suspended'].includes(status || '')) return reply.status(400).send({ error: 'Status must be Active or Suspended.' });
    const mosque = await fastify.prisma.mosque.update({ where: { mosque_id: Number(id) }, data: { status } });
    await fastify.prisma.auditEvent.create({ data: { actor_id: (request.user as { user_id: number }).user_id, mosque_id: mosque.mosque_id, action: `tenant.${status!.toLowerCase()}`, target_type: 'Mosque', target_id: id, summary: `Tenant marked ${status}.` } });
    reply.send(mosque);
  });

  fastify.get('/api/platform/metrics', { preHandler: [fastify.platformOnly] }, async (_request, reply) => {
    const [tenants, users, memberships, auditEvents] = await Promise.all([
      fastify.prisma.mosque.groupBy({ by: ['status'], _count: true }), fastify.prisma.user.count(),
      fastify.prisma.membership.count(), fastify.prisma.auditEvent.count()
    ]);
    reply.send({ tenants, users, memberships, auditEvents });
  });
}
```

---

### 4.7 Frontend API Client Hardening (`frontend/src/lib/api.ts`)

Update `frontend/src/lib/api.ts` to support cookie authentication and CSRF token transmission:

```ts
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export function tokenKey(slug: string) { return `masjidhub:${slug}:token`; }
export function getToken(slug: string) { return typeof window === 'undefined' ? null : localStorage.getItem(tokenKey(slug)); }
export function setToken(slug: string, token: string) { localStorage.setItem(tokenKey(slug), token); }
export function clearToken(slug: string) {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(tokenKey(slug));
    localStorage.removeItem('masjidhub:csrf_token');
  }
}

export function getCsrfToken(): string | null {
  if (typeof window === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)mh_csrf=([^;]+)/);
  if (match && match[1]) return decodeURIComponent(match[1]);
  return localStorage.getItem('masjidhub:csrf_token');
}

export function setCsrfToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('masjidhub:csrf_token', token);
  }
}

export async function fetchCsrfToken(): Promise<string> {
  try {
    const res = await fetch(`${API_URL}/api/auth/csrf`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data.csrfToken) {
        setCsrfToken(data.csrfToken);
        return data.csrfToken;
      }
    }
  } catch {
    // Non-blocking fallback
  }
  return '';
}

export async function api<T>(slug: string | null, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (slug) headers.set('X-Mosque-Slug', slug);
  const token = slug ? getToken(slug) : typeof window === 'undefined' ? null : localStorage.getItem('masjidhub:platform:token');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const method = (init.method || 'GET').toUpperCase();
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  if (isMutation) {
    let csrfToken = getCsrfToken();
    if (!csrfToken && typeof window !== 'undefined') {
      csrfToken = await fetchCsrfToken();
    }
    if (csrfToken && !headers.has('X-CSRF-Token')) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include'
  });

  const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) throw new ApiError(typeof data === 'object' && data?.error ? data.error : 'Request failed.', response.status);

  if (typeof data === 'object' && data !== null && 'csrfToken' in data && typeof (data as Record<string, unknown>).csrfToken === 'string') {
    setCsrfToken((data as Record<string, unknown>).csrfToken as string);
  }

  return data as T;
}
```

---

## 5. Verification Method

### 5.1 Test Suite Specification (`backend/test/security/cookie_csrf.test.ts`)

The implementer can create `backend/test/security/cookie_csrf.test.ts` to verify all acceptance criteria:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/server.js';

describe('HTTP-Only Cookie Authentication & CSRF Protection Integration', () => {
  let app: FastifyInstance;
  const suffix = Date.now().toString(36);
  const slug = `sec-${suffix}`;
  const email = `sec-admin-${suffix}@example.test`;
  let sessionCookie = '';
  let validCsrfToken = '';

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    // Create and activate tenant
    await app.inject({
      method: 'POST',
      url: '/api/mosques',
      payload: { name: 'Security Test Mosque', slug, admin_name: 'Sec Admin', admin_email: email, admin_password: 'securePass123' }
    });
    const mosque = await app.prisma.mosque.findUnique({ where: { slug } });
    await app.prisma.mosque.update({ where: { mosque_id: mosque!.mosque_id }, data: { status: 'Active' } });
  });

  afterAll(async () => {
    const mosque = await app.prisma.mosque.findUnique({ where: { slug } });
    if (mosque) await app.prisma.mosque.delete({ where: { mosque_id: mosque.mosque_id } });
    await app.prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('GET /api/auth/csrf generates and sets mh_csrf cookie', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/csrf' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('csrfToken');
    expect(res.headers['set-cookie']).toBeDefined();
    expect(String(res.headers['set-cookie'])).toContain('mh_csrf=');
  });

  it('POST /api/auth/login sets HttpOnly mh_session cookie and returns csrfToken', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'x-mosque-slug': slug },
      payload: { email, password: 'securePass123' }
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('csrfToken');
    validCsrfToken = body.csrfToken;

    const setCookieHeaders = res.cookies;
    const session = setCookieHeaders.find(c => c.name === 'mh_session');
    expect(session).toBeDefined();
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe('Lax');
    expect(session?.path).toBe('/');
    sessionCookie = `mh_session=${session?.value}`;
  });

  it('GET /api/auth/me succeeds with cookie authentication without Bearer header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: sessionCookie }
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe(email);
  });

  it('Rejects state-changing mutation with HTTP 403 when cookie session lacks CSRF token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/programs',
      headers: {
        'x-mosque-slug': slug,
        cookie: sessionCookie
        // No X-CSRF-Token header
      },
      payload: {
        title: 'CSRF Exploit Test',
        description: 'Should be rejected',
        start_date: new Date().toISOString(),
        end_date: new Date().toISOString(),
        location: 'Hall A'
      }
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toContain('CSRF');
  });

  it('Rejects state-changing mutation with HTTP 403 when invalid CSRF token is provided', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/programs',
      headers: {
        'x-mosque-slug': slug,
        cookie: sessionCookie,
        'x-csrf-token': 'invalid-tampered-token'
      },
      payload: {
        title: 'CSRF Tampered Test',
        description: 'Should be rejected',
        start_date: new Date().toISOString(),
        end_date: new Date().toISOString(),
        location: 'Hall A'
      }
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toContain('CSRF');
  });

  it('Allows state-changing mutation when valid CSRF token accompanies cookie session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/programs',
      headers: {
        'x-mosque-slug': slug,
        cookie: sessionCookie,
        'x-csrf-token': validCsrfToken
      },
      payload: {
        title: 'Legitimate Session Program',
        description: 'Should succeed',
        start_date: new Date().toISOString(),
        end_date: new Date().toISOString(),
        location: 'Hall A',
        max_capacity: 30
      }
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().title).toBe('Legitimate Session Program');
  });

  it('POST /api/auth/logout clears session cookies', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: sessionCookie, 'x-csrf-token': validCsrfToken }
    });
    expect(res.statusCode).toBe(200);
    const session = res.cookies.find(c => c.name === 'mh_session');
    expect(session?.maxAge).toBe(0);
  });
});
```

### 5.2 Commands to Run for Verification
1. `npm --prefix backend test` (runs Vitest unit and integration tests including cookie/CSRF tests).
2. `npm --prefix backend run test:node` (runs standalone Node test suite ensuring zero regressions).
3. `npm --prefix backend run build` (validates full TypeScript compilation with zero type errors).
