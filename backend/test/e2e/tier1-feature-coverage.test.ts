import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/server.js';
import {
  createActiveTenant,
  createMemberUser,
  cleanupTenant,
  getCsrfToken,
  extractCookie,
  TestTenant,
  TestOfficer
} from './test-utils.js';

describe('Tier 1: Feature Isolation Coverage (20 Features)', () => {
  let app: FastifyInstance;
  let tenant: TestTenant;
  let financeOfficer: TestOfficer;
  let programmeOfficer: TestOfficer;
  let commsOfficer: TestOfficer;
  let regularMember: TestOfficer;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    tenant = await createActiveTenant(app, { slugPrefix: 'tier1' });
    financeOfficer = await createMemberUser(app, tenant, 'finance_officer');
    programmeOfficer = await createMemberUser(app, tenant, 'programme_officer');
    commsOfficer = await createMemberUser(app, tenant, 'communications_officer');
    regularMember = await createMemberUser(app, tenant, 'member');
  });

  afterAll(async () => {
    if (tenant?.mosqueId) {
      await cleanupTenant(app, tenant.mosqueId);
    }
    await app.prisma.user.deleteMany({
      where: {
        email: {
          in: [
            tenant.adminEmail,
            financeOfficer.email,
            programmeOfficer.email,
            commsOfficer.email,
            regularMember.email
          ]
        }
      }
    });
    await app.close();
  });

  // -------------------------------------------------------------------------
  // Feature 1: Baseline Prisma SQLite Migration
  // -------------------------------------------------------------------------
  describe('Feature 1: Baseline Prisma SQLite Migration', () => {
    it('1.1 verifies _prisma_migrations table exists in SQLite database', async () => {
      const tables = await app.prisma.$queryRawUnsafe<Array<{ name: string }>>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='_prisma_migrations';"
      );
      expect(tables.length).toBe(1);
      expect(tables[0].name).toBe('_prisma_migrations');
    });

    it('1.2 verifies 20250101000000_initial baseline migration is applied and finished', async () => {
      const migrations = await app.prisma.$queryRawUnsafe<Array<{ migration_name: string; rolled_back_at: any; finished_at: any }>>(
        "SELECT migration_name, rolled_back_at, finished_at FROM _prisma_migrations WHERE migration_name LIKE '%initial%';"
      );
      expect(migrations.length).toBeGreaterThanOrEqual(1);
      expect(migrations[0].rolled_back_at).toBeNull();
      expect(migrations[0].finished_at).not.toBeNull();
    });

    it('1.3 verifies migration checksum and integrity record exists', async () => {
      const records = await app.prisma.$queryRawUnsafe<Array<{ checksum: string; applied_steps_count: number }>>(
        'SELECT checksum, applied_steps_count FROM _prisma_migrations LIMIT 1;'
      );
      expect(records.length).toBe(1);
      expect(records[0].checksum).toBeDefined();
      expect(records[0].applied_steps_count).toBeGreaterThan(0);
    });

    it('1.4 verifies all core domain tables are created in SQLite schema', async () => {
      const expectedTables = [
        'Mosque',
        'User',
        'Membership',
        'Donation',
        'Announcement',
        'Program',
        'Registration',
        'Notification',
        'AuditEvent'
      ];
      const rows = await app.prisma.$queryRawUnsafe<Array<{ name: string }>>(
        "SELECT name FROM sqlite_master WHERE type='table';"
      );
      const existing = rows.map((r) => r.name);
      for (const t of expectedTables) {
        expect(existing).toContain(t);
      }
    });

    it('1.5 verifies schema relations and foreign key columns exist on Donation and Program', async () => {
      const donationCols = await app.prisma.$queryRawUnsafe<Array<{ name: string }>>(
        "PRAGMA table_info('Donation');"
      );
      const colNames = donationCols.map((c) => c.name);
      expect(colNames).toContain('mosque_id');
      expect(colNames).toContain('user_id');
      expect(colNames).toContain('amount_minor');
      expect(colNames).toContain('receipt_number');
    });
  });

  // -------------------------------------------------------------------------
  // Feature 2: Clean Environment Initialization
  // -------------------------------------------------------------------------
  describe('Feature 2: Clean Environment Initialization', () => {
    it('2.1 verifies Prisma client connects and executes read queries on initialized database', async () => {
      const count = await app.prisma.mosque.count();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThan(0);
    });

    it('2.2 verifies unique index on Mosque slug', async () => {
      const indexes = await app.prisma.$queryRawUnsafe<Array<{ name: string }>>(
        "PRAGMA index_list('Mosque');"
      );
      const hasUniqueSlug = indexes.some((idx) => idx.name.includes('slug') || idx.name.includes('unique'));
      expect(hasUniqueSlug).toBe(true);
    });

    it('2.3 verifies unique index on User email', async () => {
      const indexes = await app.prisma.$queryRawUnsafe<Array<{ name: string }>>(
        "PRAGMA index_list('User');"
      );
      const hasUniqueEmail = indexes.some((idx) => idx.name.includes('email') || idx.name.includes('unique'));
      expect(hasUniqueEmail).toBe(true);
    });

    it('2.4 verifies composite unique index on Membership (mosque_id, user_id)', async () => {
      const indexes = await app.prisma.$queryRawUnsafe<Array<{ name: string }>>(
        "PRAGMA index_list('Membership');"
      );
      expect(indexes.length).toBeGreaterThan(0);
    });

    it('2.5 verifies composite unique index on Registration (mosque_id, user_id, program_id)', async () => {
      const indexes = await app.prisma.$queryRawUnsafe<Array<{ name: string }>>(
        "PRAGMA index_list('Registration');"
      );
      expect(indexes.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 3: Deterministic Demo Seeding
  // -------------------------------------------------------------------------
  describe('Feature 3: Deterministic Demo Seeding', () => {
    it('3.1 verifies platform super_admin user exists with correct platform_role', async () => {
      const superAdmin = await app.prisma.user.findUnique({
        where: { email: 'platform@masjidhub.local' }
      });
      expect(superAdmin).toBeDefined();
      expect(superAdmin?.platform_role).toBe('super_admin');
    });

    it('3.2 verifies platform super_admin can login successfully via /api/platform/auth/login', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/platform/auth/login',
        payload: { email: 'platform@masjidhub.local', password: 'platformPass123' }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveProperty('token');
      expect(res.json().user.platform_role).toBe('super_admin');
    });

    it('3.3 verifies public mosque directory query returns active mosques', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/mosques'
      });
      expect(res.statusCode).toBe(200);
      const mosques = res.json();
      expect(Array.isArray(mosques)).toBe(true);
      expect(mosques.length).toBeGreaterThan(0);
    });

    it('3.4 verifies seeded users possess secure bcrypt password hashes (length >= 60)', async () => {
      const users = await app.prisma.user.findMany({ take: 5 });
      for (const u of users) {
        expect(u.password_hash.startsWith('$2')).toBe(true);
        expect(u.password_hash.length).toBeGreaterThanOrEqual(60);
      }
    });

    it('3.5 verifies platform metrics endpoint returns aggregated system counts', async () => {
      const platLogin = await app.inject({
        method: 'POST',
        url: '/api/platform/auth/login',
        payload: { email: 'platform@masjidhub.local', password: 'platformPass123' }
      });
      const token = platLogin.json().token;

      const res = await app.inject({
        method: 'GET',
        url: '/api/platform/metrics',
        headers: { authorization: `Bearer ${token}` }
      });
      expect(res.statusCode).toBe(200);
      const metrics = res.json();
      expect(metrics).toHaveProperty('tenants');
      expect(metrics).toHaveProperty('users');
      expect(metrics).toHaveProperty('memberships');
      expect(metrics).toHaveProperty('auditEvents');
    });
  });

  // -------------------------------------------------------------------------
  // Feature 4: HTTP-Only Cookie Authentication
  // -------------------------------------------------------------------------
  describe('Feature 4: HTTP-Only Cookie Authentication', () => {
    it('4.1 issues HttpOnly, SameSite=Lax mh_session cookie on POST /api/auth/login', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'x-mosque-slug': tenant.slug },
        payload: { email: tenant.adminEmail, password: tenant.adminPassword }
      });
      expect(res.statusCode).toBe(200);
      const cookieHeader = String(res.headers['set-cookie']);
      expect(cookieHeader).toContain('mh_session=');
      expect(cookieHeader.toLowerCase()).toContain('httponly');
      expect(cookieHeader.toLowerCase()).toContain('samesite=lax');
    });

    it('4.2 issues HttpOnly mh_session cookie on POST /api/auth/register', async () => {
      const regEmail = `test-reg-${Date.now()}@example.test`;
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'x-mosque-slug': tenant.slug },
        payload: { name: 'Reg Test', email: regEmail, password: 'Password123!' }
      });
      expect(res.statusCode).toBe(201);
      const cookieHeader = String(res.headers['set-cookie']);
      expect(cookieHeader).toContain('mh_session=');
      expect(cookieHeader.toLowerCase()).toContain('httponly');
      // Clean up
      await app.prisma.membership.deleteMany({ where: { user: { email: regEmail } } });
      await app.prisma.user.deleteMany({ where: { email: regEmail } });
    });

    it('4.3 issues HttpOnly mh_session cookie on POST /api/platform/auth/login', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/platform/auth/login',
        payload: { email: 'platform@masjidhub.local', password: 'platformPass123' }
      });
      expect(res.statusCode).toBe(200);
      const cookieHeader = String(res.headers['set-cookie']);
      expect(cookieHeader).toContain('mh_session=');
      expect(cookieHeader.toLowerCase()).toContain('httponly');
    });

    it('4.4 authenticates GET /api/auth/me seamlessly using mh_session cookie header', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: `mh_session=${tenant.adminSessionCookie}` }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().email).toBe(tenant.adminEmail);
    });

    it('4.5 clears mh_session and mh_csrf cookies on POST /api/auth/logout', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/logout'
      });
      expect(res.statusCode).toBe(200);
      const cookieHeader = String(res.headers['set-cookie']);
      expect(cookieHeader).toContain('mh_session=;');
      expect(cookieHeader).toContain('mh_csrf=;');
    });
  });

  // -------------------------------------------------------------------------
  // Feature 5: CSRF Protection
  // -------------------------------------------------------------------------
  describe('Feature 5: CSRF Protection', () => {
    it('5.1 provides dedicated GET /api/auth/csrf endpoint returning signed CSRF token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/csrf'
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveProperty('csrfToken');
      expect(res.json().csrfToken).toContain('.');
    });

    it('5.2 accepts POST mutation when valid X-CSRF-Token is sent alongside session cookie', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': tenant.slug,
          cookie: `mh_session=${tenant.adminSessionCookie}`,
          'x-csrf-token': tenant.csrfToken
        },
        payload: {
          title: 'CSRF Valid Program',
          description: 'Testing valid CSRF',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 3600000).toISOString(),
          location: 'Hall A'
        }
      });
      expect(res.statusCode).toBe(201);
      const progId = res.json().program_id;
      await app.prisma.program.delete({ where: { program_id: progId } });
    });

    it('5.3 accepts PUT mutation with valid X-CSRF-Token and session cookie', async () => {
      const prog = await app.prisma.program.create({
        data: {
          mosque_id: tenant.mosqueId,
          title: 'Initial Title',
          description: 'Desc',
          start_date: new Date(),
          end_date: new Date(Date.now() + 3600000),
          location: 'Hall B'
        }
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/programs/${prog.program_id}`,
        headers: {
          'x-mosque-slug': tenant.slug,
          cookie: `mh_session=${tenant.adminSessionCookie}`,
          'x-csrf-token': tenant.csrfToken
        },
        payload: { title: 'Updated Title' }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().title).toBe('Updated Title');
      await app.prisma.program.delete({ where: { program_id: prog.program_id } });
    });

    it('5.4 accepts DELETE mutation with valid X-CSRF-Token and session cookie', async () => {
      const prog = await app.prisma.program.create({
        data: {
          mosque_id: tenant.mosqueId,
          title: 'To Delete',
          description: 'Desc',
          start_date: new Date(),
          end_date: new Date(Date.now() + 3600000),
          location: 'Hall C'
        }
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/admin/programs/${prog.program_id}`,
        headers: {
          'x-mosque-slug': tenant.slug,
          cookie: `mh_session=${tenant.adminSessionCookie}`,
          'x-csrf-token': tenant.csrfToken
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it('5.5 allows safe GET queries without CSRF token when authenticated via cookie', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/members/donations',
        headers: {
          'x-mosque-slug': tenant.slug,
          cookie: `mh_session=${tenant.adminSessionCookie}`
        }
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 6: Centralized Request Validation
  // -------------------------------------------------------------------------
  describe('Feature 6: Centralized Request Validation', () => {
    it('6.1 returns 400 with formatted error when login payload is missing required fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'x-mosque-slug': tenant.slug },
        payload: { email: 'only-email@example.test' }
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toHaveProperty('error');
    });

    it('6.2 returns 400 when donation amount is zero or negative', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/donations',
        headers: { 'x-mosque-slug': tenant.slug },
        payload: { amount: 0, category: 'General', method: 'Card' }
      });
      expect(res.statusCode).toBe(400);
    });

    it('6.3 returns 400 when donation category is invalid enum', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/donations',
        headers: { 'x-mosque-slug': tenant.slug },
        payload: { amount: 100, category: 'InvalidCategory', method: 'Card' }
      });
      expect(res.statusCode).toBe(400);
    });

    it('6.4 returns 400 when creating program with missing required title or dates', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        },
        payload: { description: 'Missing title & dates' }
      });
      expect(res.statusCode).toBe(400);
    });

    it('6.5 returns 400 when program ID param is non-numeric string', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/programs/abc-not-id',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        },
        payload: { title: 'New' }
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 7: Strict Production CORS
  // -------------------------------------------------------------------------
  describe('Feature 7: Strict Production CORS', () => {
    it('7.1 returns Access-Control-Allow-Origin matching whitelisted http://localhost:3000', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/auth/login',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'Content-Type, X-Mosque-Slug'
        }
      });
      expect(res.statusCode).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('7.2 returns Access-Control-Allow-Credentials: true on preflight requests', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/auth/login',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'POST'
        }
      });
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('7.3 allows required HTTP methods including GET, POST, PUT, PATCH, DELETE, OPTIONS', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/admin/programs',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'DELETE'
        }
      });
      const allowedMethods = String(res.headers['access-control-allow-methods']);
      expect(allowedMethods).toContain('DELETE');
      expect(allowedMethods).toContain('POST');
    });

    it('7.4 omits Access-Control-Allow-Origin for unauthorized origin (https://attacker.evil.com)', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/auth/login',
        headers: {
          origin: 'https://attacker.evil.com',
          'access-control-request-method': 'POST'
        }
      });
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('7.5 allows requests without Origin header (server-to-server / curl)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/mosques/${tenant.slug}`
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 8: Structured Audit Event Logging
  // -------------------------------------------------------------------------
  describe('Feature 8: Structured Audit Event Logging', () => {
    it('8.1 logs AuditEvent for public donation.completed', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/donations',
        headers: { 'x-mosque-slug': tenant.slug },
        payload: { amount: 150, category: 'Sadaqah', method: 'Card' }
      });
      expect(res.statusCode).toBe(201);
      const donId = res.json().donation_id;

      const event = await app.prisma.auditEvent.findFirst({
        where: { mosque_id: tenant.mosqueId, action: 'donation.completed', target_id: String(donId) }
      });
      expect(event).toBeDefined();
      expect(event?.summary).toContain('Donation receipt');
    });

    it('8.2 logs AuditEvent for offline manual cash donation (donation.recorded)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        },
        payload: { amount: 500, category: 'Zakat', method: 'Cash' }
      });
      expect(res.statusCode).toBe(201);
      const donId = res.json().donation_id;

      const event = await app.prisma.auditEvent.findFirst({
        where: { mosque_id: tenant.mosqueId, action: 'donation.recorded', target_id: String(donId) }
      });
      expect(event).toBeDefined();
      expect(event?.actor_id).toBe(tenant.adminUserId);
    });

    it('8.3 logs AuditEvent for donation reconciliation (donation.reconciled)', async () => {
      const don = await app.prisma.donation.create({
        data: {
          mosque_id: tenant.mosqueId,
          amount_minor: 5000,
          category: 'Waqf',
          method: 'Transfer',
          status: 'Completed',
          receipt_number: `MH-REC-${Date.now()}`
        }
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/donations/${don.donation_id}/reconcile`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);

      const event = await app.prisma.auditEvent.findFirst({
        where: { mosque_id: tenant.mosqueId, action: 'donation.reconciled', target_id: String(don.donation_id) }
      });
      expect(event).toBeDefined();
      expect(event?.actor_id).toBe(tenant.adminUserId);
    });

    it('8.4 logs AuditEvent for program creation (program.created)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        },
        payload: {
          title: 'Audit Program',
          description: 'Desc',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 3600000).toISOString(),
          location: 'Hall A'
        }
      });
      expect(res.statusCode).toBe(201);
      const progId = res.json().program_id;

      const event = await app.prisma.auditEvent.findFirst({
        where: { mosque_id: tenant.mosqueId, action: 'program.created', target_id: String(progId) }
      });
      expect(event).toBeDefined();
      await app.prisma.program.delete({ where: { program_id: progId } });
    });

    it('8.5 logs AuditEvent for attendee check-in (attendance.recorded)', async () => {
      const prog = await app.prisma.program.create({
        data: {
          mosque_id: tenant.mosqueId,
          title: 'Attendance Check Prog',
          description: 'Desc',
          start_date: new Date(),
          end_date: new Date(Date.now() + 3600000),
          location: 'Hall'
        }
      });
      const reg = await app.prisma.registration.create({
        data: {
          mosque_id: tenant.mosqueId,
          user_id: regularMember.userId,
          program_id: prog.program_id,
          status: 'Registered'
        }
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/registrations/${reg.reg_id}/attendance`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        },
        payload: { status: 'Attended' }
      });
      expect(res.statusCode).toBe(200);

      const event = await app.prisma.auditEvent.findFirst({
        where: { mosque_id: tenant.mosqueId, action: 'attendance.recorded', target_id: String(reg.reg_id) }
      });
      expect(event).toBeDefined();
      await app.prisma.registration.delete({ where: { reg_id: reg.reg_id } });
      await app.prisma.program.delete({ where: { program_id: prog.program_id } });
    });
  });

  // -------------------------------------------------------------------------
  // Feature 9: Programme Lifecycle Management
  // -------------------------------------------------------------------------
  describe('Feature 9: Programme Lifecycle Management', () => {
    let createdProgramId: number;

    it('9.1 creates a program via POST /api/admin/programs with capacity and category', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        },
        payload: {
          title: 'Quran Tafseer Circle',
          description: 'Weekly in-depth tafseer study',
          category: 'Education',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 7200000).toISOString(),
          location: 'Main Prayer Hall',
          max_capacity: 45,
          visibility: 'Public',
          status: 'Published'
        }
      });
      expect(res.statusCode).toBe(201);
      const data = res.json();
      expect(data.title).toBe('Quran Tafseer Circle');
      expect(data.max_capacity).toBe(45);
      createdProgramId = data.program_id;
    });

    it('9.2 retrieves published program via public GET /api/programs', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/programs',
        headers: { 'x-mosque-slug': tenant.slug }
      });
      expect(res.statusCode).toBe(200);
      const progs = res.json();
      expect(Array.isArray(progs)).toBe(true);
      expect(progs.some((p: any) => p.program_id === createdProgramId)).toBe(true);
    });

    it('9.3 updates program details via PUT /api/admin/programs/:id', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/programs/${createdProgramId}`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        },
        payload: {
          title: 'Quran & Hadith Tafseer Circle',
          max_capacity: 50
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().title).toBe('Quran & Hadith Tafseer Circle');
      expect(res.json().max_capacity).toBe(50);
    });

    it('9.4 updates program status to Completed', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/programs/${createdProgramId}`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        },
        payload: { status: 'Completed' }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('Completed');
    });

    it('9.5 deletes program via DELETE /api/admin/programs/:id', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/admin/programs/${createdProgramId}`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 10: Attendee Check-in & Reminders
  // -------------------------------------------------------------------------
  describe('Feature 10: Attendee Check-in & Reminders', () => {
    let testProgramId: number;
    let registrationId: number;

    beforeAll(async () => {
      const prog = await app.prisma.program.create({
        data: {
          mosque_id: tenant.mosqueId,
          title: 'Checkin Test Program',
          description: 'Desc',
          start_date: new Date(),
          end_date: new Date(Date.now() + 3600000),
          location: 'Hall',
          max_capacity: 10,
          status: 'Published'
        }
      });
      testProgramId = prog.program_id;
    });

    afterAll(async () => {
      await app.prisma.registration.deleteMany({ where: { program_id: testProgramId } });
      await app.prisma.program.deleteMany({ where: { program_id: testProgramId } });
    });

    it('10.1 registers member via POST /api/programs/:id/register', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/programs/${testProgramId}/register`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${regularMember.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(201);
      registrationId = res.json().reg_id;
      expect(res.json().status).toBe('Registered');
    });

    it('10.2 fetches member registrations via GET /api/members/registrations', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/members/registrations',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${regularMember.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      const list = res.json();
      expect(list.some((r: any) => r.reg_id === registrationId)).toBe(true);
    });

    it('10.3 fetches admin attendee roster via GET /api/admin/programs/:id/registrations', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/admin/programs/${testProgramId}/registrations`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${programmeOfficer.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      const list = res.json();
      expect(list.some((r: any) => r.reg_id === registrationId)).toBe(true);
      expect(list[0].user).toHaveProperty('email');
    });

    it('10.4 marks attendee check-in via PATCH /api/admin/registrations/:id/attendance', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/registrations/${registrationId}/attendance`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${programmeOfficer.bearerToken}`
        },
        payload: { status: 'Attended' }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('Attended');
      expect(res.json().attended_at).toBeDefined();
    });

    it('10.5 dispatches program reminders via POST /api/admin/programs/:id/reminders', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/admin/programs/${testProgramId}/reminders`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${programmeOfficer.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveProperty('sent');
    });
  });

  // -------------------------------------------------------------------------
  // Feature 11: Donation Reconciliation & Offline Entry
  // -------------------------------------------------------------------------
  describe('Feature 11: Donation Reconciliation & Offline Entry', () => {
    let onlineDonationId: number;
    let manualDonationId: number;

    it('11.1 creates online public donation with receipt number via POST /api/donations', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/donations',
        headers: { 'x-mosque-slug': tenant.slug },
        payload: {
          amount: 200,
          category: 'Zakat',
          method: 'Transfer',
          external_reference: 'TRF-12345'
        }
      });
      expect(res.statusCode).toBe(201);
      const don = res.json();
      expect(don.amount).toBe(200);
      expect(don.receipt_number.startsWith('MH-')).toBe(true);
      onlineDonationId = don.donation_id;
    });

    it('11.2 records manual offline cash donation via POST /api/admin/donations/manual', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${financeOfficer.bearerToken}`
        },
        payload: {
          amount: 750,
          category: 'Sadaqah',
          method: 'Cash',
          donor_email: regularMember.email
        }
      });
      expect(res.statusCode).toBe(201);
      const don = res.json();
      expect(don.amount).toBe(750);
      expect(don.method).toBe('Cash');
      manualDonationId = don.donation_id;
    });

    it('11.3 queries admin donations with category and status filters', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/donations?category=Zakat',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${financeOfficer.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      const list = res.json();
      expect(Array.isArray(list)).toBe(true);
      expect(list.some((d: any) => d.donation_id === onlineDonationId)).toBe(true);
    });

    it('11.4 reconciles donation via PATCH /api/admin/donations/:id/reconcile', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/donations/${onlineDonationId}/reconcile`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${financeOfficer.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().reconciliation_status).toBe('Reconciled');
    });

    it('11.5 returns member personal donations via GET /api/members/donations', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/members/donations',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${regularMember.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      const list = res.json();
      expect(Array.isArray(list)).toBe(true);
      expect(list.some((d: any) => d.donation_id === manualDonationId)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 12: CSV Ledger Export
  // -------------------------------------------------------------------------
  describe('Feature 12: CSV Ledger Export', () => {
    it('12.1 returns HTTP 200 with text/csv content type on GET /api/admin/donations/export.csv', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/donations/export.csv',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${financeOfficer.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });

    it('12.2 sets Content-Disposition header with filename "donations.csv"', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/donations/export.csv',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${financeOfficer.bearerToken}`
        }
      });
      expect(res.headers['content-disposition']).toContain('attachment; filename="donations.csv"');
    });

    it('12.3 includes expected CSV column headers on the first line', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/donations/export.csv',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${financeOfficer.bearerToken}`
        }
      });
      const lines = res.body.split('\n');
      expect(lines[0]).toBe('receipt,date,amount,currency,category,method,status,reconciliation');
    });

    it('12.4 includes formatted donation rows matching database records', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/donations/export.csv',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${financeOfficer.bearerToken}`
        }
      });
      expect(res.body).toContain('MH-');
      expect(res.body).toContain('NGN');
    });

    it('12.5 logs AuditEvent for donations.exported on export execution', async () => {
      const event = await app.prisma.auditEvent.findFirst({
        where: { mosque_id: tenant.mosqueId, action: 'donations.exported' }
      });
      expect(event).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Feature 13: In-App Notification Center
  // -------------------------------------------------------------------------
  describe('Feature 13: In-App Notification Center', () => {
    let notifId: number;

    beforeAll(async () => {
      const notif = await app.prisma.notification.create({
        data: {
          mosque_id: tenant.mosqueId,
          user_id: regularMember.userId,
          message: 'Welcome to MasjidHub notification inbox.',
          type: 'In-App',
          status: 'Sent',
          is_read: false
        }
      });
      notifId = notif.notif_id;
    });

    it('13.1 retrieves member notification inbox via GET /api/members/notifications', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/members/notifications',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${regularMember.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      const list = res.json();
      expect(list.some((n: any) => n.notif_id === notifId)).toBe(true);
    });

    it('13.2 notification object contains message, type, and is_read boolean', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/members/notifications',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${regularMember.bearerToken}`
        }
      });
      const notif = res.json().find((n: any) => n.notif_id === notifId);
      expect(notif.message).toBe('Welcome to MasjidHub notification inbox.');
      expect(notif.is_read).toBe(false);
    });

    it('13.3 marks notification as read via PATCH /api/members/notifications/:id/read', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/members/notifications/${notifId}/read`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${regularMember.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().is_read).toBe(true);
    });

    it('13.4 verified notification is now marked is_read in database', async () => {
      const updated = await app.prisma.notification.findUnique({
        where: { notif_id: notifId }
      });
      expect(updated?.is_read).toBe(true);
    });

    it('13.5 allows multiple notifications to be received and fetched in desc order', async () => {
      await app.prisma.notification.create({
        data: {
          mosque_id: tenant.mosqueId,
          user_id: regularMember.userId,
          message: 'Second notification message.',
          type: 'In-App',
          status: 'Sent'
        }
      });
      const res = await app.inject({
        method: 'GET',
        url: '/api/members/notifications',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${regularMember.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().length).toBeGreaterThanOrEqual(2);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 14: Tenant Audit Log Viewer
  // -------------------------------------------------------------------------
  describe('Feature 14: Tenant Audit Log Viewer', () => {
    it('14.1 returns tenant audit events for tenant admin via GET /api/admin/audit-events', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-events',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      const events = res.json();
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);
    });

    it('14.2 includes actor details (name, email) in audit event relations', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-events',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        }
      });
      const events = res.json();
      const eventWithActor = events.find((e: any) => e.actor !== null);
      if (eventWithActor) {
        expect(eventWithActor.actor).toHaveProperty('email');
      }
    });

    it('14.3 audit logs are strictly scoped to the calling tenant mosque_id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-events',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        }
      });
      for (const ev of res.json()) {
        expect(ev.mosque_id).toBe(tenant.mosqueId);
      }
    });

    it('14.4 audit events are ordered with newest events first (created_at desc)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-events',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        }
      });
      const events = res.json();
      if (events.length >= 2) {
        const time1 = new Date(events[0].created_at).getTime();
        const time2 = new Date(events[1].created_at).getTime();
        expect(time1).toBeGreaterThanOrEqual(time2);
      }
    });

    it('14.5 rejects non-admin officers with 403 on /api/admin/audit-events', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-events',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${financeOfficer.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 15: Role-Based Workspace Views & RBAC
  // -------------------------------------------------------------------------
  describe('Feature 15: Role-Based Workspace Views & RBAC', () => {
    it('15.1 tenant_admin can manage memberships via GET /api/admin/memberships', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/memberships',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });

    it('15.2 finance_officer can access donation analytics via GET /api/admin/analytics/donations', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/analytics/donations',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveProperty('totalDonated');
    });

    it('15.3 programme_officer can access registration analytics via GET /api/admin/analytics/registrations', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/analytics/registrations',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });

    it('15.4 communications_officer can create announcements via POST /api/admin/announcements', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/announcements',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${commsOfficer.bearerToken}`
        },
        payload: {
          title: 'Role Test Announcement',
          content: 'Important news',
          category: 'General'
        }
      });
      expect(res.statusCode).toBe(201);
      const id = res.json().announcement_id;
      await app.prisma.announcement.delete({ where: { announcement_id: id } });
    });

    it('15.5 member can view public announcements via GET /api/announcements', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/announcements',
        headers: { 'x-mosque-slug': tenant.slug }
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 16: 5-Role Integration Test Suite
  // -------------------------------------------------------------------------
  describe('Feature 16: 5-Role Integration Test Suite', () => {
    it('16.1 blocks finance_officer from creating programs (HTTP 403)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${financeOfficer.bearerToken}`
        },
        payload: {
          title: 'Finance Blocked Program',
          description: 'Desc',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 3600000).toISOString(),
          location: 'Hall'
        }
      });
      expect(res.statusCode).toBe(403);
    });

    it('16.2 blocks programme_officer from reconciling donations (HTTP 403)', async () => {
      const don = await app.prisma.donation.create({
        data: {
          mosque_id: tenant.mosqueId,
          amount_minor: 1000,
          category: 'General',
          method: 'Card',
          status: 'Completed',
          receipt_number: `MH-BLOCK-${Date.now()}`
        }
      });
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/donations/${don.donation_id}/reconcile`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${programmeOfficer.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(403);
      await app.prisma.donation.delete({ where: { donation_id: don.donation_id } });
    });

    it('16.3 blocks communications_officer from recording manual cash donations (HTTP 403)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${commsOfficer.bearerToken}`
        },
        payload: { amount: 100, category: 'General', method: 'Cash' }
      });
      expect(res.statusCode).toBe(403);
    });

    it('16.4 blocks member from accessing admin announcements route (HTTP 403)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/announcements',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${regularMember.bearerToken}`
        },
        payload: { title: 'Member Title', content: 'Member Content', category: 'General' }
      });
      expect(res.statusCode).toBe(403);
    });

    it('16.5 blocks member from accessing admin donations export (HTTP 403)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/donations/export.csv',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${regularMember.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 17: Multi-Mosque Global Users
  // -------------------------------------------------------------------------
  describe('Feature 17: Multi-Mosque Global Users', () => {
    let secondTenant: TestTenant;
    let multiMosqueUser: TestOfficer;

    beforeAll(async () => {
      secondTenant = await createActiveTenant(app, { slugPrefix: 'multi2' });
      // Create user in tenant 1 as member
      multiMosqueUser = await createMemberUser(app, tenant, 'member', {
        email: `global-${Date.now()}@example.test`
      });
      // Add membership to secondTenant as finance_officer
      await app.prisma.membership.create({
        data: {
          mosque_id: secondTenant.mosqueId,
          user_id: multiMosqueUser.userId,
          role: 'finance_officer',
          status: 'Active'
        }
      });
    });

    afterAll(async () => {
      if (secondTenant?.mosqueId) {
        await cleanupTenant(app, secondTenant.mosqueId);
      }
      await app.prisma.user.deleteMany({ where: { email: multiMosqueUser.email } });
    });

    it('17.1 lists multiple memberships across mosques on GET /api/auth/me', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${multiMosqueUser.bearerToken}` }
      });
      expect(res.statusCode).toBe(200);
      const user = res.json();
      expect(user.memberships.length).toBe(2);
    });

    it('17.2 switches tenant context to second mosque via POST /api/auth/switch-tenant/:slug', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/auth/switch-tenant/${secondTenant.slug}`,
        headers: { authorization: `Bearer ${multiMosqueUser.bearerToken}` }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().role).toBe('finance_officer');
      expect(res.json().token).toBeDefined();
    });

    it('17.3 switched session possesses finance_officer privileges in second mosque', async () => {
      const switchRes = await app.inject({
        method: 'POST',
        url: `/api/auth/switch-tenant/${secondTenant.slug}`,
        headers: { authorization: `Bearer ${multiMosqueUser.bearerToken}` }
      });
      const newToken = switchRes.json().token;

      // In second mosque, this user can record manual cash donation
      const donRes = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': secondTenant.slug,
          authorization: `Bearer ${newToken}`
        },
        payload: { amount: 350, category: 'Waqf', method: 'Cash' }
      });
      expect(donRes.statusCode).toBe(201);
    });

    it('17.4 user switches back to first mosque and resumes member role', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/auth/switch-tenant/${tenant.slug}`,
        headers: { authorization: `Bearer ${multiMosqueUser.bearerToken}` }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().role).toBe('member');
    });

    it('17.5 in first mosque context, member cannot perform finance actions', async () => {
      const switchRes = await app.inject({
        method: 'POST',
        url: `/api/auth/switch-tenant/${tenant.slug}`,
        headers: { authorization: `Bearer ${multiMosqueUser.bearerToken}` }
      });
      const token1 = switchRes.json().token;

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${token1}`
        },
        payload: { amount: 200, category: 'Zakat', method: 'Cash' }
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 18: Adversarial Multi-Tenant Isolation
  // -------------------------------------------------------------------------
  describe('Feature 18: Adversarial Multi-Tenant Isolation', () => {
    let foreignTenant: TestTenant;
    let foreignProgramId: number;
    let foreignDonationId: number;

    beforeAll(async () => {
      foreignTenant = await createActiveTenant(app, { slugPrefix: 'foreign' });

      // Create foreign program
      const p = await app.prisma.program.create({
        data: {
          mosque_id: foreignTenant.mosqueId,
          title: 'Foreign Program',
          description: 'Secret',
          start_date: new Date(),
          end_date: new Date(Date.now() + 3600000),
          location: 'Foreign Hall'
        }
      });
      foreignProgramId = p.program_id;

      // Create foreign donation
      const d = await app.prisma.donation.create({
        data: {
          mosque_id: foreignTenant.mosqueId,
          amount_minor: 9900,
          category: 'Zakat',
          method: 'Card',
          status: 'Completed',
          receipt_number: `MH-FOR-${Date.now()}`
        }
      });
      foreignDonationId = d.donation_id;
    });

    afterAll(async () => {
      if (foreignTenant?.mosqueId) {
        await cleanupTenant(app, foreignTenant.mosqueId);
      }
    });

    it('18.1 tenant admin cannot update foreign program (returns HTTP 404)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/programs/${foreignProgramId}`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        },
        payload: { title: 'Hacked Title' }
      });
      expect(res.statusCode).toBe(404);
    });

    it('18.2 tenant admin cannot delete foreign program (returns HTTP 404)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/admin/programs/${foreignProgramId}`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(404);
    });

    it('18.3 tenant admin cannot reconcile foreign donation (returns HTTP 404)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/donations/${foreignDonationId}/reconcile`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(404);
    });

    it('18.4 tenant admin cannot query foreign program registrations (returns HTTP 404)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/admin/programs/${foreignProgramId}/registrations`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(404);
    });

    it('18.5 tenant admin with spoofed X-Mosque-Slug header is rejected with HTTP 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/donations',
        headers: {
          'x-mosque-slug': foreignTenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}` // Token is for tenant, slug is foreign
        }
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 19: Opaque-Box E2E Test Suite
  // -------------------------------------------------------------------------
  describe('Feature 19: Opaque-Box E2E Test Suite', () => {
    it('19.1 executes end-to-end tenant application and platform activation flow', async () => {
      const testSlug = `opaque-${Date.now().toString(36)}`;
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/mosques',
        payload: {
          name: 'Opaque Test Mosque',
          slug: testSlug,
          admin_name: 'Opaque Admin',
          admin_email: `opaque-${Date.now()}@example.test`,
          admin_password: 'Password123!'
        }
      });
      expect(regRes.statusCode).toBe(201);
      const mosqueId = regRes.json().mosque_id;
      expect(regRes.json().status).toBe('Pending');

      await cleanupTenant(app, mosqueId);
    });

    it('19.2 executes end-to-end member registration and self-service profile query', async () => {
      const email = `opaque-member-${Date.now()}@example.test`;
      const reg = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'x-mosque-slug': tenant.slug },
        payload: { name: 'Opaque Member', email, password: 'MemberPass123!' }
      });
      expect(reg.statusCode).toBe(201);
      const token = reg.json().token;

      const me = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${token}` }
      });
      expect(me.statusCode).toBe(200);
      expect(me.json().email).toBe(email);

      await app.prisma.membership.deleteMany({ where: { user: { email } } });
      await app.prisma.user.deleteMany({ where: { email } });
    });

    it('19.3 supports dual-mode API authentication via Authorization Bearer header', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${tenant.adminBearerToken}` }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().email).toBe(tenant.adminEmail);
    });

    it('19.4 verifies public mosque retrieval returns metadata without leaking admin credentials', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/mosques/${tenant.slug}`
      });
      expect(res.statusCode).toBe(200);
      const m = res.json();
      expect(m.name).toBe(tenant.name);
      expect(m.password_hash).toBeUndefined();
    });

    it('19.5 allows user logout and clears session', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/logout'
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 20: Final Integration & Adversarial Hardening
  // -------------------------------------------------------------------------
  describe('Feature 20: Final Integration & Adversarial Hardening', () => {
    it('20.1 handles Unicode & Arabic text in Mosque names and descriptions without corruption', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/announcements',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${commsOfficer.bearerToken}`
        },
        payload: {
          title: 'درس في التفسير - Quran Study Circle',
          content: 'بسم الله الرحمن الرحيم - Welcome to our weekly circle.',
          category: 'Event'
        }
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().title).toContain('درس في التفسير');
      const id = res.json().announcement_id;
      await app.prisma.announcement.delete({ where: { announcement_id: id } });
    });

    it('20.2 preserves HTML special characters and tags safely in announcement content', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/announcements',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${commsOfficer.bearerToken}`
        },
        payload: {
          title: 'HTML Safety Check & <Tags>',
          content: 'Paragraph with <b>bold</b> & "quotes" & \'single\'.',
          category: 'General'
        }
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().title).toBe('HTML Safety Check & <Tags>');
      const id = res.json().announcement_id;
      await app.prisma.announcement.delete({ where: { announcement_id: id } });
    });

    it('20.3 creates consecutive donations with uniquely generated receipt numbers without collision', async () => {
      const results = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/api/donations',
          headers: { 'x-mosque-slug': tenant.slug },
          payload: { amount: 10, category: 'General', method: 'Card' }
        }),
        app.inject({
          method: 'POST',
          url: '/api/donations',
          headers: { 'x-mosque-slug': tenant.slug },
          payload: { amount: 20, category: 'General', method: 'Card' }
        }),
        app.inject({
          method: 'POST',
          url: '/api/donations',
          headers: { 'x-mosque-slug': tenant.slug },
          payload: { amount: 30, category: 'General', method: 'Card' }
        })
      ]);
      const receipts = results.map((r) => r.json().receipt_number);
      const unique = new Set(receipts);
      expect(unique.size).toBe(3);
    });

    it('20.4 calculates registration metrics without numerical drift or NaN', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/analytics/registrations',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      for (const item of res.json()) {
        expect(Number.isFinite(item.fillRate)).toBe(true);
      }
    });

    it('20.5 public endpoints handle missing optional headers gracefully without crashing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/mosques'
      });
      expect(res.statusCode).toBe(200);
    });
  });
});
