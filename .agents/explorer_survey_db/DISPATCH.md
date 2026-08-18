# DISPATCH — Survey DB & Migrations

You are a teamwork_preview_explorer agent investigating the MasjidHub codebase.
Your working directory is: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\explorer_survey_db`
Project root: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub`
Authoritative request: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\ORIGINAL_REQUEST.md`

## Task
Investigate the current database and migration setup for MasjidHub:
1. Check `backend/prisma/schema.prisma`, any existing migrations in `backend/prisma/migrations`, sqlite db files.
2. Check `backend/prisma/seed.ts` or seed scripts, package.json scripts (`db:migrate`, `db:seed`, `db:push`, etc.).
3. Check how Prisma client is instantiated and used in `backend/src`.
4. Analyze what is needed to fulfill Requirement R1:
   - Baseline Prisma SQLite migration replacing unversioned schema pushes.
   - Clean environment initialization using migration deployment scripts (`prisma migrate deploy`).
   - Deterministic and idempotent demo seed script.
5. Write your detailed survey findings and recommendations to `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\explorer_survey_db\handoff.md` and send a message back to the orchestrator.
