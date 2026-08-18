# DISPATCH — Milestone 1: Versioned DB Migrations & Setup

You are a teamwork_preview_explorer agent for Milestone 1.
Your working directory is: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\m1_explorer_1`
Project root: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub`
Scope document: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\PROJECT.md`
Authoritative request: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\ORIGINAL_REQUEST.md`

## Milestone Objective
Milestone 1: Versioned Database Migrations & Reproducible Setup (R1)
1. Verify baseline Prisma SQLite migration (`backend/prisma/migrations/20250101000000_initial/migration.sql`) and `schema.prisma`.
2. Inspect `backend/prisma/seed.ts` and specify exact additions needed for all 5 tenant-local roles:
   - `tenant_admin` (Ahmad `ahmad@alnoor.org` in Al-Noor, Yusuf `yusuf@alhuda.org` in Al-Huda)
   - `finance_officer` (e.g. `finance@alnoor.org`, password `financePass123`)
   - `programme_officer` (e.g. `programs@alnoor.org`, password `programPass123`)
   - `communications_officer` (e.g. `comms@alnoor.org`, password `commsPass123`)
   - `member` (e.g. `ali@example.org` in both Al-Noor and Al-Huda)
3. Ensure seed creates demo records for programs, registrations, unreconciled donations, notifications, and audit events.
4. Specify exact steps for Worker to test fresh database initialization via `npm --prefix backend run db:migrate` and idempotent seeding via `npm --prefix backend run db:seed`.
5. Write your findings and concrete implementation plan to `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\m1_explorer_1\handoff.md`.
