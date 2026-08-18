# Milestone 3 Technical Investigation & Architecture Specification: Programme Lifecycle & Attendee Check-In

**Agent**: `m3_explorer_1`  
**Date**: 2026-08-16  
**Scope**: Programme Lifecycle Management & Attendee Attendance Check-In / Reminders (Features 9 & 10 from `PROJECT.md` & `ORIGINAL_REQUEST.md`)

---

## 1. Observation

Direct code observations across backend and frontend repositories:

### 1.1 Backend Database Models (`backend/prisma/schema.prisma`)
- **`Program` Model** (lines 115–135):
  ```prisma
  model Program {
    program_id               Int            @id @default(autoincrement())
    mosque_id                Int
    title                    String
    description              String
    category                 String         @default("General")
    start_date               DateTime
    end_date                 DateTime
    location                 String
    max_capacity             Int            @default(0) // 0 indicates open/unlimited
    visibility               String         @default("Public") // Public | Members
    status                   String         @default("Published") // Draft | Published | Cancelled | Completed
    created_at               DateTime       @default(now())
    updated_at               DateTime       @updatedAt

    mosque                   Mosque         @relation(fields: [mosque_id], references: [mosque_id], onDelete: Cascade)
    registrations           Registration[]

    @@unique([mosque_id, program_id])
    @@index([mosque_id, start_date])
  }
  ```
- **`Registration` Model** (lines 137–152):
  ```prisma
  model Registration {
    reg_id                    Int            @id @default(autoincrement())
    mosque_id                Int
    user_id                  Int
    program_id               Int
    reg_date                 DateTime       @default(now())
    status                   String         @default("Registered") // Registered | Attended | Cancelled
    attended_at              DateTime?

    mosque                   Mosque         @relation(fields: [mosque_id], references: [mosque_id], onDelete: Cascade)
    user                     User           @relation(fields: [user_id], references: [user_id], onDelete: Cascade)
    program                  Program        @relation(fields: [mosque_id, program_id], references: [mosque_id, program_id], onDelete: Cascade)

    @@unique([mosque_id, user_id, program_id])
    @@index([mosque_id, program_id, status])
  }
  ```
- **`Notification` Model** (lines 154–171):
  Fields include `notif_id`, `mosque_id`, `user_id`, `message`, `type`, `status` (`Queued` | `Sent`), `related_type` (`Program`), `related_id` (`program_id`), `is_read`, `sent_at`.

### 1.2 Backend API Routes & Schemas
- **`backend/src/routes/programs.ts`**:
  - `GET /api/programs` (lines 26–37): Public endpoint returning published, public programs for tenant.
  - `POST /api/admin/programs` (lines 40–72): Validated by `createProgramSchema`, protected by `fastify.requireMembership(['tenant_admin', 'programme_officer'])`. Creates program, creates audit event `program.created`, returns HTTP 201.
  - `PUT /api/admin/programs/:id` (lines 75–120): Validated by `updateProgramSchema`, protected by `fastify.requireMembership(['tenant_admin', 'programme_officer'])`. Updates mutable fields, verifies tenant boundary, creates audit event `program.updated`, returns HTTP 200.
  - `DELETE /api/admin/programs/:id` (lines 123–157): Validated by `programIdParamSchema`, protected by `fastify.requireMembership(['tenant_admin', 'programme_officer'])`. Verifies tenant boundary, deletes program, creates audit event `program.deleted`, returns `{ success: true, message: ... }`.

- **`backend/src/routes/registrations.ts`**:
  - `POST /api/programs/:id/register` (lines 12–42): Handles capacity enforcement (`occupied >= max_capacity` returns HTTP 409 `CAPACITY_FULL`), records audit `registration.created`.
  - `GET /api/admin/programs/:id/registrations` (lines 64–72): Protected by `['tenant_admin', 'programme_officer']`. Returns attendee list including `{ user: { user_id, name, email, phone } }`.
  - `PATCH /api/admin/registrations/:id/attendance` (lines 74–84):
    ```typescript
    fastify.patch('/api/admin/registrations/:id/attendance', {
      schema: attendanceCheckInSchema,
      preHandler: [fastify.requireMembership(['tenant_admin', 'programme_officer'])]
    }, async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      const registration = await fastify.prisma.registration.findFirst({ where: { reg_id: id, mosque_id: request.tenant.mosque_id } });
      if (!registration) return reply.status(404).send({ error: 'Registration not found.' });
      const updated = await fastify.prisma.registration.update({ where: { reg_id: id }, data: { status: 'Attended', attended_at: new Date() } });
      await fastify.audit(request, 'attendance.recorded', 'Registration', id, 'Programme attendance recorded.');
      reply.send(updated);
    });
    ```
    *Observed gap*: Hardcodes `status: 'Attended'`, ignoring incoming `request.body.status` (which `attendanceCheckInSchema` allows as enum `['Attended', 'Registered', 'Cancelled']`).

- **`backend/src/routes/notifications.ts`**:
  - `POST /api/admin/programs/:id/reminders` (lines 28–54): Protected by `['tenant_admin', 'programme_officer']`. Finds all registrations where `status == 'Registered'`, creates `Notification` rows for each attendee, records audit event `program.reminders_sent`, returns `{ sent: number }`.

### 1.3 Frontend Workspace (`frontend/src/app/mosque/[slug]/admin/page.tsx`)
- Current tab list (lines 8, 33):
  `type Tab = 'announcements' | 'members' | 'donations' | 'settings';`
  `const nav: Array<[Tab,string]> = [['announcements','Announcements'],['members','People & roles'],['donations','Donations'],['settings','Mosque settings']];`
- *Observed gap*: The admin workspace lacks a `programs` tab, program creation/editing forms, capacity controls, attendee roster modal/table, check-in action toggles, and reminder dispatch buttons.

### 1.4 Frontend API Client (`frontend/src/lib/api.ts`)
- Features implemented (lines 60–102):
  - Injects `X-Mosque-Slug` header.
  - Injects `Authorization: Bearer <token>`.
  - Automatically fetches and injects `X-CSRF-Token` header on state-changing mutations (`POST`, `PUT`, `PATCH`, `DELETE`).
  - Sets `credentials: 'include'` for cookie sessions (`mh_session`, `mh_csrf`).
  - Robust `ApiError` class with HTTP status code and parsed backend error messages.

---

## 2. Logic Chain

1. **Prisma & Backend Readiness**:
   - The database schema supports `Program` (with `max_capacity`, `visibility`, `status`), `Registration` (with `status: Registered | Attended | Cancelled`, `attended_at`), and `Notification` (with `related_type: 'Program'`).
   - The backend API endpoints for Programme Lifecycle (`POST /api/admin/programs`, `PUT /api/admin/programs/:id`, `DELETE /api/admin/programs/:id`), Attendee Roster (`GET /api/admin/programs/:id/registrations`), and Reminders (`POST /api/admin/programs/:id/reminders`) are implemented, role-restricted, and verified by E2E test suites (`tier1-feature-coverage.test.ts`, `tier2-boundary-corner.test.ts`, `tier3-cross-feature.test.ts`, `tier4-real-world-workflows.test.ts`).

2. **Backend Attendance Check-In Flexibility**:
   - `attendanceCheckInSchema` in `backend/src/schemas/registrations.schema.ts` accepts body `{ status: 'Attended' | 'Registered' | 'Cancelled' }`.
   - In `backend/src/routes/registrations.ts`, updating the handler to read `const targetStatus = (request.body as any)?.status || 'Attended'` allows toggling between `Attended` (with `attended_at = new Date()`) and `Registered` (with `attended_at = null`), which supports real-world door operations when an officer needs to check in or undo check-in.

3. **Admin Programs List Endpoint Enhancement**:
   - Public `GET /api/programs` filters by `status: 'Published', visibility: 'Public'`.
   - Adding `GET /api/admin/programs` (or supporting admin scope) returning all tenant programs with registration counts `_count: { registrations: { where: { status: 'Registered' } } }` allows the admin workspace to manage draft, members-only, completed, and published programs seamlessly.

4. **Frontend Admin Workspace Architecture**:
   - Extending `frontend/src/app/mosque/[slug]/admin/page.tsx` with `'programs'` tab and/or creating modular components in `frontend/src/components/programs/` provides the complete UI required:
     - **Program Creation & Edit Form**: Title, Category, Start/End Datetime, Location, Max Capacity (0 = Unlimited), Visibility (`Public` | `Members`), Status (`Published` | `Draft`).
     - **Program Card / Table View**: Displays all programs, status badges, fill rate (`X / Y seats`), and actions (Edit, Delete, View Roster).
     - **Attendee Roster & Door Check-In**: Table of registered members with contact details, live attendance status badge (`Registered`, `Attended`, `Cancelled`), one-click check-in toggle button calling `PATCH /api/admin/registrations/:id/attendance`.
     - **Dispatch Reminder Action**: Button calling `POST /api/admin/programs/:id/reminders` with instant feedback on notifications queued/sent.
   - All mutations seamlessly leverage `api(slug, path, { method, body })` ensuring credentials and CSRF compliance.

---

## 3. Detailed Technical Blueprint & Implementation Plan

### 3.1 Backend Enhancements

#### File: `backend/src/routes/programs.ts`
Add `GET /api/admin/programs` to retrieve all tenant programmes with registration counts for the admin workspace:
```typescript
// GET /api/admin/programs - Admin endpoint to retrieve all programs with registration counts
fastify.get('/api/admin/programs', {
  preHandler: [fastify.requireMembership(['tenant_admin', 'programme_officer'])]
}, async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const programs = await fastify.prisma.program.findMany({
      where: { mosque_id: request.tenant.mosque_id },
      include: {
        _count: {
          select: {
            registrations: {
              where: { status: { in: ['Registered', 'Attended'] } }
            }
          }
        }
      },
      orderBy: { start_date: 'desc' }
    });
    reply.send(programs);
  } catch (err) {
    fastify.log.error(err);
    reply.status(500).send({ error: 'Failed to fetch admin programs list.' });
  }
});
```

#### File: `backend/src/routes/registrations.ts`
Refine `PATCH /api/admin/registrations/:id/attendance` to support status payload:
```typescript
fastify.patch('/api/admin/registrations/:id/attendance', {
  schema: attendanceCheckInSchema,
  preHandler: [fastify.requireMembership(['tenant_admin', 'programme_officer'])]
}, async (request, reply) => {
  const id = Number((request.params as { id: string }).id);
  const registration = await fastify.prisma.registration.findFirst({
    where: { reg_id: id, mosque_id: request.tenant.mosque_id }
  });
  if (!registration) return reply.status(404).send({ error: 'Registration not found.' });

  const body = (request.body || {}) as { status?: 'Attended' | 'Registered' | 'Cancelled' };
  const targetStatus = body.status || 'Attended';
  const attendedAt = targetStatus === 'Attended' ? new Date() : (targetStatus === 'Registered' ? null : registration.attended_at);

  const updated = await fastify.prisma.registration.update({
    where: { reg_id: id },
    data: {
      status: targetStatus,
      attended_at: attendedAt
    }
  });
  await fastify.audit(request, 'attendance.recorded', 'Registration', id, `Programme attendance set to ${targetStatus}.`);
  reply.send(updated);
});
```

---

### 3.2 Frontend Implementation Strategy

#### File: `frontend/src/app/mosque/[slug]/admin/page.tsx`
Enhance the workspace component with:
1. **Type & State Definitions**:
   ```typescript
   type Tab = 'announcements' | 'programs' | 'members' | 'donations' | 'settings';

   interface Program {
     program_id: number;
     title: string;
     description: string;
     category: string;
     start_date: string;
     end_date: string;
     location: string;
     max_capacity: number;
     visibility: 'Public' | 'Members';
     status: 'Draft' | 'Published' | 'Cancelled' | 'Completed';
     _count?: { registrations: number };
   }

   interface Attendee {
     reg_id: number;
     user_id: number;
     reg_date: string;
     status: 'Registered' | 'Attended' | 'Cancelled';
     attended_at: string | null;
     user: { user_id: number; name: string; email: string; phone?: string | null };
   }
   ```

2. **State Management**:
   - `programs: Program[]`
   - `selectedProgram: Program | null`
   - `roster: Attendee[]`
   - `programForm`: `{ program_id?: number; title: string; description: string; category: string; start_date: string; end_date: string; location: string; max_capacity: number; visibility: 'Public' | 'Members'; status: 'Draft' | 'Published' | 'Cancelled' | 'Completed' }`
   - `isEditing: boolean`
   - `isDispatchingReminders: boolean`

3. **Operations**:
   - `loadPrograms()`: Fetches `/api/admin/programs` (or `/api/programs`).
   - `saveProgram(e: FormEvent)`: Calls `POST /api/admin/programs` (or `PUT /api/admin/programs/:id` if editing).
   - `deleteProgram(id: number)`: Calls `DELETE /api/admin/programs/:id`.
   - `loadRoster(program: Program)`: Fetches `/api/admin/programs/:id/registrations`.
   - `toggleAttendance(regId: number, currentStatus: string)`: Calls `PATCH /api/admin/registrations/:id/attendance` with `{ status: currentStatus === 'Attended' ? 'Registered' : 'Attended' }`.
   - `dispatchReminders(programId: number)`: Calls `POST /api/admin/programs/:id/reminders` and displays count of reminders dispatched.

4. **UI Wireframe Structure**:
   - Navigation: Tabs for Announcements, Programmes & Roster, People & Roles, Donations, Settings.
   - Program Management Panel:
     - Left / Top: Collapsible "Create / Edit Programme" form.
     - Center: Grid / List of programmes with metadata (Category, Dates, Location, Capacity badge, Status).
     - Action buttons on cards: "View Roster & Check-In", "Edit", "Delete".
   - Roster & Check-in Modal or Panel:
     - Header: Programme Title, Start Date, Capacity bar (`X of Y seats occupied`).
     - Top Action: "Dispatch Reminders to Registered Attendees" button.
     - Table:
       - Attendee Name & Contact (Email, Phone)
       - Registration Date
       - Attendance Badge (`Registered` in blue, `Attended` in green with checkmark and timestamp, `Cancelled` in red)
       - Toggle Button: "Check In" (green) / "Undo Check In" (slate/amber).

---

## 4. Exact Files to Modify

| # | File Path | Scope of Modification |
|---|-----------|-----------------------|
| 1 | `backend/src/routes/programs.ts` | Add `GET /api/admin/programs` for admin program retrieval with registration counts. |
| 2 | `backend/src/routes/registrations.ts` | Update `PATCH /api/admin/registrations/:id/attendance` to support dynamic status payload (`Attended`, `Registered`, `Cancelled`). |
| 3 | `frontend/src/app/mosque/[slug]/admin/page.tsx` | Add `'programs'` tab, Programme lifecycle form (create, edit, capacity), programme list, attendee roster viewer, check-in toggle button, and reminder dispatch button. |
| 4 | `frontend/src/components/programs/AdminProgramManager.tsx` *(Optional modular component)* | Extensible modular component for program management and roster check-in if split from `page.tsx`. |

---

## 5. Caveats & Assumptions

1. **Test Suite Compatibility**: All 220+ automated tests across Tiers 1–4 in `backend/test/e2e/` rely on the current route signatures (`/api/admin/programs`, `/api/admin/programs/:id/registrations`, `/api/admin/registrations/:id/attendance`, `/api/admin/programs/:id/reminders`). The proposed additions strictly preserve backward compatibility and adhere to all interface contracts in `PROJECT.md`.
2. **Date Time Parsing**: When binding `datetime-local` inputs in React, ensure standard conversion to and from ISO strings (`new Date(val).toISOString()`) so SQLite and Prisma parse dates accurately without timezone drift.
3. **Capacity Limit Behavior**: `max_capacity: 0` represents open / unlimited capacity as specified in `tier2-boundary-corner.test.ts` (test 9.1). The UI must explicitly indicate "0 for unlimited capacity".

---

## 6. Conclusion

- The backend architecture for Programme Lifecycle Management and Attendee Check-In/Reminders is robust and aligns directly with the authoritative specifications in `ORIGINAL_REQUEST.md` and `PROJECT.md`.
- Minor refinements to `backend/src/routes/registrations.ts` (status payload support) and `backend/src/routes/programs.ts` (`GET /api/admin/programs`) will optimize operational ergonomics.
- The primary deliverable for Milestone 3 is the frontend integration in `frontend/src/app/mosque/[slug]/admin/page.tsx`, providing mosque officers with complete self-service tools to publish programmes, adjust seat limits, view live attendee rosters, execute door check-ins, and broadcast automated reminders.

---

## 7. Verification Method

To independently verify the implementation:

1. **Backend Integration & E2E Test Suite**:
   ```bash
   npm --prefix backend run test:e2e
   ```
   *Expected Outcome*: All 220+ tests pass with 100% success rate, specifically:
   - Tier 1 Tests 9.1–9.5 (`Feature 9: Programme Lifecycle Management`)
   - Tier 1 Tests 10.1–10.5 (`Feature 10: Attendee Check-in & Reminders`)
   - Tier 2 Boundaries 9.1–9.5 and 10.1–10.5
   - Tier 3 Combination Flow 1 (`Program Lifecycle -> Registration -> Checkin -> Reminders -> Audit`)
   - Tier 4 Workflow A (`Jumu'ah & Weekend Operations`)

2. **Logic & Frontend Unit Test Runner**:
   ```bash
   npm run test:logic
   ```
   *Expected Outcome*: Node logic runner succeeds with 0 errors.

3. **TypeScript Build Verification**:
   ```bash
   npm --prefix backend run build
   npm --prefix frontend run build
   ```
   *Expected Outcome*: Compiles cleanly with zero syntax or TypeScript type errors.
