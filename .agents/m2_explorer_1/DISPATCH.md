# DISPATCH — Milestone 2: Explorer 1 (Cookie Auth & CSRF Protection)

You are a teamwork_preview_explorer agent for Milestone 2.
Your working directory is: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\m2_explorer_1`
Project root: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub`
Scope document: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\PROJECT.md`
Authoritative request: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\ORIGINAL_REQUEST.md`

## Task:
Investigate and design the exact implementation for:
1. **HTTP-Only Cookie Authentication**:
   - Registering `@fastify/cookie` in `backend/src/server.ts` or `src/plugins/auth.ts`.
   - Issuing `mh_session` cookie on `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/switch-tenant/:slug`, and platform login.
   - Setting `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `secure: process.env.NODE_ENV === 'production'`.
   - Updating `fastify.authenticate` decorator in `backend/src/plugins/auth.ts` to inspect `request.cookies.mh_session` first, falling back to `Authorization: Bearer <token>` for API / test clients.
   - Adding `POST /api/auth/logout` and `POST /api/platform/auth/logout` to clear cookies.
2. **CSRF Protection**:
   - Registering `@fastify/csrf-protection` (or robust double-submit signed token middleware).
   - Adding `GET /api/auth/csrf` to supply CSRF tokens for frontend clients.
   - Enforcing CSRF token verification on all state-changing mutation routes (`POST`, `PUT`, `PATCH`, `DELETE`).
   - Returning HTTP 403 Forbidden on missing or invalid CSRF tokens when request is authenticated via cookie.
3. Write complete, verified code diffs and implementation specifications to `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\m2_explorer_1\handoff.md`.

## 2026-08-16T16:13:22Z
Read DISPATCH.md, PROJECT.md, and ORIGINAL_REQUEST.md.
Investigate and design HTTP-only cookie authentication and CSRF protection for Fastify.
Write handoff report to handoff.md and report back via send_message.
