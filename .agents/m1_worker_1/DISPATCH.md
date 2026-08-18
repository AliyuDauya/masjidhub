# DISPATCH — Milestone 1: Worker 1 (Database Migrations & Seed Implementation)

You are a teamwork_preview_worker agent for Milestone 1.
Your working directory is: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\m1_worker_1`
Project root: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub`
Scope document: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\PROJECT.md`
Authoritative request: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\ORIGINAL_REQUEST.md`

## Files Owned Exclusively:
- `backend/prisma/seed.ts`
- `package.json` (root, for build script or scripts consistency if needed)

## Inputs:
- Read explorer handoff reports:
  - `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\m1_explorer_1\handoff.md`
  - `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\m1_explorer_2\handoff.md`
  - `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\m1_explorer_3\handoff.md`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Task & Acceptance Criteria:
1. Update `backend/prisma/seed.ts` to implement full 5-role seeding across 3 tenants (`al-noor`, `al-huda`, `al-iman`) with:
   - `tenant_admin` (Ahmad, Yusuf, Omar)
   - `finance_officer` (Fatima)
   - `programme_officer` (Tariq)
   - `communications_officer` (Zainab)
   - `member` (Ali - multi-tenant across Al-Noor & Al-Huda, Zayd)
   - `super_admin` (Platform Administrator)
   - Realistic demo announcements, programmes, registrations with attended check-ins, donations (unreconciled, reconciled, offline cash with `recorded_by`/`verified_by`, anonymous), in-app notifications, and structured `AuditEvent` records.
   - Clean, idempotent reverse-dependency deletion at start.
2. Execute and verify database commands:
   - `npm --prefix backend run db:migrate`
   - `npm --prefix backend run db:generate`
   - `npm --prefix backend run db:seed`
   - Re-run `npm --prefix backend run db:seed` to verify idempotency.
   - `npm --prefix backend test`
   - `npm run test:logic`
3. Document all executed commands and exact results in your report.
4. Write your detailed handoff report to `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\m1_worker_1\handoff.md` and send a message back.

## 2026-08-16T17:00:38Z
Update backend/prisma/seed.ts, execute database migrations and seeds, run test suites, and write your report to C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\m1_worker_1\handoff.md. Report back via send_message.
