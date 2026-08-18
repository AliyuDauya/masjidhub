# Test Infrastructure & Coverage Matrix: MasjidHub E2E Test Suite

## Overview & Architecture
MasjidHub uses a sovereign, multi-tenant administrative architecture powered by Fastify 5, Prisma ORM with SQLite, and Next.js 16.
The End-to-End (E2E) test suite implements a rigorous 4-tier requirement-driven testing architecture that validates the system from isolated feature behaviors to real-world multi-tenant operations.

### Test Execution Configuration
- **Test Runner**: Vitest (`pool: 'forks'`, `singleFork: true` for deterministic SQLite state).
- **Standalone Command**: `npm run test:e2e` (root) / `npm --prefix backend run test:e2e` (backend).
- **Test Framework**: Vitest + Fastify `inject()` for high-fidelity HTTP protocol emulation without open port conflicts.
- **Database Engine**: Prisma Client with SQLite transactions and deterministic tenant teardown.

---

## 20-Feature Inventory & Tier Mapping

| # | Feature Key | Feature Name | Description | Tier 1 (Coverage) | Tier 2 (Boundaries) | Tier 3 (Cross-Feature) | Tier 4 (Workflows) |
|---|-------------|--------------|-------------|-------------------|---------------------|------------------------|--------------------|
| 1 | `F01_DB_MIGRATIONS` | Baseline Prisma SQLite Migration | Baseline migration `20250101000000_initial` & schema integrity | ≥5 tests | ≥5 tests | Included in Setup | Tenant Lifecycle |
| 2 | `F02_ENV_INIT` | Clean Environment Initialization | Automated migration deploy and SQLite table initialization | ≥5 tests | ≥5 tests | Included in Setup | Tenant Lifecycle |
| 3 | `F03_DEMO_SEED` | Deterministic Demo Seeding | Idempotent seed script populating 5 roles & demo records | ≥5 tests | ≥5 tests | Multi-tenant setup | Global seed state |
| 4 | `F04_COOKIE_AUTH` | HTTP-Only Cookie Authentication | `mh_session` cookie issuance, extraction, and auth | ≥5 tests | ≥5 tests | Auth in all combos | Officer sessions |
| 5 | `F05_CSRF_PROTECT` | CSRF Protection | Enforce signed CSRF tokens on mutation routes | ≥5 tests | ≥5 tests | CSRF validation flow | Admin operations |
| 6 | `F06_SCHEMA_VALID` | Centralized Request Validation | Fastify/Ajv JSON schemas on all endpoints | ≥5 tests | ≥5 tests | Payload edge cases | Form submissions |
| 7 | `F07_STRICT_CORS` | Strict Production CORS | Origin whitelist and credentials resolution | ≥5 tests | ≥5 tests | Origin header flows | Client integration |
| 8 | `F08_AUDIT_LOGGING` | Structured Audit Event Logging | `AuditEvent` generation on privileged actions | ≥5 tests | ≥5 tests | Audit chain check | Full audit trail |
| 9 | `F09_PROGRAM_LIFECYCLE` | Programme Lifecycle Management | CRUD operations, capacity limits, and statuses | ≥5 tests | ≥5 tests | Program + Checkin | Event operations |
| 10 | `F10_ATTENDANCE_CHECKIN` | Attendee Check-in & Reminders | Program registration, check-in toggling, reminders | ≥5 tests | ≥5 tests | Program + Notif | Community check-in |
| 11 | `F11_DONATION_RECONCILE` | Donation Reconciliation & Offline | Public donations, manual cash, reconciliation | ≥5 tests | ≥5 tests | Donation + Audit | Financial cycle |
| 12 | `F12_CSV_EXPORT` | CSV Ledger Export | Stream structured CSV donation ledger | ≥5 tests | ≥5 tests | Donation + Export | Treasury reporting |
| 13 | `F13_NOTIFICATIONS` | In-App Notification Center | Member/admin notification inbox and mark-as-read | ≥5 tests | ≥5 tests | Reminders + Inbox | Member updates |
| 14 | `F14_AUDIT_VIEWER` | Tenant Audit Log Viewer | Dedicated audit log retrieval isolated to tenant | ≥5 tests | ≥5 tests | Audit + Multi-tenant | Compliance audit |
| 15 | `F15_ROLE_WORKSPACES` | 5-Role Workspace Views & RBAC | Endpoint permission matrix for 5 local roles | ≥5 tests | ≥5 tests | Role transitions | Multi-role day |
| 16 | `F16_ROLE_INTEGRATION` | 5-Role Integration Test Suite | Automated verification of 200 vs 403 per role | ≥5 tests | ≥5 tests | RBAC cross-matrix | Delegated duties |
| 17 | `F17_MULTI_MOSQUE_USERS` | Multi-Mosque Global Users | Single user with active memberships in multi mosques | ≥5 tests | ≥5 tests | Switch tenant flow | Multi-mosque user |
| 18 | `F18_CROSS_TENANT_ISOLATION` | Adversarial Multi-Tenant Isolation | Zero cross-tenant data leakage / mutations across 3+ tenants | ≥5 tests | ≥5 tests | Cross-tenant tamper | Tenant boundaries |
| 19 | `F19_OPAQUE_BOX_E2E` | Opaque-Box E2E Test Suite | Black-box HTTP API testing without DB shortcuts | ≥5 tests | ≥5 tests | Dual auth modes | End-to-end flows |
| 20 | `F20_ADVERSARIAL_HARDENING` | Final Integration & Adversarial | Stress tests, Unicode, injection defenses, concurrency | ≥5 tests | ≥5 tests | Adversarial matrix | Production hardening |

---

## 4-Tier Test Coverage Strategy & Thresholds

### Tier 1: Feature Isolation Coverage (Threshold: ≥5 tests per feature = 100+ tests)
- **Goal**: Verify every individual feature's contract in complete isolation under normal (happy path) conditions.
- **Scope**: Features 1 through 20.
- **Verification**: Exact HTTP status codes (200, 201), JSON schema compliance, cookie presence, and database state updates.

### Tier 2: Boundary & Corner Cases (Threshold: ≥5 tests per feature = 100+ tests)
- **Goal**: Verify edge conditions, extreme parameters, zero amounts, capacity overflow, invalid tokens, duplicate slugs, revoked access, and malformed inputs.
- **Scope**: Features 1 through 20.
- **Verification**: Proper rejection with HTTP 400, 401, 403, 404, 409, or sanitized handling without server unhandled exceptions.

### Tier 3: Cross-Feature & Pairwise Combinations
- **Goal**: Verify seamless interaction between multiple interconnected features in operational sequences.
- **Key Scenarios**:
  - `Login -> Switch Tenant -> Create Program -> Register -> Check-in -> Audit Verify`.
  - `Manual Cash Donation -> Reconcile -> Audit Log -> CSV Export -> Verify Ledger Entry`.
  - `Create Program -> Dispatch Reminders -> Verify Member Notification Inbox -> Mark as Read`.
  - `Multi-Role Delegation -> Role Mutation -> Verify Immediate Permission Enforcement`.

### Tier 4: Real-World Multi-Tenant Workflows
- **Goal**: Execute realistic day-in-the-life simulations of multi-tenant mosque operations across multiple organizations, officers, and congregation members.
- **Key Scenarios**:
  - **Scenario A: Friday Community Flow (Jumu'ah & Weekend Programs)**: Program scheduling, member registrations, attendance check-in at door, post-event notifications, and audit logging.
  - **Scenario B: Ramadan Financial Drive & Reconciliation**: Multi-channel donations (Card, Transfer, Cash), donor receipt issuance, finance officer reconciliation, CSV export, and compliance review.
  - **Scenario C: Multi-Mosque Community Member**: Single global user navigating between home mosque (as Member) and regional sister mosque (as Finance Officer), verifying context isolation and zero data leakage.

---

## How to Execute the E2E Test Suite
```bash
# Run full E2E test suite from project root
npm run test:e2e

# Or execute directly inside backend directory
npm --prefix backend run test:e2e
```
