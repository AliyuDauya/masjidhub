# Milestone 3 Explorer 3 Handoff Report: Notification Center, Audit Log Viewer, Role-Based Navigation & Frontend Test Strategy

**Working Directory**: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub\.agents\m3_explorer_3`  
**Project Root**: `C:\Users\abdoulaahmad\Documents\masjidhub\masjidhub`  
**Date**: 2026-08-16  
**Author**: `m3_explorer_3`  
**Status**: COMPLETE  

---

## 1. Observation

### 1.1 In-App Notification Center
1. **Backend Route Implementations (`backend/src/routes/notifications.ts:12-26`)**:
   - `GET /api/members/notifications`: Authenticated via `fastify.requireMembership()`. Scoped strictly to `mosque_id: request.tenant.mosque_id` and `user_id: payload.user_id`, ordered by `created_at: 'desc'`.
   - `PATCH /api/members/notifications/:id/read`: Authenticated via `fastify.requireMembership()`. Validates params against `readNotificationSchema`, scopes to caller's tenant and user ID, and updates `is_read: true`.
   - `POST /api/admin/programs/:id/reminders`: Authenticated for `['tenant_admin', 'programme_officer']`. Creates `Notification` records (`type: 'In-App'`, `status: 'Sent'`, `related_type: 'Program'`, `related_id: program.program_id`) for all registered attendees and logs `program.reminders_sent` audit event.
2. **Database Model (`backend/prisma/schema.prisma:154-171`)**:
   - Model `Notification` contains: `notif_id (Int, PK)`, `mosque_id (Int)`, `user_id (Int)`, `message (String)`, `type (String)`, `status (String, default "Queued")`, `related_type (String?)`, `related_id (Int?)`, `is_read (Boolean, default false)`, `sent_at (DateTime?)`, `created_at (DateTime)`.
3. **E2E Test Verifications (`backend/test/e2e/tier1-feature-coverage.test.ts:1020-1089`)**:
   - Tests 13.1 through 13.5 verify retrieving notifications, verifying schema fields (`message`, `type`, `is_read`), marking as read via `PATCH`, and desc ordering.
4. **Frontend Gap**:
   - Neither `frontend/src/app/mosque/[slug]/page.tsx` nor `frontend/src/app/mosque/[slug]/admin/page.tsx` has a notification dropdown, bell icon, unread counter badge, or mark-read handler.
   - `frontend/src/lib/api.ts` provides universal `api<T>` fetching with cookies, `X-Mosque-Slug`, and automatic CSRF handling, but lacks dedicated notification helpers.

---

### 1.2 Tenant Audit Log Viewer
1. **Backend Route Implementation (`backend/src/routes/notifications.ts:56-63`)**:
   ```ts
   fastify.get('/api/admin/audit-events', { preHandler: [fastify.adminOnly] }, async (request, reply) => {
     reply.send(await fastify.prisma.auditEvent.findMany({
       where: { mosque_id: request.tenant.mosque_id },
       include: { actor: { select: { name: true, email: true } } },
       orderBy: { created_at: 'desc' },
       take: 200
     }));
   });
   ```
2. **Audit Logging Coverage Across All Controllers**:
   - Audit events are emitted across all state mutations via `fastify.audit(request, action, targetType, targetId, summary)`:
     - `program.created`, `program.updated`, `program.deleted`, `program.reminders_sent` (`programs.ts:66, 114, 150`, `notifications.ts:52`)
     - `donation.completed`, `donation.recorded`, `donation.reconciled`, `donations.exported` (`donations.ts:54, 91, 136, 151`)
     - `membership.registered`, `membership.invited`, `membership.updated` (`auth.ts:76`, `memberships.ts:36, 50`)
     - `announcement.created`, `announcement.updated`, `announcement.deleted` (`announcements.ts:87, 133, 169`)
3. **Database Model (`backend/prisma/schema.prisma:173-189`)**:
   - `AuditEvent` contains `audit_id`, `mosque_id`, `actor_id`, `action`, `target_type`, `target_id`, `summary`, `request_id`, `ip_address`, `created_at`, `actor (User)`.
4. **E2E Test Coverage (`backend/test/e2e/tier1-feature-coverage.test.ts:1095-1168`)**:
   - Tests 14.1-14.5 verify tenant-only visibility, actor relation inclusion, tenant isolation, descending date ordering, and 403 rejection for non-admin officers.
5. **Frontend Gap**:
   - In `frontend/src/app/mosque/[slug]/admin/page.tsx:8,33`, `Tab` union is hardcoded to `'announcements' | 'members' | 'donations' | 'settings'`. There is no `'audit'` tab or interface to display audit events.

---

### 1.3 Role-Based Navigation Filtering
1. **Role Matrix & Permissions Specification (`PROJECT.md:11, 60-73`, `tier1-feature-coverage.test.ts:1173-1241`)**:
   - `tenant_admin`: Access to all 7 tabs (`overview`, `announcements`, `programs`, `donations`, `members`, `audit`, `settings`).
   - `finance_officer`: Access to `overview`, `donations` (reconciliation, manual cash entry, CSV ledger export). 403 on programmes, announcements, memberships, audit, settings.
   - `programme_officer`: Access to `overview`, `programs` (lifecycle, capacity, attendance check-in, reminders). 403 on donations, announcements, memberships, audit, settings.
   - `communications_officer`: Access to `overview`, `announcements` (create, edit, publish notices). 403 on donations, programmes, memberships, audit, settings.
   - `member`: Access to public portal, learning programmes, donations, in-app notifications. No officer workspace access.
2. **Frontend Gap**:
   - `frontend/src/app/mosque/[slug]/admin/page.tsx` renders static tabs without evaluating the caller's role.
   - When a `finance_officer` or `programme_officer` logs in, they are redirected to `/mosque/[slug]/admin`, but see tabs for which they receive 403 errors when attempting to view or submit.
   - User role is returned by `/api/auth/login` and `/api/auth/me` but not preserved to drive workspace UI view state.

---

### 1.4 Frontend Test Environment & `landing.test.tsx`
1. **Vitest Test Target (`frontend/vitest.config.ts:10-15`)**:
   ```ts
   test: {
     environment: 'jsdom',
     globals: true,
     include: ['__tests__/current/**/*.test.tsx'],
   }
   ```
2. **Root Cause of Test Failure**:
   - In `frontend/src/app/page.tsx:71-90`, `useEffect` directly creates `new IntersectionObserver(...)`.
   - In JSDOM, `IntersectionObserver` is `undefined`.
   - When `render(<GlobalLandingPage />)` runs in `landing.test.tsx`, `new IntersectionObserver` throws `ReferenceError: IntersectionObserver is not defined`.
3. **Form Query Discrepancy in `landing.test.tsx:14-18`**:
   - `landing.test.tsx` looks for:
     - `screen.getByRole('button', { name: 'Register Mosque' })` (or `/register mosque/i`)
     - `screen.getByText('Register Your Mosque')` (or `/register your mosque/i`)
     - `screen.getByPlaceholderText('Administrator full name')`
     - `screen.getByPlaceholderText('Administrator sign-in email')`
     - `screen.getByPlaceholderText('Password (at least 8 characters)')`
   - In `frontend/src/app/page.tsx:745-855`:
     - Button has uppercase text `REGISTER MOSQUE` (line 248).
     - Heading is `REGISTER YOUR MOSQUE` (line 725).
     - Placeholders are `FULL NAME` (line 815), `ADMIN@MOSQUE.ORG` (line 828), and `••••••••••••` (line 842).

---

## 2. Logic Chain

### 2.1 Notification Center Strategy
- **Premise 1**: All backend endpoints (`GET /api/members/notifications`, `PATCH /api/members/notifications/:id/read`, `POST /api/admin/programs/:id/reminders`) are already fully operational and verified by E2E tests.
- **Premise 2**: Users across all 5 roles need access to in-app notifications in real-time.
- **Deduction**: A modular React component `NotificationCenter.tsx` should be placed in the header of the tenant workspace (`/mosque/[slug]/admin`), public portal (`/mosque/[slug]`), and other pages.
- **Component Architecture**:
  1. State: `notifications: Notification[]`, `isOpen: boolean`, `loading: boolean`.
  2. Computation: `unreadCount = notifications.filter(n => !n.is_read).length`.
  3. UI Elements:
     - Bell Icon button with badge displaying `unreadCount` (badge hidden when `unreadCount === 0`).
     - Floating popover / drawer containing:
       - Header: "Notifications" + Unread count + "Mark all as read" button.
       - Notification Items: Message, timestamp (formatted / relative), category badge, unread dot indicator.
       - Click handler on unread item: Dispatches `PATCH /api/members/notifications/${id}/read`, updates item `is_read: true` in state.
       - Click handler on "Mark all as read": Concurrently patches all unread IDs and updates local state.
       - Empty state: "No notifications yet."

### 2.2 Tenant Audit Log Viewer Strategy
- **Premise 1**: `GET /api/admin/audit-events` returns the last 200 `AuditEvent` records for the tenant, with `actor: { name, email }`.
- **Premise 2**: Only `tenant_admin` is authorized to view audit events (returns 403 for other roles).
- **Deduction**: The tenant workspace should provide a dedicated `"Audit Logs"` tab (`tab === 'audit'`), strictly displayed and accessible when `userRole === 'tenant_admin'`.
- **UI Architecture**:
  1. Data Fetching: `api<AuditEvent[]>(slug, '/api/admin/audit-events')`.
  2. Search & Filter Controls:
     - Text filter matching `action`, `summary`, `actor.name`, `actor.email`, `target_type`, `request_id`, or `ip_address`.
     - Dropdown filter by `action` category (`All`, `Program`, `Donation`, `Membership`, `Announcement`, `Mosque`).
     - Dropdown filter by `target_type`.
  3. Tabular / Card Layout:
     - Columns: `Timestamp`, `Actor`, `Action`, `Target`, `Summary`, `Request ID`, `IP Address`.
     - Action Badge with color styling based on action type (green for creation, amber for mutation/reconciliation, red for deletions, blue for exports).
     - Monospace font for `request_id` and `ip_address`.
     - Clickable row / expandable drawer to inspect full event details for compliance auditing.

### 2.3 Role-Based Navigation Strategy
- **Premise 1**: MasjidHub defines 5 distinct tenant-local roles with explicit privilege boundaries.
- **Premise 2**: Showing unauthorized tabs degrades UX and generates 403 errors.
- **Deduction**: The workspace navigation must dynamically render only the tabs permitted for the authenticated user's role.
- **Implementation Mapping**:
  ```ts
  export type TenantRole = 'tenant_admin' | 'finance_officer' | 'programme_officer' | 'communications_officer' | 'member';

  export const ROLE_NAVIGATION_MAP: Record<TenantRole, Array<{ id: string; label: string }>> = {
    tenant_admin: [
      { id: 'overview', label: 'Overview' },
      { id: 'announcements', label: 'Announcements' },
      { id: 'programs', label: 'Programmes' },
      { id: 'donations', label: 'Donations & Treasury' },
      { id: 'members', label: 'People & Roles' },
      { id: 'audit', label: 'Audit Logs' },
      { id: 'settings', label: 'Mosque Settings' }
    ],
    finance_officer: [
      { id: 'overview', label: 'Overview' },
      { id: 'donations', label: 'Donations & Treasury' }
    ],
    programme_officer: [
      { id: 'overview', label: 'Overview' },
      { id: 'programs', label: 'Programmes' }
    ],
    communications_officer: [
      { id: 'overview', label: 'Overview' },
      { id: 'announcements', label: 'Announcements' }
    ],
    member: []
  };
  ```
- **Workspace Navigation Logic**:
  - Fetch user role from `GET /api/auth/me` (or stored session membership).
  - Compute `allowedTabs = ROLE_NAVIGATION_MAP[userRole]`.
  - If current `tab` is not allowed, auto-select `allowedTabs[0].id`.
  - If user is `member`, redirect to public portal (`/mosque/${slug}`).

### 2.4 Frontend Test Environment Fix Strategy
- **Premise 1**: Vitest runs tests in JSDOM, where `IntersectionObserver` is undefined unless polyfilled or mocked.
- **Premise 2**: `src/app/page.tsx` directly calls `new IntersectionObserver(...)`.
- **Deduction**:
  1. Add a conditional check in `src/app/page.tsx` ensuring `typeof IntersectionObserver !== 'undefined'` before running the effect.
  2. Create a global test setup file `frontend/vitest.setup.ts` mocking `IntersectionObserver`.
  3. Register `setupFiles: ['./vitest.setup.ts']` in `frontend/vitest.config.ts`.
  4. Harmonize placeholder and button queries between `src/app/page.tsx` and `landing.test.tsx`.

---

## 3. Caveats

1. **Session Hydration**: When a user navigates directly to `/mosque/[slug]/admin`, if the browser is using HTTP-only cookies (`mh_session`), `getToken(slug)` from localStorage may be null while the session cookie is valid. The frontend workspace should invoke `GET /api/auth/me` with `credentials: 'include'` to resolve user identity and membership role.
2. **Bulk Mark As Read**: The backend currently implements single-notification updates (`PATCH /api/members/notifications/:id/read`). The frontend "Mark all as read" should issue concurrent requests (`Promise.all`) or update state optimistically while notifying the backend.
3. **Audit Log Volume**: Backend returns the last 200 events (`take: 200`). Pagination or date range filtering can be added if tenants require deeper historical query capabilities in future iterations.

---

## 4. Conclusion & Actionable Implementation Plan

### 4.1 Exact Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `frontend/src/components/NotificationCenter.tsx` | **CREATE** | Reusable notification dropdown / drawer with unread badge, individual mark read, and mark all read |
| `frontend/src/app/mosque/[slug]/admin/page.tsx` | **MODIFY** | Implement dynamic RBAC navigation tabs (5 roles), integrate `NotificationCenter`, and add dedicated `Audit Logs` viewer tab |
| `frontend/src/app/mosque/[slug]/page.tsx` | **MODIFY** | Embed `NotificationCenter` in public portal header for authenticated members |
| `frontend/src/lib/api.ts` | **MODIFY** | Add typed helper functions for notification operations and auth session resolution |
| `frontend/src/app/page.tsx` | **MODIFY** | Add `IntersectionObserver` guard, align registration modal placeholders and button labels |
| `frontend/vitest.setup.ts` | **CREATE** | Global Vitest setup file mocking `IntersectionObserver` in JSDOM |
| `frontend/vitest.config.ts` | **MODIFY** | Add `setupFiles: ['./vitest.setup.ts']` |
| `frontend/__tests__/current/landing.test.tsx` | **MODIFY** | Ensure robust regex / accessible query matchers |

---

### 4.2 Detailed Code Blueprints

#### Blueprint 1: `frontend/src/components/NotificationCenter.tsx`
```tsx
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';

export interface Notification {
  notif_id: number;
  message: string;
  type: string;
  status: string;
  related_type?: string | null;
  related_id?: number | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationCenterProps {
  slug: string;
}

export default function NotificationCenter({ slug }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function fetchNotifications() {
    try {
      setLoading(true);
      const data = await api<Notification[]>(slug, '/api/members/notifications');
      setNotifications(data);
    } catch {
      // Graceful fallback for non-member / unauthenticated
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, [slug]);

  // Click-outside listener to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function markAsRead(notifId: number) {
    try {
      await api(slug, `/api/members/notifications/${notifId}/read`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => (n.notif_id === notifId ? { ...n, is_read: true } : n))
      );
    } catch (e) {
      console.error('Failed to mark notification as read', e);
    }
  }

  async function markAllAsRead() {
    const unread = notifications.filter((n) => !n.is_read);
    if (unread.length === 0) return;

    // Optimistic UI update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

    await Promise.allSettled(
      unread.map((n) =>
        api(slug, `/api/members/notifications/${n.notif_id}/read`, { method: 'PATCH' })
      )
    );
  }

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Button with Badge */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications (${unreadCount} unread)`}
        className="relative p-2 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-full border-2 border-white dark:border-slate-900 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {loading && notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">Loading notifications…</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No notifications in your inbox.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.notif_id}
                  onClick={() => !notif.is_read && markAsRead(notif.notif_id)}
                  className={`p-4 transition-colors cursor-pointer flex items-start space-x-3 ${
                    notif.is_read
                      ? 'bg-white dark:bg-slate-900 opacity-75 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      : 'bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                  }`}
                >
                  <span
                    className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                      notif.is_read ? 'bg-transparent' : 'bg-emerald-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        {notif.type}
                      </span>
                      <time className="text-[10px] text-slate-400">
                        {new Date(notif.created_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </time>
                    </div>
                    <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed break-words">
                      {notif.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

#### Blueprint 2: Tenant Audit Log Viewer & RBAC Navigation in `frontend/src/app/mosque/[slug]/admin/page.tsx`
```tsx
// Role mapping definition
type Tab = 'overview' | 'announcements' | 'programs' | 'donations' | 'members' | 'audit' | 'settings';
type Role = 'tenant_admin' | 'finance_officer' | 'programme_officer' | 'communications_officer' | 'member';

interface AuditEvent {
  audit_id: number;
  mosque_id?: number;
  actor_id?: number;
  action: string;
  target_type: string;
  target_id?: string | null;
  summary: string;
  request_id?: string | null;
  ip_address?: string | null;
  created_at: string;
  actor?: { name: string; email: string } | null;
}

const TAB_PERMISSIONS: Record<Tab, { label: string; roles: Role[] }> = {
  overview: { label: 'Overview', roles: ['tenant_admin', 'finance_officer', 'programme_officer', 'communications_officer'] },
  announcements: { label: 'Announcements', roles: ['tenant_admin', 'communications_officer'] },
  programs: { label: 'Programmes', roles: ['tenant_admin', 'programme_officer'] },
  donations: { label: 'Donations & Treasury', roles: ['tenant_admin', 'finance_officer'] },
  members: { label: 'People & Roles', roles: ['tenant_admin'] },
  audit: { label: 'Audit Logs', roles: ['tenant_admin'] },
  settings: { label: 'Mosque Settings', roles: ['tenant_admin'] },
};
```

---

#### Blueprint 3: `frontend/vitest.setup.ts` & `frontend/src/app/page.tsx`
```ts
// frontend/vitest.setup.ts
import { vi } from 'vitest';

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});
```

And in `frontend/src/app/page.tsx`:
```tsx
useEffect(() => {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;
  const observerCallback: IntersectionObserverCallback = (entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  };

  const observer = new IntersectionObserver(observerCallback, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px',
  });

  const elements = document.querySelectorAll('.reveal-up');
  elements.forEach((el) => observer.observe(el));

  return () => observer.disconnect();
}, [mosques]);
```

---

## 5. Verification Method

To verify these implementations once coded:

1. **Frontend Unit & Logic Verification**:
   ```bash
   # Run frontend Vitest suite
   npm --prefix frontend run test
   ```
   *Expected*: Passes with 0 failures and 0 `IntersectionObserver` reference errors.

2. **Frontend Standalone Interactive Logic**:
   ```bash
   npm --prefix frontend run test:node
   ```
   *Expected*: Passes all test suites.

3. **Backend Multi-Tenant E2E Tests**:
   ```bash
   # Run E2E test suites for Notification Center (F13), Audit Log (F14), and RBAC (F15)
   npm --prefix backend run test:e2e
   ```
   *Expected*: 100% pass rate across all 20 features and 4 tiers.

4. **Full Logic Test Command**:
   ```bash
   npm run test:logic
   ```

5. **Invalidation Conditions**:
   - If `npm --prefix frontend run test` throws JSDOM reference errors.
   - If a `finance_officer` is presented with the `Audit Logs` tab.
   - If `GET /api/members/notifications` returns cross-tenant or other users' notifications.
