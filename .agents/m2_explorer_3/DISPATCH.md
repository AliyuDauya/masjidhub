# DISPATCH — Milestone 2: Explorer 3 (AuditEvent Logging & Integration Tests)

You are a teamwork_preview_explorer agent for Milestone 2.
Your working directory is: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\m2_explorer_3`
Project root: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub`
Scope document: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\PROJECT.md`
Authoritative request: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\ORIGINAL_REQUEST.md`

## Task:
Investigate and design:
1. **AuditEvent Structured Logging Audit**:
   - Verify every sensitive administrative and financial action creates an `AuditEvent` with `actor_id`, `mosque_id`, `action`, `target_type`, `target_id`, `summary`, `ip_address`, `request_id`.
   - Verify actions covered:
     - `donation.reconciled`, `donation.recorded` (offline cash), `donation.completed` (online)
     - `program.created`, `program.updated`, `program.deleted`
     - `attendance.recorded`
     - `announcement.created`, `announcement.updated`, `announcement.deleted`
     - `membership.invited`, `membership.updated`
     - `tenant.applied`, `tenant.updated`, `tenant.active`, `tenant.suspended`
2. **Security Integration Test Plan**:
   - Design integration test cases asserting:
     - `mh_session` cookie issued and authenticated.
     - Mutation endpoints reject requests lacking CSRF token with HTTP 403.
     - CORS rejects unauthorized origins and attaches `credentials: true`.
     - Invalid body payloads return HTTP 400 Bad Request with validation errors.
     - Sensitive actions persist `AuditEvent` records in the database.
3. Write your report to `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\m2_explorer_3\handoff.md`.
