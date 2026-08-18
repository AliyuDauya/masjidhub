# DISPATCH — Survey Frontend & Testing

You are a teamwork_preview_explorer agent investigating the MasjidHub codebase.
Your working directory is: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\explorer_survey_frontend_testing`
Project root: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub`
Authoritative request: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\ORIGINAL_REQUEST.md`

## Task
Investigate the current frontend architecture, UI workflows, and testing setup for MasjidHub:
1. Check frontend directory structure (Next.js app router or pages router, components, lib/api client, state management).
2. Check tenant workspace UI:
   - Programme management (creation, editing, capacity limits, attendee attendance check-in).
   - Donation reconciliation controls, receipt verification status updates, CSV ledger export.
   - In-app notification center and audit logs.
   - Role-based UI guards / permissions for the 5 tenant-local roles (`tenant_admin`, `finance_officer`, `programme_officer`, `communications_officer`, `member`).
3. Check existing tests: test scripts in `package.json` (backend, frontend, root), test runner configurations (Vitest/Jest/Playwright), existing test files.
4. Analyze what is needed to fulfill Requirement R3 (frontend workflows) and R4 (Comprehensive Automated Test Suite & Multi-Tenant Isolation):
   - Integration tests covering all 5 tenant-local roles.
   - Tests for global users with memberships across multiple mosques.
   - Adversarial multi-tenant isolation tests (zero cross-tenant data leakage or unauthorized cross-tenant mutations).
   - Full test runner setup (`npm run test:logic` or equivalent test scripts).
5. Write your detailed survey findings and recommendations to `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\explorer_survey_frontend_testing\handoff.md` and send a message back to the orchestrator.
