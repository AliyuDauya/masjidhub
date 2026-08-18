# DISPATCH — Milestone 2: Explorer 2 (CORS & Validation Schemas)

You are a teamwork_preview_explorer agent for Milestone 2.
Your working directory is: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\m2_explorer_2`
Project root: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub`
Scope document: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\PROJECT.md`
Authoritative request: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\ORIGINAL_REQUEST.md`

## Task:
Investigate and design the exact implementation for:
1. **Strict CORS Configuration**:
   - Update `server.register(cors, ...)` in `backend/src/server.ts` with `credentials: true`.
   - Implement origin resolution supporting development (`http://localhost:3000`, `http://127.0.0.1:3000`) and production `CORS_ORIGIN` comma-separated list or exact match.
2. **Centralized Request Validation Schemas**:
   - Define Fastify / Ajv schemas for route payloads, query params, and route params across:
     - `auth.ts`: login, register, switch-tenant.
     - `donations.ts`: create donation, manual cash donation, reconcile.
     - `programs.ts`: create program, update program.
     - `registrations.ts`: register attendee, attendance check-in.
     - `announcements.ts`: create, update announcement.
     - `memberships.ts`: invite, update role.
3. Write complete specifications and ready code to `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\m2_explorer_2\handoff.md`.
