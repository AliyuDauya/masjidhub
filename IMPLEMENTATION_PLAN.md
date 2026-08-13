# MasjidHub Implementation Plan

## Current state

The core multi-tenant platform is implemented with Next.js, Fastify, Prisma, and SQLite. The completed foundation includes mosque onboarding and lifecycle management, platform administration, global users and tenant memberships, tenant-local roles, JWT authorization, donations and receipts, programme registration, attendance, notifications, audit events, a connected frontend, and current integration tests.

## Continuation plan

### 1. Versioned database setup

- Create a baseline Prisma migration for the SQLite schema.
- Change fresh-environment setup from `prisma db push` to migration deployment.
- Keep the seed command strictly for local demonstration data.
- Document upgrade and rollback expectations.

### 2. Automated test coverage

- Replace the legacy mocked tests with real Fastify and Prisma integration tests.
- Cover each tenant-local role: tenant administrator, finance officer, programme officer, communications officer, and member.
- Test global users with memberships in more than one mosque.
- Test tenant application, activation, suspension, and denied access.
- Test donation creation, receipts, reconciliation, CSV exports, programme capacity, attendance, notifications, and audit events.
- Add browser-level tests for key public and administrative workflows.

### 3. Security hardening

- Replace browser `localStorage` JWT storage with secure, HTTP-only cookie sessions.
- Add CSRF protection for state-changing browser requests.
- Require a production `JWT_SECRET` and document secret rotation.
- Restrict CORS to configured frontend origins in production.
- Centralise request validation and review audit coverage for financial and privileged actions.
- Add dependency and security scanning to the verification workflow.

### 4. Product and accessibility completion

- Complete administrative programme creation, editing, attendee management, and reminders in the frontend.
- Add donation reconciliation and export controls to the tenant workspace.
- Surface notification history and audit history for authorised users.
- Review mobile layouts, keyboard navigation, focus states, contrast, loading, empty, error, and success states.

### 5. Deployment and recovery

- Add Dockerfiles and a Docker Compose development/production reference setup.
- Add a production environment template and health-check endpoint.
- Document SQLite backup, restore, retention, and recovery verification procedures.
- Add structured logging and basic operational monitoring guidance.

### 6. Proposal evaluation evidence

- Run adversarial tenant-isolation test cases across at least three mosque tenants.
- Run load tests and record median and 95th-percentile response times, throughput, and error rate.
- Execute the proposal's user-acceptance scenarios.
- Prepare a System Usability Scale questionnaire and consented results template.
- Produce a concise evaluation report for the final research project.

### 7. GitHub publication

- Resolve GitHub CLI authentication and the unavailable proxy configuration.
- Create a feature branch, commit this implementation, push it, and open a draft pull request.

## Recommended next action

Start with the baseline SQLite migration. It makes the database reproducible for assessment, testing, deployment, and future changes.
