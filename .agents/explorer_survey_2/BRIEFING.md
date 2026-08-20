# BRIEFING — 2026-08-20T13:41:45Z

## Mission
Thoroughly explore the backend and auth codebase to map auth endpoints, schemas, user roles/permissions, session & cookie management, multi-tenant switching/linking/resolution, and error handling.

## 🔒 My Identity
- Archetype: Explorer
- Roles: Backend Auth & Multi-Tenant Session Specialist
- Working directory: C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\explorer_survey_2
- Original parent: f4b8d8c5-b297-44d0-89b0-347684eb11de
- Milestone: Survey & Investigation Complete

## 🔒 Key Constraints
- Read-only investigation — do NOT implement code changes
- Document exact file paths, line numbers, schemas, headers, status codes
- Write 5-component handoff report (handoff.md)

## Current Parent
- Conversation ID: f4b8d8c5-b297-44d0-89b0-347684eb11de
- Updated: 2026-08-20T13:41:45Z

## Investigation State
- **Explored paths**: `backend/src/server.ts`, `backend/src/plugins/auth.ts`, `backend/src/plugins/security.ts`, `backend/src/middleware/tenantHook.ts`, `backend/src/routes/auth.ts`, `backend/src/routes/platform.ts`, `backend/src/routes/mosques.ts`, `backend/src/routes/memberships.ts`, `backend/src/routes/donations.ts`, `backend/src/routes/programs.ts`, `backend/src/routes/registrations.ts`, `backend/src/routes/notifications.ts`, `backend/src/routes/analytics.ts`, `backend/src/schemas/*`, `frontend/src/lib/api.ts`, `frontend/src/app/login/page.tsx`, `frontend/src/app/mosque/[slug]/login/page.tsx`, `frontend/src/app/platform/page.tsx`.
- **Key findings**: Complete mapping of all 13 auth and platform endpoints, JWT payload structure, `mh_session` & `mh_csrf` cookies, dual-mode auth, CSRF preHandler mutation rules, tenantHook resolution with status 423 for non-active mosques, global user account federation, auto-membership creation, and full error status code table.
- **Unexplored areas**: None within scope.

## Key Decisions Made
- All observations, logic chains, caveats, conclusions, and verification steps compiled into `handoff.md`.

## Artifact Index
- C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\explorer_survey_2\DISPATCH.md — Dispatch log
- C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\explorer_survey_2\progress.md — Progress tracker
- C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\explorer_survey_2\handoff.md — Final investigation report
