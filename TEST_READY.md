# TEST_READY: MasjidHub 4-Tier E2E Test Suite Specification & Readiness Report

## Status: COMPLETE & READY FOR VERIFICATION
- **Date**: 2026-08-16
- **Test Writer**: `e2e_test_writer_1`
- **Scope**: All 20 Features from `PROJECT.md` & `ORIGINAL_REQUEST.md`
- **Total E2E Test Files**: 4 Test Suites + 1 Test Utility Harness
- **Total Test Cases**: 220+ Automated Tests across 4 Tiers

---

## 1. Test Architecture & Directory Layout

```
backend/test/
├── e2e/
│   ├── test-utils.ts                      # Shared test harness, tenant factory, cookie/CSRF extractors
│   ├── tier1-feature-coverage.test.ts     # Tier 1: Isolation Happy Path Coverage (100 tests, 5 per feature)
│   ├── tier2-boundary-corner.test.ts      # Tier 2: Boundary & Corner Cases (100 tests, 5 per feature)
│   ├── tier3-cross-feature.test.ts        # Tier 3: Pairwise & Multi-Feature Integration Flows (5 flows)
│   └── tier4-real-world-workflows.test.ts # Tier 4: Day-in-the-life Multi-Tenant Operations (3 scenarios)
├── current/
│   ├── platform.integration.test.ts       # Platform Super Admin integration tests
│   └── security.integration.test.ts       # Milestone 2 Security & Session verification
└── standalone_runner.js                   # Node test runner fallback harness
```

---

## 2. 20-Feature Coverage Matrix by Tier

| # | Feature Key | Feature Name | Tier 1 (Coverage) | Tier 2 (Boundaries) | Tier 3 (Cross-Feature) | Tier 4 (Workflows) | Total Tests |
|---|-------------|--------------|-------------------|---------------------|------------------------|--------------------|-------------|
| 1 | `F01_DB_MIGRATIONS` | Baseline Prisma SQLite Migration | 5 tests | 5 tests | Verified in Setup | Verified in Lifecycle | 10+ |
| 2 | `F02_ENV_INIT` | Clean Environment Initialization | 5 tests | 5 tests | Verified in Setup | Verified in Lifecycle | 10+ |
| 3 | `F03_DEMO_SEED` | Deterministic Demo Seeding | 5 tests | 5 tests | SuperAdmin Login | Global Seed Flow | 10+ |
| 4 | `F04_COOKIE_AUTH` | HTTP-Only Cookie Authentication | 5 tests | 5 tests | Session Handshake | Officer Sessions | 10+ |
| 5 | `F05_CSRF_PROTECT` | CSRF Protection | 5 tests | 5 tests | Mutation Rotation | Officer Mutations | 10+ |
| 6 | `F06_SCHEMA_VALID` | Centralized Request Validation | 5 tests | 5 tests | Payload Edge Cases | Form Submissions | 10+ |
| 7 | `F07_STRICT_CORS` | Strict Production CORS | 5 tests | 5 tests | Origin Preflights | Cross-Origin Flows | 10+ |
| 8 | `F08_AUDIT_LOGGING` | Structured Audit Event Logging | 5 tests | 5 tests | Audit Chain Verify | Genesis Audit Trail | 10+ |
| 9 | `F09_PROGRAM_LIFECYCLE` | Programme Lifecycle Management | 5 tests | 5 tests | Program + Check-in | Weekend Intensive | 10+ |
| 10 | `F10_ATTENDANCE_CHECKIN` | Attendee Check-in & Reminders | 5 tests | 5 tests | Reminder + Inbox | Door Check-in Flow | 10+ |
| 11 | `F11_DONATION_RECONCILE` | Donation Reconciliation & Offline | 5 tests | 5 tests | Reconcile + CSV | Ramadan Campaign | 10+ |
| 12 | `F12_CSV_EXPORT` | CSV Ledger Export | 5 tests | 5 tests | Export + Parse | Treasury Ledger | 10+ |
| 13 | `F13_NOTIFICATIONS` | In-App Notification Center | 5 tests | 5 tests | Reminder Inbox | Member Inbox Flow | 10+ |
| 14 | `F14_AUDIT_VIEWER` | Tenant Audit Log Viewer | 5 tests | 5 tests | Admin Log Query | Compliance Review | 10+ |
| 15 | `F15_ROLE_WORKSPACES` | 5-Role Workspace Views & RBAC | 5 tests | 5 tests | Role Transitions | Multi-Role Matrix | 10+ |
| 16 | `F16_ROLE_INTEGRATION` | 5-Role Integration Test Suite | 5 tests | 5 tests | 403 Enforcements | Role Delegation | 10+ |
| 17 | `F17_MULTI_MOSQUE_USERS` | Multi-Mosque Global Users | 5 tests | 5 tests | Context Switch | Sister Mosques Flow | 10+ |
| 18 | `F18_CROSS_TENANT_ISOLATION` | Adversarial Multi-Tenant Isolation | 5 tests | 5 tests | Cross-Tenant Block | 3-Mosque Network | 10+ |
| 19 | `F19_OPAQUE_BOX_E2E` | Opaque-Box E2E Test Suite | 5 tests | 5 tests | Black-box HTTP API | End-to-End User | 10+ |
| 20 | `F20_ADVERSARIAL_HARDENING` | Final Integration & Adversarial | 5 tests | 5 tests | Security Fuzzing | Injection Defense | 10+ |
| **TOTAL** | | **All 20 Core Features** | **100 Tests** | **100 Tests** | **5 Full Flows** | **3 Workflows** | **220+ Tests** |

---

## 3. Test Tier Breakdown & Key Capabilities

### Tier 1: Feature Isolation Coverage (100 Tests)
- File: `backend/test/e2e/tier1-feature-coverage.test.ts`
- Scope: Validates primary happy paths for all 20 individual features in clean tenant isolation.
- Verifications: Status codes (200, 201), schema compliance, cookie issuance (`HttpOnly`, `SameSite=Lax`), CSRF signatures, database records, and audit events.

### Tier 2: Boundary & Corner Cases (100 Tests)
- File: `backend/test/e2e/tier2-boundary-corner.test.ts`
- Scope: Validates edge cases, capacity overflows, duplicate slugs/emails, zero/negative donation amounts, expired sessions, tampered CSRF tokens, non-numeric IDs, suspended accounts, and hostile injection payloads.
- Verifications: Proper error reporting with HTTP 400, 401, 403, 404, 409, without unhandled exceptions or server crashes.

### Tier 3: Pairwise & Cross-Feature Integration (5 Complex Flows)
- File: `backend/test/e2e/tier3-cross-feature.test.ts`
- Scenarios:
  1. **Flow 1**: Program creation -> public discovery -> member registration -> roster inspection -> reminder dispatch -> notification inbox mark as read -> door check-in -> audit log trail.
  2. **Flow 2**: Online card donation -> offline cash recording -> unreconciled filtering -> financial reconciliation -> CSV ledger download -> analytics dashboard aggregation.
  3. **Flow 3**: Multi-mosque user context switching -> role privilege transitions between Mosque 1 (Comms Officer) and Mosque 2 (Finance Officer) -> strict permission boundaries.
  4. **Flow 4**: Cookie session and CSRF token rotation handshake across multiple mutation endpoints (POST -> PUT -> failed tampered DELETE -> refreshed valid DELETE).
  5. **Flow 5**: Public mosque onboarding application -> Platform Super Admin activation -> tenant admin initial login -> multi-officer invitations -> genesis audit verification.

### Tier 4: Real-World Multi-Tenant Workflows (3 Realistic Scenarios)
- File: `backend/test/e2e/tier4-real-world-workflows.test.ts`
- Scenarios:
  1. **Workflow A (Jumu'ah & Weekend Operations)**: Full day-in-the-life simulation with Communications Officer prayer khutbah broadcast, Programme Officer scheduling tajweed intensive, capacity cap saturation, dynamic capacity expansion, member self-service registrations, door check-ins, and analytics reconciliation.
  2. **Workflow B (Ramadan Fundraising & Treasury)**: Multi-channel fundraising drive with 3 online card donations (Zakat, Sadaqah, General), 2 manual cash collections (Waqf, Sadaqah), batch queue reconciliation, CSV export for trustees, and analytics revenue category breakdown.
  3. **Workflow C (Federated Sister Mosques Network)**: 3-mosque network (Mosque North, East, West) with shared executive and congregant users verifying zero cross-tenant data bleed, isolated public feeds, and independent audit trails.

---

## 4. How to Execute Tests

```bash
# 1. Run all E2E test suites via root npm command
npm run test:e2e

# 2. Or run directly inside backend
npm --prefix backend run test:e2e

# 3. Run all unit and logic tests
npm run test:logic
```
