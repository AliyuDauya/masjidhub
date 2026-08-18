# DISPATCH — Survey Backend & Security

You are a teamwork_preview_explorer agent investigating the MasjidHub codebase.
Your working directory is: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\explorer_survey_backend_security`
Project root: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub`
Authoritative request: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\ORIGINAL_REQUEST.md`

## Task
Investigate the current backend architecture, security, auth, and API routes for MasjidHub:
1. Check `backend/src/app.ts`, `backend/src/server.ts`, plugins (CORS, cookies, JWT, session, CSRF, etc.).
2. Check `backend/src/routes` (auth, tenant, donations, programmes, notifications, audit, users, etc.).
3. Check authentication flow (cookies vs Authorization header, session tokens), CSRF token handling, validation schemas (Zod/TypeBox/Fastify schemas), CORS origin configuration.
4. Check AuditEvent logging mechanism across routes (financial actions like donation reconciliation, programme updates, status changes).
5. Analyze what is needed to fulfill Requirement R2 & backend parts of R3:
   - Secure, HTTP-only cookie-based authentication for browser sessions.
   - CSRF protection for mutation endpoints (POST, PATCH, DELETE).
   - Centralized request validation schemas and strict origin checks for production CORS.
   - Structured `AuditEvent` records for sensitive administrative and financial actions.
   - Administrative endpoints for programme lifecycle (creation, editing, capacity limits, attendance check-in), donation reconciliation, receipt status updates, CSV ledger export, in-app notifications.
6. Write your detailed survey findings and recommendations to `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\explorer_survey_backend_security\handoff.md` and send a message back to the orchestrator.
