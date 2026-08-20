# MasjidHub Automated Test Suite Readiness (Tiers 1–4)

## Overview
Comprehensive automated test suites have been designed and implemented across both the Frontend (`frontend/__tests__/standalone_runner.js`) and Backend (`backend/test/standalone_runner.js`) runners, fulfilling all requirements specified in `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `TEST_INFRA.md`.

---

## Test Execution Commands

| Component | Command | Framework / Engine | Purpose |
|-----------|---------|-------------------|---------|
| **Frontend Standalone Runner** | `npm --prefix frontend run test:node` | Node.js Built-in Test Runner (`node:test`, `node:assert`) | Validates 3-portal authentication, role routing, destination mosque sync, cookies/CSRF headers, aesthetics, boundary cases, cross-feature flows, and full E2E journeys. |
| **Backend Standalone Runner** | `npm --prefix backend run test:node` | Node.js Built-in Test Runner (`node:test`, `node:assert`) | Validates tenant isolation, password security, platform operator auth & governance, CSRF HMAC-SHA256 tokens, RBAC, audit event tracking, auto-membership, and RFC 4180 CSV export. |
| **Backend E2E Suites** | `npm --prefix backend run test:e2e` | Vitest + Fastify Inject | Full database integration suites covering Tiers 1–4 with SQLite/Prisma. |
| **Next.js Production Build** | `npm --prefix frontend run build` | Next.js 16.2 App Router Compiler | Ensures 0 TypeScript, ESLint, or bundling errors in production assets. |

---

## Feature Coverage Matrix (F1 through F10 across Tiers 1–4)

| # | Feature | Scope & Implementation | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Cross-Feature) | Tier 4 (Workflows) |
|---|---------|------------------------|:----------------:|:-----------------:|:---------------------:|:------------------:|
| **F1** | **3-Section Segmented Login UI** | 3 dedicated portal tabs (Member/Worshipper, Mosque Admin/Imam, Platform Operator), tab switching, role badges, section descriptions | 5 tests (1.1–1.5) | 4 tests (2.1–2.4) | 2 tests (3.1, 3.2) | 3 tests (4.1–4.3) |
| **F2** | **Worshipper Portal Authentication & Routing** | Signs in via `POST /api/auth/login` with `X-Mosque-Slug`, routes directly to `/mosque/[slug]/dashboard`, persists `masjidhub:[slug]:token` | 5 tests (2.1–2.5) | 3 tests (2.1, 2.4, 2.5) | 2 tests (3.3, 3.4) | 1 test (4.1) |
| **F3** | **Mosque Admin & Imam Workspace Authentication & Routing** | Signs in via `POST /api/auth/login` with `X-Mosque-Slug`, routes directly to `/mosque/[slug]/admin`, manages announcements, capacity & attendees | 5 tests (3.1–3.5) | 3 tests (2.1, 2.3, 2.5) | 2 tests (3.3, 3.4) | 1 test (4.2) |
| **F4** | **Sovereign Platform Operator Authentication & Routing** | Signs in via `POST /api/platform/auth/login` (no tenant header), routes directly to `/platform`, persists `masjidhub:platform:token`, oversees multi-tenant statuses | 5 tests (4.1–4.5) | 3 tests (2.6–2.8) | 2 tests (3.5, 3.6) | 1 test (4.3) |
| **F5** | **Destination Mosque Selector Dropdown** | Populates active mosques from `GET /api/mosques`, syncs with URL slug, updates target submission slug reactively | 5 tests (5.1–5.5) | 3 tests (2.9–2.11) | 2 tests (3.2, 3.4) | 2 tests (4.1, 4.4) |
| **F6** | **Responsive Royal Emerald & Gold Aesthetic** | Design tokens (`#0d4734`, `#c89b3c`, `#fcfbfa`, `#f6f3eb`), role badges, status colors, glass navigation header, password visibility toggle | 5 tests (6.1–6.5) | 2 tests (2.4, 2.5) | 1 test (3.1) | 1 test (4.1) |
| **F7** | **Quick Links & Onboarding Gateways** | Navigation gateways for member registration (`/register`), tenant onboarding (`/register`), operator console (`/platform`), and index (`/`) | 5 tests (7.1–7.5) | 2 tests (2.10, 2.11) | 1 test (3.1) | 2 tests (4.1, 4.3) |
| **F8** | **Session, Cookies & CSRF Protection Invariants** | `mh_session` HttpOnly cookie, `mh_csrf` HMAC-SHA256 cookie, localStorage fallback, `X-CSRF-Token` mutation header injection | 5 tests (8.1–8.5) | 3 tests (2.8, 2.12, 3.3) | 2 tests (3.3, 3.6) | 3 tests (4.1–4.3) |
| **F9** | **Multi-Tenant Auto-Membership & Switching** | Token isolation (`masjidhub:[slug]:token`), automatic membership record creation upon global sign-in, 1-click tenant switching | 5 tests (9.1–9.5) | 3 tests (2.7, 2.9, 2.12) | 3 tests (3.4, 3.5, 3.6) | 2 tests (4.1, 4.4) |
| **F10** | **Build & Automation Verification** | Error handling with `ApiError`, request credentials inclusion, JSON payload serialization, 0 unhandled promise rejections | 5 tests (10.1–10.5) | 2 tests (2.11, 2.12) | 2 tests (3.3, 3.5) | 4 tests (4.1–4.4) |

---

## Detailed Tier Breakdown

### Tier 1: Feature Isolation Coverage (50 Test Cases)
- **F1 (3-Section Login UI)**:
  - 1.1: 3 distinct portal tabs (`worshipper`, `admin`, `operator`).
  - 1.2: Worshipper portal role badge & description.
  - 1.3: Mosque Admin portal role badge & description.
  - 1.4: Sovereign Platform Operator role badge & description.
  - 1.5: Smooth active tab state toggling without state crosstalk.
- **F2 (Worshipper Authentication & Routing)**:
  - 2.1: Routes member to `/mosque/[slug]/dashboard`.
  - 2.2: Invokes `POST /api/auth/login` with `X-Mosque-Slug`.
  - 2.3: Persists tenant token in scoped storage (`masjidhub:[slug]:token`).
  - 2.4: Updates router path on successful member login.
  - 2.5: Validates member payload schema.
- **F3 (Mosque Admin Workspace & Routing)**:
  - 3.1: Routes admin/imam to `/mosque/[slug]/admin`.
  - 3.2: Captures `tenant_admin` role from auth payload.
  - 3.3: Attaches `X-Mosque-Slug` header for admin authentication.
  - 3.4: Supports administrative roles (`tenant_admin`, `finance_officer`, `programme_officer`, `communications_officer`).
  - 3.5: Stores admin token isolated by mosque slug.
- **F4 (Platform Operator Authentication & Routing)**:
  - 4.1: Routes platform operator to `/platform`.
  - 4.2: Invokes `POST /api/platform/auth/login` without tenant header.
  - 4.3: Persists platform token under `masjidhub:platform:token`.
  - 4.4: Queries platform tenants list using platform token.
  - 4.5: Clears platform token on disconnection.
- **F5 (Mosque Selector Dropdown)**:
  - 5.1: Fetches and parses active mosques from `/api/mosques`.
  - 5.2: Syncs default selection with active route parameter slug.
  - 5.3: Fallbacks to `al-noor` default when slug is absent.
  - 5.4: Updates target slug on dropdown selection change.
  - 5.5: Formats dropdown labels with mosque name and slug.
- **F6 (Royal Emerald & Gold Aesthetic)**:
  - 6.1: Royal Emerald (`#0d4734`) primary brand color token.
  - 6.2: Warm Metallic Gold (`#c89b3c`) accent color token.
  - 6.3: Ivory surface (`#fcfbfa`) background token.
  - 6.4: Status badge styling color mappings.
  - 6.5: Show/hide password visibility toggle state.
- **F7 (Quick Links & Onboarding Gateways)**:
  - 7.1: Global registration link for new congregants (`/register`).
  - 7.2: Tenant-contextual registration link (`/mosque/[slug]/register`).
  - 7.3: Platform Operator Console quick link (`/platform`).
  - 7.4: Mosque tenant onboarding link (`/register`).
  - 7.5: Home return navigation link (`/`).
- **F8 (Session, Cookies & CSRF Protection)**:
  - 8.1: Extracts `mh_csrf` cookie from `document.cookie`.
  - 8.2: Fallbacks to `localStorage` when cookie is missing.
  - 8.3: Attaches `X-CSRF-Token` on mutation methods (POST, PUT, PATCH, DELETE).
  - 8.4: Excludes `X-CSRF-Token` from safe read methods (GET, HEAD).
  - 8.5: Updates stored CSRF token when response contains new `csrfToken`.
- **F9 (Multi-Tenant Auto-Membership & Switching)**:
  - 9.1: Generates scoped token storage keys per mosque slug.
  - 9.2: Maintains isolated tokens across multiple mosques concurrently.
  - 9.3: Clears specified mosque token without corrupting others.
  - 9.4: Executes 1-click tenant switching via `POST /api/auth/switch-tenant/:slug`.
  - 9.5: Automatically links membership on new mosque sign-in.
- **F10 (Build & Automation Verification)**:
  - 10.1: Executes asynchronous API calls within latency threshold.
  - 10.2: Enforces `credentials: include` on all requests.
  - 10.3: Sets `Content-Type: application/json` on mutation request payloads.
  - 10.4: Propagates API error messages via `ApiError` class.
  - 10.5: Completes test execution cleanly with 0 unhandled exceptions.

---

### Tier 2: Boundary & Corner Cases (12 Test Cases)
- **Input Validation & Format Boundaries**:
  - 2.1: Rejection of empty credentials, empty strings, and whitespace-only strings.
  - 2.2: Rejection of malformed email formats (missing `@`, missing domain, spaces, invalid chars).
  - 2.3: Password length boundary enforcement (minimum 8 characters, long password support).
  - 2.4: Email normalization with whitespace trimming and lowercase conversion.
  - 2.5: Safe handling of complex special characters in emails and passwords.
- **Platform Operator & Role Security Boundaries**:
  - 2.6: Rejection of non-superadmin accounts attempting platform operator login with 401.
  - 2.7: Rejection of platform tenant queries when platform token is absent.
  - 2.8: Rejection of platform tenant queries when token belongs to regular mosque user.
- **Tenant Slug & Multi-Tenant Boundaries**:
  - 2.9: URL slug sanitization stripping disallowed characters and multiple hyphens.
  - 2.10: Unselected mosque handling in operator portal (no slug required).
  - 2.11: Requirement of destination mosque slug in worshipper and admin portals.
  - 2.12: Rapid repeated form submission handling with idempotent token persistence.

---

### Tier 3: Cross-Feature Combinations (6 Test Cases)
- **3.1 Portal Tab Switching with State Retention**:
  - Switching between Worshipper, Admin, and Operator tabs while preserving entered email and clearing transient error banners.
- **3.2 Dropdown Switching with Form Preservation**:
  - Switching destination mosque in dropdown while retaining entered email input.
- **3.3 Dual Session Security Synchronization**:
  - Simultaneous injection of `mh_csrf` cookie in `X-CSRF-Token` header and Bearer token in `Authorization` header across sequential API calls.
- **3.4 Multi-Tenant Token Isolation**:
  - Independent session tokens across 3 separate mosques (`al-noor`, `al-huda`, `central`) without token collisions or state leakage.
- **3.5 Sovereign Platform Operator Governance Flow**:
  - Superadmin authenticates, queries multi-tenant registry, inspects pending tenant, and promotes tenant to "Active".
- **3.6 Comprehensive Logout Sequence**:
  - Logout clears active mosque token, CSRF cookie, and local storage token without clearing global session state.

---

### Tier 4: Real-World Workflow Scenarios (4 End-to-End User Journeys)
- **4.1 Scenario 1 — End-to-End Congregant Journey**:
  - User visits login page, selects Worshipper portal, chooses "Al-Noor Central Masjid", submits credentials, receives member session token and CSRF token, routes to `/mosque/al-noor/dashboard`, and views personal giving totals and booked prayer class passes.
- **4.2 Scenario 2 — End-to-End Imam Administrator Journey**:
  - Imam accesses login, selects Mosque Administrator portal, selects "Masjid Al-Huda", authenticates with imam credentials, routes to `/mosque/al-huda/admin`, publishes a Friday Khutbah announcement, and verifies attendance for a Tajweed intensive course.
- **4.3 Scenario 3 — End-to-End Sovereign Platform Operator Journey**:
  - Superadmin navigates to Platform Operator portal, authenticates via `/api/platform/auth/login`, receives platform JWT, routes to `/platform`, fetches list of pending and active mosques, reviews global platform metrics, and suspends a delinquent mosque tenant.
- **4.4 Scenario 4 — Multi-Mosque Congregant Federation Journey**:
  - Congregant signs in at Mosque 1 ("al-noor"), accesses member dashboard, then switches context to Mosque 2 ("al-huda"), triggers auto-membership linking, and accesses Mosque 2 dashboard seamlessly.

---

## Adversarial Hardening Verification
- **Timing-Safe CSRF Verification**: HMAC-SHA256 signature verification uses constant-time comparison (`crypto.timingSafeEqual`) preventing timing attacks.
- **CORS Whitelist Protection**: Malicious origins (subdomains, port spoofing, null origins) are rejected without reflection.
- **Strict Tenant Isolation**: Audit logs, user memberships, registrations, and announcements are strictly scoped by `mosque_id`.
- **RFC 4180 CSV Escaping**: Donation exports safely escape embedded commas, quotes, and newlines.
- **RBAC Enforcement**: Administrative actions (`reconcileDonation`, `viewAuditLogs`, `updateTenantStatus`) strictly enforce allowed roles.

---

## Conclusion
The automated test infrastructure is **100% complete, verified, and ready for continuous integration and regression testing**. All acceptance criteria from `ORIGINAL_REQUEST.md` and feature mappings from `PROJECT.md` are fully covered across Tiers 1 through 4.
