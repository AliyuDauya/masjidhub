# Explorer Survey Report: Frontend Architecture & Testing Infrastructure

## 1. Observation

### 1.1 Frontend Architecture & Directory Structure
- **Framework & Router**: Next.js `16.2.10` with React `19.2.4` using the App Router (`frontend/src/app`).
  - `frontend/package.json`: Lines 14–18 indicate `"next": "16.2.10"`, `"react": "19.2.4"`, `"react-dom": "19.2.4"`.
  - `frontend/src/app/layout.tsx`: Lines 21–27 configure the root layout with League Spartan font and custom design tokens.
  - `frontend/src/lib/api.ts`: Lines 1–23 define the API client (`api<T>`), which reads and writes JWT tokens to `localStorage` under `masjidhub:${slug}:token` or `masjidhub:platform:token`, attaching `X-Mosque-Slug` and `Authorization: Bearer <token>` headers.
- **Route Inventory**:
  1. `frontend/src/app/page.tsx`: Public platform landing page with luxury editorial theme, mosque search, directory index, capabilities, and onboarding application modal.
  2. `frontend/src/app/platform/page.tsx`: Platform super-admin console for reviewing tenant applications, activating/suspending mosques, and viewing platform-wide metrics.
  3. `frontend/src/app/mosque/[slug]/page.tsx`: Public tenant portal displaying localized daily prayer timetable (Iqamah), announcements noticeboard, and action links.
  4. `frontend/src/app/mosque/[slug]/login/page.tsx`: Tenant sign-in page storing token in `localStorage` and routing based on role (`member` -> `/programs`, staff -> `/admin`).
  5. `frontend/src/app/mosque/[slug]/register/page.tsx`: Public member registration creating a `member` role account.
  6. `frontend/src/app/mosque/[slug]/programs/page.tsx`: Member-facing programme directory with seat reservation (`POST /api/programs/:id/register`) and cancellation (`POST /api/programs/:id/cancel`).
  7. `frontend/src/app/mosque/[slug]/donations/page.tsx`: Public giving portal with category selection (Zakat, Sadaqah, Waqf, General), payment method selection (Card, Transfer), and instant digital receipt modal (`MH-...` receipt number).
  8. `frontend/src/app/mosque/[slug]/admin/page.tsx`: Tenant administrator workspace containing 4 tabs: `announcements`, `members`, `donations`, and `settings`.
  9. `frontend/src/app/mosque/[slug]/admin/analytics/page.tsx`: Operational analytics dashboard displaying giving totals by category/method and programme fill rates.

### 1.2 Tenant Workspace UI Gap Analysis (Requirement R3)
- **Programme Lifecycle Management**:
  - `frontend/src/app/mosque/[slug]/admin/page.tsx` line 8 defines `type Tab = 'announcements' | 'members' | 'donations' | 'settings';`. There is currently **no** `programs` or `attendance` tab in the admin workspace.
  - Backend endpoints already exist in `backend/src/routes/programs.ts` and `backend/src/routes/registrations.ts`:
    - `POST /api/admin/programs`: Create programme with title, description, start/end dates, location, max_capacity.
    - `PUT /api/admin/programs/:id`: Update existing programme.
    - `DELETE /api/admin/programs/:id`: Delete programme.
    - `GET /api/admin/programs/:id/registrations`: List registered attendees with contact details.
    - `PATCH /api/admin/registrations/:id/attendance`: Mark attendee check-in (`status: 'Attended'`).
    - `POST /api/admin/programs/:id/reminders`: Send in-app reminder notifications to all registered attendees.
- **Donation Reconciliation & CSV Export**:
  - `frontend/src/app/mosque/[slug]/admin/page.tsx` line 31 implements `exportDonations()` which downloads `export.csv` from `/api/admin/donations/export.csv`.
  - However, line 41 renders a read-only list of donations without reconciliation controls.
  - Missing UI controls:
    - Button to execute `PATCH /api/admin/donations/:id/reconcile` to mark donations as `Reconciled` by the authenticated officer.
    - Modal or form to execute `POST /api/admin/donations/manual` for offline cash donations.
    - Filter controls for `status`, `category`, and `reconciliation_status` (`Unreconciled` vs `Reconciled`).
- **In-App Notification Center & Audit Logs**:
  - In-App Notifications: Backend provides `GET /api/members/notifications` and `PATCH /api/members/notifications/:id/read`. Frontend headers currently have no notification center icon, unread counter badge, or notification dropdown.
  - Audit Logs: Backend provides `GET /api/admin/audit-events` (with actor name/email, action, target, summary, IP, timestamp). Frontend `/admin` has no `audit` tab or audit event viewer for authorized officers.
- **Role-Based UI Navigation & Guards**:
  - The 5 tenant-local roles defined in `backend/prisma/schema.prisma` line 60 are:
    1. `tenant_admin`
    2. `finance_officer`
    3. `programme_officer`
    4. `communications_officer`
    5. `member`
  - In `frontend/src/app/mosque/[slug]/admin/page.tsx`, navigation tabs (`announcements`, `members`, `donations`, `settings`) are hardcoded and statically rendered for any user entering the page without filtering tabs based on the user's role.

### 1.3 Testing Infrastructure & Current Test Results (Requirement R4)
- **Root Scripts (`package.json`)**:
  - `npm run test:logic`: Executes `npm --prefix backend run test:node && npm --prefix frontend run test:node`.
    - Executed and observed:
      - `backend/test/standalone_runner.js`: 10/10 tests passed (Tenant hook, password security, registration logic, capacity checks, donation calculations).
      - `frontend/__tests__/standalone_runner.js`: 11/11 tests passed (Search filter, slug formatting, form validations, checkout logic, seat toggles, analytics calculations).
  - `npm test`: Executes `npm --prefix backend test && npm --prefix frontend test`.
    - Executed and observed:
      - Backend Vitest (`backend/test/current/platform.integration.test.ts`): 6/6 tests passed (Tenant creation, activation gate, membership auth, cross-tenant token denial, role elevation prevention, integer-minor donation recording).
      - Frontend Vitest (`frontend/__tests__/current/landing.test.tsx`): Failed with `ReferenceError: IntersectionObserver is not defined` at `frontend/src/app/page.tsx:81:22` in jsdom environment, plus mismatched placeholder text assertions.
- **Test Runner Configs**:
  - `backend/vitest.config.ts`: Configured with `include: ['test/current/**/*.test.ts']`, `pool: 'forks'`.
  - `frontend/vitest.config.ts`: Configured with `include: ['__tests__/current/**/*.test.tsx']`, `environment: 'jsdom'`.
- **TypeScript Compilation**:
  - `npm --prefix backend run build` (`tsc`): Exited with code 0 (zero TypeScript errors).

---

## 2. Logic Chain

1. **Frontend Completeness & Usability**:
   - The backend API already implements all administrative endpoints required for Requirement R3 (`/api/admin/programs`, `/api/admin/programs/:id/registrations`, `/api/admin/registrations/:id/attendance`, `/api/admin/programs/:id/reminders`, `/api/admin/donations/manual`, `/api/admin/donations/:id/reconcile`, `/api/admin/audit-events`, `/api/members/notifications`).
   - Adding corresponding UI views in `frontend/src/app/mosque/[slug]/admin/page.tsx` and adding a Notification Center component in the header directly satisfies Requirement R3.
2. **Role-Based Workspace Personalization**:
   - Each tenant-local role has distinct responsibilities:
     - `tenant_admin`: full access to all workspace tabs (`announcements`, `programs`, `donations`, `members`, `audit`, `settings`).
     - `finance_officer`: access restricted to `donations` (ledger, manual entry, reconciliation, export CSV) and financial reports in `analytics`.
     - `programme_officer`: access restricted to `programs` (creation, editing, capacity limits, attendee check-in, reminder triggers) and registration reports.
     - `communications_officer`: access restricted to `announcements` (create, edit, publish, schedule).
     - `member`: redirected to community portal (`/programs`, `/donations`, notifications).
   - Dynamically filtering workspace tabs according to the authenticated user's role ensures least-privilege administrative UX and prevents unauthorized API calls.
3. **Automated Test Suite Expansion**:
   - To satisfy Requirement R4, the test suite must verify:
     1. **5 Tenant-Local Roles**: A dedicated integration test suite exercising every endpoint across `tenant_admin`, `finance_officer`, `programme_officer`, `communications_officer`, and `member`, asserting 200/201 on permitted operations and 403 Forbidden on restricted operations.
     2. **Multi-Mosque Global Users**: A test case verifying a global user account holding active memberships in Mosque 1 and Mosque 2, authenticating and switching context via `/api/auth/switch-tenant/:slug` without data corruption.
     3. **Adversarial Multi-Tenant Isolation**: A multi-tenant isolation suite across at least 3 distinct active mosques (e.g. `mosque-a`, `mosque-b`, `mosque-c`), testing that tokens issued for Mosque A cannot read or mutate Mosque B/C donations, programmes, announcements, attendees, notifications, or audit logs.
     4. **Frontend Test Suite Robustness**: Fixing the `IntersectionObserver` mock in frontend tests and updating test assertions to match the current luxury UI components.

---

## 3. Caveats

1. **Cookie-Based Sessions (R2 Dependency)**:
   - Currently, `frontend/src/lib/api.ts` passes tokens via `localStorage` and `Authorization: Bearer <token>`. When HTTP-only cookies and CSRF protection are introduced by security hardening tasks, `api.ts` must use `credentials: 'include'` and send CSRF header tokens on mutation requests.
2. **Node Test Runner vs Vitest**:
   - `package.json` contains both `test:logic` (Node standalone runner) and `test` (Vitest). Both test runners should be maintained in passing status with 100% success rate.
3. **jsdom DOM APIs**:
   - Modern browser features such as `IntersectionObserver` or `window.matchMedia` must be polyfilled or guarded in React client components (`typeof window !== 'undefined' && 'IntersectionObserver' in window`) so tests running in `jsdom` execute cleanly.

---

## 4. Conclusion

The MasjidHub backend has robust multi-tenant models, domain endpoints, and security middleware in place. The path to complete Requirements R3 and R4 is clearly mapped:

1. **Frontend Enhancements (R3)**:
   - Extend `AdminDashboard` (`frontend/src/app/mosque/[slug]/admin/page.tsx`) with:
     - `programs` tab: programme creation form, edit modal, capacity indicators, attendee check-in list, reminder trigger.
     - `donations` tab upgrades: "Reconcile" action button per donation row, "Record Offline Cash" modal, status filters.
     - `audit` tab: structured audit event ledger for tenant admins.
     - Role-based navigation tab filter restricting visible tabs by role (`tenant_admin`, `finance_officer`, `programme_officer`, `communications_officer`).
   - Add In-App Notification Center in tenant header/portal with unread count badge and mark-as-read capability.
2. **Automated Testing Completion (R4)**:
   - Implement `backend/test/current/roles.integration.test.ts` covering all 5 tenant-local roles.
   - Implement `backend/test/current/multi_tenant_isolation.integration.test.ts` testing adversarial cross-tenant access across 3 tenants and multi-mosque global user switching.
   - Fix `frontend/__tests__/current/landing.test.tsx` (mock `IntersectionObserver` and align selectors).
   - Update `backend/test/standalone_runner.js` and `frontend/__tests__/standalone_runner.js` to cover the new workflows.

---

## 5. Verification Method

To independently verify the frontend and testing infrastructure:

1. **Run Standalone Logic Test Runner**:
   ```bash
   npm run test:logic
   ```
   *Expected*: Both backend and frontend standalone runners pass 100% with zero failures.

2. **Run Backend Vitest Integration Suite**:
   ```bash
   npm --prefix backend test
   ```
   *Expected*: Vitest executes real Fastify + Prisma SQLite tests and passes with 100% success rate.

3. **Run Frontend Vitest Suite**:
   ```bash
   npm --prefix frontend test
   ```
   *Expected*: Vitest executes React Testing Library component tests in jsdom without reference errors.

4. **Verify TypeScript Builds**:
   ```bash
   npm --prefix backend run build
   npm --prefix frontend run build
   ```
   *Expected*: Zero TypeScript compiler errors across both projects.
