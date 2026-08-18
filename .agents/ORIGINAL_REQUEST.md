# Original User Request

## Initial Request — 2026-08-16T15:44:51Z

You are the Project Orchestrator for MasjidHub.

Your working directory is: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\orchestrator`
The project root is: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub`
The authoritative user request is located at: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\ORIGINAL_REQUEST.md`

## Mission & Requirements
MasjidHub is a sovereign multi-tenant administrative platform for mosques built with Fastify, Prisma/SQLite, and Next.js. You are leading the full end-to-end implementation and verification of:

### R1. Versioned Database Migrations & Reproducible Setup
- Establish a baseline Prisma SQLite migration replacing unversioned schema pushes.
- Configure clean environment initialization using migration deployment scripts (`prisma migrate deploy`).
- Ensure local demonstration seeds run deterministically without invalidating migration history.

### R2. Security Hardening & Session Security
- Implement secure, HTTP-only cookie-based authentication for browser sessions.
- Enforce CSRF protection for all state-changing mutation endpoints (`POST`, `PATCH`, `DELETE`).
- Centralize request validation schemas and enforce strict origin checks for production CORS.
- Ensure sensitive administrative and financial actions generate structured `AuditEvent` records.

### R3. Administrative Workflows & Frontend Completion
- Complete administrative programme lifecycle controls in the tenant workspace: programme creation, editing, capacity limits, and attendee attendance check-in.
- Implement donation reconciliation controls, receipt verification status updates, and CSV ledger export functionality.
- Surface in-app notification center and audit logs for authorized officers in the tenant portal.

### R4. Comprehensive Automated Test Suite & Multi-Tenant Isolation
- Implement end-to-end integration tests covering all 5 tenant-local roles: `tenant_admin`, `finance_officer`, `programme_officer`, `communications_officer`, and `member`.
- Test global users possessing active memberships across multiple mosques.
- Execute adversarial isolation test cases across multiple tenants verifying zero cross-tenant data leakage or unauthorized cross-tenant mutations.

## Acceptance Criteria to Satisfy
- [ ] Fresh database initialization succeeds via `npm --prefix backend run db:migrate` and applies baseline migrations without errors.
- [ ] Seed script executes idempotently via `npm --prefix backend run db:seed` and populates demo tenants, programmes, and donation records.
- [ ] Authentication endpoints issue secure, HTTP-only session cookies.
- [ ] State-changing endpoints reject requests lacking a valid CSRF token with HTTP 403.
- [ ] Privileged financial actions (donation reconciliation, status changes) create corresponding `AuditEvent` records.
- [ ] Authorized officers can create programmes, modify capacity, and mark attendee check-ins via API and UI.
- [ ] Finance officers can reconcile donations and download structured CSV ledger exports.
- [ ] In-app notifications are delivered to users and can be marked as read.
- [ ] Automated test suite verifies permissions and restrictions across all 5 roles.
- [ ] Multi-tenant isolation tests verify that tenant A cannot read or mutate donations, programmes, announcements, or members of tenant B.
- [ ] Full test runner (`npm run test:logic` or equivalent test scripts) executes and passes with 100% success rate.
- [ ] Frontend and backend build commands compile with zero TypeScript or syntax errors.
