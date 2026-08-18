# Milestone 1 Investigation & Handoff Report

**Target Milestone**: M1 — Versioned Database Migrations & Reproducible Setup (R1)  
**Author**: Explorer Agent (`m1_explorer_1`)  
**Target Recipient**: Worker Agent (`m1_worker_1`) / Orchestrator  
**Date**: 2026-08-16T16:05:00Z  

---

## 1. Observation

### 1.1 Baseline Prisma Schema and Initial Migration
- **File**: `backend/prisma/schema.prisma` (190 lines) defines 9 core models:
  1. `Mosque` (lines 10–35): Multi-tenant root with `mosque_id`, `name`, `slug` (`@unique`), `status`, `brand_color`, `timezone`, `notification_email`, `notification_in_app`, `created_at`, `updated_at`. Unique index: `@@unique([mosque_id, slug])`.
  2. `User` (lines 37–54): Global user credentials with `user_id`, `name`, `email` (`@unique`), `password_hash`, `phone`, `account_status`, `platform_role` (`super_admin`), `created_at`, `updated_at`.
  3. `Membership` (lines 56–69): Tenant-user mapping with `membership_id`, `mosque_id` (FK `Mosque` cascade), `user_id` (FK `User` cascade), `role` (`tenant_admin | finance_officer | programme_officer | communications_officer | member`), `status` (`Active | Suspended`), `joined_at`. Indexes: `@@unique([mosque_id, user_id])`, `@@index([user_id, status])`.
  4. `Donation` (lines 71–93): Financial ledger with `donation_id`, `mosque_id` (FK `Mosque` cascade), `user_id` (FK `User` set null), `amount_minor` (integer cents/kobo), `currency`, `category`, `method` (`Card | Transfer | Cash`), `external_reference`, `status` (`Pending | Completed | Failed`), `reconciliation_status` (`Unreconciled | Reconciled`), `receipt_number` (`@unique`), `recorded_by`, `verified_by`, `date`, `updated_at`. Indexes: `@@index([mosque_id, date])`, `@@index([mosque_id, status, reconciliation_status])`.
  5. `Announcement` (lines 95–113): Tenant notice board with `announcement_id`, `mosque_id` (FK `Mosque` cascade), `author_id` (FK `User` restrict), `title`, `content`, `category`, `audience` (`Public | Members | Staff`), `status` (`Draft | Scheduled | Published | Archived`), `publish_at`, `posted_at`, `expiry_date`, `updated_at`. Index: `@@index([mosque_id, status, publish_at])`.
  6. `Program` (lines 115–135): Events and courses with `program_id`, `mosque_id` (FK `Mosque` cascade), `title`, `description`, `category`, `start_date`, `end_date`, `location`, `max_capacity` (0 = unlimited), `visibility` (`Public | Members`), `status` (`Draft | Published | Cancelled | Completed`), `created_at`, `updated_at`. Indexes: `@@unique([mosque_id, program_id])`, `@@index([mosque_id, start_date])`.
  7. `Registration` (lines 137–152): Attendance tracking with `reg_id`, `mosque_id` (FK `Mosque` cascade), `user_id` (FK `User` cascade), `program_id` (FK `Program` `[mosque_id, program_id]` cascade), `reg_date`, `status` (`Registered | Attended | Cancelled`), `attended_at`. Indexes: `@@unique([mosque_id, user_id, program_id])`, `@@index([mosque_id, program_id, status])`.
  8. `Notification` (lines 154–171): In-app notifications with `notif_id`, `mosque_id` (FK `Mosque` cascade), `user_id` (FK `User` cascade), `message`, `type`, `status` (`Queued | Sent | Failed`), `related_type`, `related_id`, `is_read`, `sent_at`, `created_at`. Index: `@@index([mosque_id, user_id, created_at])`.
  9. `AuditEvent` (lines 173–189): Structured audit log with `audit_id`, `mosque_id` (FK `Mosque` set null), `actor_id` (FK `User` set null), `action`, `target_type`, `target_id`, `summary`, `request_id`, `ip_address`, `created_at`. Index: `@@index([mosque_id, created_at])`.

- **File**: `backend/prisma/migrations/20250101000000_initial/migration.sql` (193 lines) and `backend/prisma/migrations/migration_lock.toml` (provider = "sqlite"):
  - Contains complete, executable DDL matching the 9 tables, foreign key constraints (`ON DELETE CASCADE`, `ON DELETE SET NULL`, `ON DELETE RESTRICT`), and all 13 primary/unique/composite indexes.
  - Parity check between `schema.prisma` and `migration.sql` is 100% congruent.

### 1.2 Database Scripts in `backend/package.json`
- `backend/package.json` (lines 12–16) defines:
  - `"db:migrate": "prisma migrate deploy"`
  - `"db:generate": "prisma generate"`
  - `"db:seed": "tsx prisma/seed.ts"`
  - `"db:setup": "npm run db:migrate && npm run db:generate && npm run db:seed"`
  - `"db:reset:demo": "prisma migrate reset --force"`

### 1.3 Gaps in Existing `backend/prisma/seed.ts`
- **File**: `backend/prisma/seed.ts` (50 lines):
  - Currently seeds only `platformAdmin`, 2 mosques (`al-noor`, `al-huda`), and 3 users (`ahmad` -> `tenant_admin`, `ali` -> `member`, `yusuf` -> `tenant_admin`).
  - **Missing Roles**:
    - `finance_officer` (e.g. `finance@alnoor.org`)
    - `programme_officer` (e.g. `programs@alnoor.org`)
    - `communications_officer` (e.g. `comms@alnoor.org`)
  - **Missing Multi-tenant Records**:
    - Only 1 donation (online completed); no unreconciled vs reconciled variety, no offline cash donations, no `verified_by` or `recorded_by`.
    - Only 1 program and 1 registration; no attended check-in status (`status: 'Attended'`, `attended_at`).
    - 0 `Notification` records seeded.
    - Only 1 platform `AuditEvent` record; no tenant-level audit records (`program.created`, `donation.reconciled`, `donation.recorded`, `attendance.recorded`).
    - Only 2 mosques; missing a 3rd active tenant (e.g. `al-iman`) required for comprehensive M4 adversarial 3-tenant isolation testing.

---

## 2. Logic Chain

1. **Step 1 — Baseline Migration Verification**:
   - `backend/prisma/schema.prisma` matches `backend/prisma/migrations/20250101000000_initial/migration.sql` exactly.
   - `prisma migrate deploy` applies this versioned baseline migration without relying on unversioned `prisma db push`.
   - Running `npm --prefix backend run db:migrate` against a clean database initializes all 9 tables, foreign keys, and indexes cleanly.

2. **Step 2 — Seed Script Idempotency & Clean Teardown**:
   - Deleting database entities at the start of `seed.ts` in reverse dependency order (`auditEvent` -> `notification` -> `registration` -> `donation` -> `announcement` -> `program` -> `membership` -> `user` -> `mosque`) prevents foreign key constraint violations during repeated seed executions.
   - Using `Promise.all` with `bcrypt.hash` generates bcrypt password hashes efficiently without slowing down test runners or seed initialization.

3. **Step 3 — Comprehensive 5-Role Coverage & Test Credentials**:
   - Every tenant officer role in Fastify route authorization (`fastify.requireMembership(['tenant_admin', 'finance_officer', 'programme_officer', 'communications_officer'])`) needs a pre-seeded account to enable instantaneous testing and UI verification:
     - `tenant_admin`: `ahmad@alnoor.org` / `adminPass123` (Al-Noor), `yusuf@alhuda.org` / `adminPass123` (Al-Huda), `omar@aliman.org` / `adminPass123` (Al-Iman)
     - `finance_officer`: `finance@alnoor.org` / `financePass123` (Al-Noor)
     - `programme_officer`: `programs@alnoor.org` / `programPass123` (Al-Noor)
     - `communications_officer`: `comms@alnoor.org` / `commsPass123` (Al-Noor)
     - `member`: `ali@example.org` / `memberPass123` (Al-Noor + Al-Huda global multi-mosque user), `zayd@example.org` / `memberPass123` (Al-Noor)
     - `super_admin`: `platform@masjidhub.local` / `platformPass123`

4. **Step 4 — Realistic Demonstration Dataset**:
   - Programs: Tajweed course (upcoming, capacity 30), Youth Workshop (upcoming, capacity 20), Health & First Aid (completed, capacity 50).
   - Registrations: Active registered seats + attended seats (`status: 'Attended'`, `attended_at` timestamp).
   - Donations: Unreconciled online transfer (`MH-SEED-001`), reconciled online card (`MH-SEED-002`, `verified_by: financeOfficer`), unreconciled offline cash (`MH-SEED-003`, `recorded_by: financeOfficer`), anonymous online waqf (`MH-SEED-004`), Al-Huda online donation (`MH-SEED-005`).
   - In-app Notifications: Welcome messages, Tajweed program reminders, donation receipt notifications, offline cash audit alerts.
   - Structured Audit Events: Platform activation, programme creation, donation recording, donation reconciliation, announcement creation, attendee check-in.

---

## 3. Caveats

- `bcrypt` work factor is set to 10 in seed for fast generation while maintaining standard bcrypt format compatibility.
- The default SQLite database file is located at `backend/prisma/masjidhub.db` (configured via `url = "file:./masjidhub.db"` or `process.env.DATABASE_URL`).
- The standalone runner `backend/test/standalone_runner.js` uses an in-memory mock database and does not read `masjidhub.db`; integration tests (`backend/test/current/platform.integration.test.ts`) connect to the Prisma client directly.

---

## 4. Conclusion & Concrete Implementation Plan

The baseline SQLite migration is already complete, versioned, and valid.
The only code change required for Milestone 1 is updating `backend/prisma/seed.ts` to implement full 5-role seeding across 3 tenants with complete demo records.

### Proposed Code for `backend/prisma/seed.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient(
  process.env.DATABASE_URL
    ? { datasources: { db: { url: process.env.DATABASE_URL } } }
    : undefined
);

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Clean existing records in reverse dependency order for idempotency
  await prisma.auditEvent.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.program.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.donation.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.mosque.deleteMany();

  // 2. Pre-hash passwords for performance
  const [adminHash, financeHash, programHash, commsHash, memberHash, platformHash] = await Promise.all([
    bcrypt.hash('adminPass123', 10),
    bcrypt.hash('financePass123', 10),
    bcrypt.hash('programPass123', 10),
    bcrypt.hash('commsPass123', 10),
    bcrypt.hash('memberPass123', 10),
    bcrypt.hash('platformPass123', 10)
  ]);

  // 3. Create Platform Super Admin
  const platformAdmin = await prisma.user.create({
    data: {
      name: 'Platform Administrator',
      email: 'platform@masjidhub.local',
      password_hash: platformHash,
      platform_role: 'super_admin'
    }
  });

  // 4. Create Demo Mosques (3 tenants for full multi-tenant isolation testing)
  const alNoor = await prisma.mosque.create({
    data: {
      name: 'Al-Noor Central Masjid',
      slug: 'al-noor',
      status: 'Active',
      address: '123 Islamic Center Ave, Cityville',
      phone: '+2348031234567',
      email: 'contact@alnoormasjid.org',
      brand_color: '#087f5b',
      timezone: 'Africa/Lagos'
    }
  });

  const alHuda = await prisma.mosque.create({
    data: {
      name: 'Masjid Al-Huda',
      slug: 'al-huda',
      status: 'Active',
      address: '456 Guidance Road, Green Valley',
      phone: '+2348039876543',
      email: 'info@alhuda.org',
      brand_color: '#1d4ed8',
      timezone: 'Africa/Lagos'
    }
  });

  const alIman = await prisma.mosque.create({
    data: {
      name: 'Al-Iman Islamic Center',
      slug: 'al-iman',
      status: 'Active',
      address: '789 Peace Blvd, Lakeside',
      phone: '+2348031122334',
      email: 'admin@aliman.org',
      brand_color: '#7c3aed',
      timezone: 'Africa/Lagos'
    }
  });

  // 5. Create Users representing all 5 roles
  const ahmad = await prisma.user.create({
    data: {
      name: 'Imam Ahmad',
      email: 'ahmad@alnoor.org',
      password_hash: adminHash,
      phone: '+2348055555551'
    }
  });

  const yusuf = await prisma.user.create({
    data: {
      name: 'Imam Yusuf',
      email: 'yusuf@alhuda.org',
      password_hash: adminHash,
      phone: '+2348055555552'
    }
  });

  const omar = await prisma.user.create({
    data: {
      name: 'Imam Omar',
      email: 'omar@aliman.org',
      password_hash: adminHash,
      phone: '+2348055555553'
    }
  });

  const financeOfficer = await prisma.user.create({
    data: {
      name: 'Fatima Finance',
      email: 'finance@alnoor.org',
      password_hash: financeHash,
      phone: '+2348055555554'
    }
  });

  const programOfficer = await prisma.user.create({
    data: {
      name: 'Tariq Programs',
      email: 'programs@alnoor.org',
      password_hash: programHash,
      phone: '+2348055555555'
    }
  });

  const commsOfficer = await prisma.user.create({
    data: {
      name: 'Zainab Comms',
      email: 'comms@alnoor.org',
      password_hash: commsHash,
      phone: '+2348055555556'
    }
  });

  const ali = await prisma.user.create({
    data: {
      name: 'Ali Bello',
      email: 'ali@example.org',
      password_hash: memberHash,
      phone: '+2348055555557'
    }
  });

  const zayd = await prisma.user.create({
    data: {
      name: 'Zayd Ibrahim',
      email: 'zayd@example.org',
      password_hash: memberHash,
      phone: '+2348055555558'
    }
  });

  // 6. Create Memberships mapping all 5 roles across tenants
  await prisma.membership.createMany({
    data: [
      // Al-Noor Memberships (Complete 5-role coverage)
      { mosque_id: alNoor.mosque_id, user_id: ahmad.user_id, role: 'tenant_admin', status: 'Active' },
      { mosque_id: alNoor.mosque_id, user_id: financeOfficer.user_id, role: 'finance_officer', status: 'Active' },
      { mosque_id: alNoor.mosque_id, user_id: programOfficer.user_id, role: 'programme_officer', status: 'Active' },
      { mosque_id: alNoor.mosque_id, user_id: commsOfficer.user_id, role: 'communications_officer', status: 'Active' },
      { mosque_id: alNoor.mosque_id, user_id: ali.user_id, role: 'member', status: 'Active' },
      { mosque_id: alNoor.mosque_id, user_id: zayd.user_id, role: 'member', status: 'Active' },

      // Al-Huda Memberships (Admin + Multi-mosque Member)
      { mosque_id: alHuda.mosque_id, user_id: yusuf.user_id, role: 'tenant_admin', status: 'Active' },
      { mosque_id: alHuda.mosque_id, user_id: ali.user_id, role: 'member', status: 'Active' },

      // Al-Iman Memberships (Admin for Tenant 3)
      { mosque_id: alIman.mosque_id, user_id: omar.user_id, role: 'tenant_admin', status: 'Active' }
    ]
  });

  // 7. Create Announcements
  await prisma.announcement.createMany({
    data: [
      {
        mosque_id: alNoor.mosque_id,
        author_id: ahmad.user_id,
        title: 'Community food drive',
        content: 'Bring shelf-stable food to the collection point before Friday prayer.',
        category: 'Event',
        audience: 'Public',
        status: 'Published'
      },
      {
        mosque_id: alNoor.mosque_id,
        author_id: commsOfficer.user_id,
        title: 'Weekly Tajweed class',
        content: 'The class meets every Saturday after Asr in the learning hall.',
        category: 'Event',
        audience: 'Public',
        status: 'Published'
      },
      {
        mosque_id: alNoor.mosque_id,
        author_id: commsOfficer.user_id,
        title: 'Ramadan Volunteer Orientation',
        content: 'Orientation session for all registered volunteers will take place this Sunday.',
        category: 'General',
        audience: 'Members',
        status: 'Published'
      },
      {
        mosque_id: alHuda.mosque_id,
        author_id: yusuf.user_id,
        title: 'Updated prayer timetable',
        content: 'The new monthly timetable is available from the mosque office.',
        category: 'General',
        audience: 'Public',
        status: 'Published'
      },
      {
        mosque_id: alIman.mosque_id,
        author_id: omar.user_id,
        title: 'Welcome to Al-Iman Center',
        content: 'Daily congregational prayers and weekend learning circles are open to everyone.',
        category: 'General',
        audience: 'Public',
        status: 'Published'
      }
    ]
  });

  // 8. Create Programmes
  const tajweedProg = await prisma.program.create({
    data: {
      mosque_id: alNoor.mosque_id,
      title: 'Foundations of Tajweed',
      description: 'A four-week practical course for adult learners.',
      category: 'General',
      start_date: new Date('2026-09-05T16:00:00Z'),
      end_date: new Date('2026-09-26T18:00:00Z'),
      location: 'Learning Hall',
      max_capacity: 30,
      visibility: 'Public',
      status: 'Published'
    }
  });

  const youthProg = await prisma.program.create({
    data: {
      mosque_id: alNoor.mosque_id,
      title: 'Youth Leadership & Mentorship Workshop',
      description: 'Interactive skills development workshop for teenagers and young adults.',
      category: 'Workshop',
      start_date: new Date('2026-10-10T10:00:00Z'),
      end_date: new Date('2026-10-10T15:00:00Z'),
      location: 'Conference Room B',
      max_capacity: 20,
      visibility: 'Public',
      status: 'Published'
    }
  });

  const healthProg = await prisma.program.create({
    data: {
      mosque_id: alNoor.mosque_id,
      title: 'Community Health & CPR Seminar',
      description: 'Certified basic first aid and emergency response training.',
      category: 'Health',
      start_date: new Date('2026-08-01T09:00:00Z'),
      end_date: new Date('2026-08-01T12:00:00Z'),
      location: 'Main Hall',
      max_capacity: 50,
      visibility: 'Public',
      status: 'Completed'
    }
  });

  const familyProgHuda = await prisma.program.create({
    data: {
      mosque_id: alHuda.mosque_id,
      title: 'Family & Parenting in Islam',
      description: 'Navigating contemporary challenges in Islamic parenting.',
      category: 'Seminar',
      start_date: new Date('2026-09-20T14:00:00Z'),
      end_date: new Date('2026-09-20T17:00:00Z'),
      location: 'Auditorium',
      max_capacity: 40,
      visibility: 'Public',
      status: 'Published'
    }
  });

  // 9. Create Registrations & Attendance
  await prisma.registration.createMany({
    data: [
      {
        mosque_id: alNoor.mosque_id,
        user_id: ali.user_id,
        program_id: tajweedProg.program_id,
        status: 'Registered',
        reg_date: new Date('2026-08-15T10:00:00Z')
      },
      {
        mosque_id: alNoor.mosque_id,
        user_id: zayd.user_id,
        program_id: tajweedProg.program_id,
        status: 'Registered',
        reg_date: new Date('2026-08-15T11:30:00Z')
      },
      {
        mosque_id: alNoor.mosque_id,
        user_id: ali.user_id,
        program_id: healthProg.program_id,
        status: 'Attended',
        attended_at: new Date('2026-08-01T09:15:00Z'),
        reg_date: new Date('2026-07-25T12:00:00Z')
      },
      {
        mosque_id: alHuda.mosque_id,
        user_id: ali.user_id,
        program_id: familyProgHuda.program_id,
        status: 'Registered',
        reg_date: new Date('2026-08-14T09:00:00Z')
      }
    ]
  });

  // 10. Create Donations (Online, Offline Cash, Reconciled, Unreconciled)
  const donation1 = await prisma.donation.create({
    data: {
      mosque_id: alNoor.mosque_id,
      user_id: ali.user_id,
      amount_minor: 2500000, // 25,000 NGN
      currency: 'NGN',
      category: 'Sadaqah',
      method: 'Transfer',
      status: 'Completed',
      reconciliation_status: 'Unreconciled',
      receipt_number: 'MH-SEED-001',
      date: new Date('2026-08-10T11:00:00Z')
    }
  });

  const donation2 = await prisma.donation.create({
    data: {
      mosque_id: alNoor.mosque_id,
      user_id: ali.user_id,
      amount_minor: 10000000, // 100,000 NGN
      currency: 'NGN',
      category: 'Zakat',
      method: 'Card',
      status: 'Completed',
      reconciliation_status: 'Reconciled',
      verified_by: financeOfficer.user_id,
      receipt_number: 'MH-SEED-002',
      date: new Date('2026-08-05T14:30:00Z')
    }
  });

  const donation3 = await prisma.donation.create({
    data: {
      mosque_id: alNoor.mosque_id,
      user_id: zayd.user_id,
      amount_minor: 1500000, // 15,000 NGN
      currency: 'NGN',
      category: 'General',
      method: 'Cash',
      status: 'Completed',
      reconciliation_status: 'Unreconciled',
      recorded_by: financeOfficer.user_id,
      receipt_number: 'MH-SEED-003',
      date: new Date('2026-08-12T16:00:00Z')
    }
  });

  const donation4 = await prisma.donation.create({
    data: {
      mosque_id: alNoor.mosque_id,
      user_id: null, // Anonymous donation
      amount_minor: 5000000, // 50,000 NGN
      currency: 'NGN',
      category: 'Waqf',
      method: 'Transfer',
      status: 'Completed',
      reconciliation_status: 'Unreconciled',
      receipt_number: 'MH-SEED-004',
      date: new Date('2026-08-14T08:45:00Z')
    }
  });

  const donation5 = await prisma.donation.create({
    data: {
      mosque_id: alHuda.mosque_id,
      user_id: ali.user_id,
      amount_minor: 3000000, // 30,000 NGN
      currency: 'NGN',
      category: 'Sadaqah',
      method: 'Card',
      status: 'Completed',
      reconciliation_status: 'Reconciled',
      receipt_number: 'MH-SEED-005',
      date: new Date('2026-08-11T13:15:00Z')
    }
  });

  // 11. Create In-App Notifications
  await prisma.notification.createMany({
    data: [
      {
        mosque_id: alNoor.mosque_id,
        user_id: ali.user_id,
        message: 'Welcome to Al-Noor Central Masjid! Your membership is active.',
        type: 'In-App',
        status: 'Sent',
        is_read: true,
        created_at: new Date('2026-08-01T10:00:00Z'),
        sent_at: new Date('2026-08-01T10:00:00Z')
      },
      {
        mosque_id: alNoor.mosque_id,
        user_id: ali.user_id,
        message: 'Reminder: Foundations of Tajweed starts Saturday at 16:00.',
        type: 'In-App',
        status: 'Sent',
        is_read: false,
        related_type: 'Program',
        related_id: tajweedProg.program_id,
        created_at: new Date('2026-08-15T09:00:00Z'),
        sent_at: new Date('2026-08-15T09:00:00Z')
      },
      {
        mosque_id: alNoor.mosque_id,
        user_id: ali.user_id,
        message: 'Donation receipt MH-SEED-001 has been issued for your Sadaqah contribution.',
        type: 'In-App',
        status: 'Sent',
        is_read: false,
        related_type: 'Donation',
        related_id: donation1.donation_id,
        created_at: new Date('2026-08-10T11:05:00Z'),
        sent_at: new Date('2026-08-10T11:05:00Z')
      },
      {
        mosque_id: alNoor.mosque_id,
        user_id: financeOfficer.user_id,
        message: 'New offline cash donation (MH-SEED-003) recorded and ready for reconciliation.',
        type: 'In-App',
        status: 'Sent',
        is_read: false,
        related_type: 'Donation',
        related_id: donation3.donation_id,
        created_at: new Date('2026-08-12T16:05:00Z'),
        sent_at: new Date('2026-08-12T16:05:00Z')
      },
      {
        mosque_id: alHuda.mosque_id,
        user_id: ali.user_id,
        message: 'Your registration for Family & Parenting in Islam is confirmed.',
        type: 'In-App',
        status: 'Sent',
        is_read: false,
        related_type: 'Program',
        related_id: familyProgHuda.program_id,
        created_at: new Date('2026-08-14T09:05:00Z'),
        sent_at: new Date('2026-08-14T09:05:00Z')
      }
    ]
  });

  // 12. Create Structured Audit Events
  await prisma.auditEvent.createMany({
    data: [
      {
        actor_id: platformAdmin.user_id,
        action: 'seed.completed',
        target_type: 'Platform',
        summary: 'Demonstration environment seeded with 5-role coverage across 3 tenants.',
        created_at: new Date('2026-08-16T12:00:00Z')
      },
      {
        mosque_id: alNoor.mosque_id,
        actor_id: ahmad.user_id,
        action: 'program.created',
        target_type: 'Program',
        target_id: String(tajweedProg.program_id),
        summary: 'Foundations of Tajweed programme created.',
        created_at: new Date('2026-08-02T10:00:00Z')
      },
      {
        mosque_id: alNoor.mosque_id,
        actor_id: financeOfficer.user_id,
        action: 'donation.recorded',
        target_type: 'Donation',
        target_id: String(donation3.donation_id),
        summary: 'Offline cash donation MH-SEED-003 recorded.',
        created_at: new Date('2026-08-12T16:00:00Z')
      },
      {
        mosque_id: alNoor.mosque_id,
        actor_id: financeOfficer.user_id,
        action: 'donation.reconciled',
        target_type: 'Donation',
        target_id: String(donation2.donation_id),
        summary: 'Donation MH-SEED-002 marked as reconciled.',
        created_at: new Date('2026-08-06T09:00:00Z')
      },
      {
        mosque_id: alNoor.mosque_id,
        actor_id: commsOfficer.user_id,
        action: 'announcement.created',
        target_type: 'Announcement',
        summary: 'Announcement published.',
        created_at: new Date('2026-08-03T11:00:00Z')
      },
      {
        mosque_id: alNoor.mosque_id,
        actor_id: programOfficer.user_id,
        action: 'attendance.recorded',
        target_type: 'Registration',
        summary: 'Programme attendance recorded for Ali Bello.',
        created_at: new Date('2026-08-01T09:20:00Z')
      }
    ]
  });

  console.log('✅ Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

---

## 5. Verification Method

To independently verify the Milestone 1 implementation:

1. **Deploy Migrations cleanly**:
   ```bash
   npm --prefix backend run db:migrate
   ```
   *Expected result*: Prisma applies `20250101000000_initial` with 0 errors and creates tables in `masjidhub.db`.

2. **Generate Prisma Client**:
   ```bash
   npm --prefix backend run db:generate
   ```
   *Expected result*: TypeScript client is generated into `node_modules/@prisma/client`.

3. **Run Idempotent Seeding**:
   ```bash
   npm --prefix backend run db:seed
   ```
   *Expected result*: Outputs `🌱 Starting database seed...` followed by `✅ Seeding completed successfully.`.

4. **Verify Idempotency**:
   Re-run the seed script a second time immediately:
   ```bash
   npm --prefix backend run db:seed
   ```
   *Expected result*: Succeeds with 0 unique constraint or foreign key errors.

5. **Run Integration Tests**:
   ```bash
   npm --prefix backend run test
   ```
   *Expected result*: Existing integration tests execute against the seeded database schema without failure.
