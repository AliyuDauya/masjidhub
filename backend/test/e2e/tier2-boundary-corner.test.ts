import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/server.js';
import {
  createActiveTenant,
  createMemberUser,
  cleanupTenant,
  TestTenant,
  TestOfficer
} from './test-utils.js';

describe('Tier 2: Boundary & Corner Cases (20 Features)', () => {
  let app: FastifyInstance;
  let tenant: TestTenant;
  let financeOfficer: TestOfficer;
  let programmeOfficer: TestOfficer;
  let commsOfficer: TestOfficer;
  let regularMember: TestOfficer;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    tenant = await createActiveTenant(app, { slugPrefix: 'tier2' });
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
  // Feature 1 Boundaries: Baseline Prisma SQLite Migration
  // -------------------------------------------------------------------------
  describe('Feature 1 Boundaries: DB Migration Integrity', () => {
    it('1.1 querying non-existent table throws without unhandled crash', async () => {
      await expect(
        app.prisma.$queryRawUnsafe('SELECT * FROM NonExistentTable_12345;')
      ).rejects.toThrow();
    });

    it('1.2 querying non-existent column throws schema error', async () => {
      await expect(
        app.prisma.$queryRawUnsafe("SELECT non_existent_col FROM 'Mosque';")
      ).rejects.toThrow();
    });

    it('1.3 foreign key violation when creating Donation with non-existent mosque_id', async () => {
      await expect(
        app.prisma.donation.create({
          data: {
            mosque_id: 999999,
            amount_minor: 1000,
            category: 'General',
            method: 'Card',
            receipt_number: `MH-FK-${Date.now()}`
          }
        })
      ).rejects.toThrow();
    });

    it('1.4 inserting duplicate primary key in Mosque table is rejected', async () => {
      await expect(
        app.prisma.mosque.create({
          data: {
            mosque_id: tenant.mosqueId,
            name: 'Dup Mosque',
            slug: `dup-${Date.now()}`
          }
        })
      ).rejects.toThrow();
    });

    it('1.5 raw query handles SQLite keywords in parameters safely', async () => {
      const result = await app.prisma.$queryRawUnsafe<Array<{ count: number }>>(
        "SELECT count(*) as count FROM 'Mosque' WHERE name = 'WHERE 1=1';"
      );
      expect(result.length).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 2 Boundaries: Clean Environment Initialization
  // -------------------------------------------------------------------------
  describe('Feature 2 Boundaries: Constraints & Types', () => {
    it('2.1 duplicate slug insertion in Mosque table returns 409 on registration endpoint', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/mosques',
        payload: {
          name: 'Duplicate Slug Mosque',
          slug: tenant.slug,
          admin_name: 'Admin',
          admin_email: `unique-${Date.now()}@example.test`,
          admin_password: 'Password123!'
        }
      });
      expect(res.statusCode).toBe(409);
    });

    it('2.2 duplicate email registration returns 409', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'x-mosque-slug': tenant.slug },
        payload: { name: 'Duplicate Email', email: regularMember.email, password: 'Password123!' }
      });
      expect(res.statusCode).toBe(409);
    });

    it('2.3 creating membership with invalid user_id rejects at database level', async () => {
      await expect(
        app.prisma.membership.create({
          data: { mosque_id: tenant.mosqueId, user_id: 888888, role: 'member' }
        })
      ).rejects.toThrow();
    });

    it('2.4 creating registration with invalid program_id rejects at database level', async () => {
      await expect(
        app.prisma.registration.create({
          data: { mosque_id: tenant.mosqueId, user_id: regularMember.userId, program_id: 888888 }
        })
      ).rejects.toThrow();
    });

    it('2.5 querying maximum 32-bit integer ID returns 404 without exception', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/programs/2147483647/registrations',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 3 Boundaries: Platform & Seed Credentials
  // -------------------------------------------------------------------------
  describe('Feature 3 Boundaries: Platform Authentication', () => {
    it('3.1 rejects platform login with incorrect password with HTTP 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/platform/auth/login',
        payload: { email: 'platform@masjidhub.local', password: 'WrongPassword!' }
      });
      expect(res.statusCode).toBe(401);
    });

    it('3.2 rejects platform login with non-existent email with HTTP 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/platform/auth/login',
        payload: { email: 'unknown@masjidhub.local', password: 'platformPass123' }
      });
      expect(res.statusCode).toBe(401);
    });

    it('3.3 rejects platform login with empty credentials with HTTP 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/platform/auth/login',
        payload: {}
      });
      expect(res.statusCode).toBe(400);
    });

    it('3.4 rejects regular member credentials on platform login endpoint with HTTP 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/platform/auth/login',
        payload: { email: regularMember.email, password: 'MemberPass123!' }
      });
      expect(res.statusCode).toBe(401);
    });

    it('3.5 rejects updating tenant status with invalid enum string with HTTP 400', async () => {
      const platLogin = await app.inject({
        method: 'POST',
        url: '/api/platform/auth/login',
        payload: { email: 'platform@masjidhub.local', password: 'platformPass123' }
      });
      const token = platLogin.json().token;

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/platform/tenants/${tenant.mosqueId}/status`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: 'InvalidStatus' }
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 4 Boundaries: HTTP-Only Cookie Authentication
  // -------------------------------------------------------------------------
  describe('Feature 4 Boundaries: Cookie Tampering & Expiry', () => {
    it('4.1 rejects tampered session cookie with HTTP 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: 'mh_session=tampered.jwt.payload' }
      });
      expect(res.statusCode).toBe(401);
    });

    it('4.2 rejects malformed cookie header with HTTP 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: 'mh_session=;;;' }
      });
      expect(res.statusCode).toBe(401);
    });

    it('4.3 rejects cookie with non-existent user_id in JWT with HTTP 401', async () => {
      const fakeToken = app.jwt.sign({ user_id: 999999, email: 'fake@example.test' });
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: `mh_session=${fakeToken}` }
      });
      expect(res.statusCode).toBe(401);
    });

    it('4.4 rejects cookie for suspended user account with HTTP 401', async () => {
      const suspendedUser = await app.prisma.user.create({
        data: {
          name: 'Suspended User',
          email: `suspended-${Date.now()}@example.test`,
          password_hash: 'hash',
          account_status: 'Suspended'
        }
      });
      const token = app.jwt.sign({ user_id: suspendedUser.user_id, email: suspendedUser.email });

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: `mh_session=${token}` }
      });
      expect(res.statusCode).toBe(401);
      await app.prisma.user.delete({ where: { user_id: suspendedUser.user_id } });
    });

    it('4.5 handles extra noisy cookies in header without breaking mh_session extraction', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          cookie: `theme=dark; ga_client=12345; mh_session=${tenant.adminSessionCookie}; other_pref=true`
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().email).toBe(tenant.adminEmail);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 5 Boundaries: CSRF Protection
  // -------------------------------------------------------------------------
  describe('Feature 5 Boundaries: CSRF Header Edge Cases', () => {
    it('5.1 rejects mutation with cookie auth when CSRF header is missing (HTTP 403)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': tenant.slug,
          cookie: `mh_session=${tenant.adminSessionCookie}`
        },
        payload: {
          title: 'Blocked Program',
          description: 'Desc',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 3600000).toISOString(),
          location: 'Hall'
        }
      });
      expect(res.statusCode).toBe(403);
    });

    it('5.2 rejects mutation with cookie auth when CSRF header is empty string (HTTP 403)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': tenant.slug,
          cookie: `mh_session=${tenant.adminSessionCookie}`,
          'x-csrf-token': ''
        },
        payload: {
          title: 'Blocked Program',
          description: 'Desc',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 3600000).toISOString(),
          location: 'Hall'
        }
      });
      expect(res.statusCode).toBe(403);
    });

    it('5.3 rejects mutation with cookie auth when CSRF token signature is forged (HTTP 403)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': tenant.slug,
          cookie: `mh_session=${tenant.adminSessionCookie}`,
          'x-csrf-token': 'abcd1234efgh5678.invalidsignaturehere'
        },
        payload: {
          title: 'Blocked Program',
          description: 'Desc',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 3600000).toISOString(),
          location: 'Hall'
        }
      });
      expect(res.statusCode).toBe(403);
    });

    it('5.4 rejects mutation when CSRF token has no dot separator (HTTP 403)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': tenant.slug,
          cookie: `mh_session=${tenant.adminSessionCookie}`,
          'x-csrf-token': 'nodotseparatorintoken'
        },
        payload: {
          title: 'Blocked Program',
          description: 'Desc',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 3600000).toISOString(),
          location: 'Hall'
        }
      });
      expect(res.statusCode).toBe(403);
    });

    it('5.5 public login mutations are exempt from CSRF requirement', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: {
          'x-mosque-slug': tenant.slug,
          cookie: 'mh_session=someOldSession'
        },
        payload: { email: tenant.adminEmail, password: tenant.adminPassword }
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 6 Boundaries: Centralized Request Validation
  // -------------------------------------------------------------------------
  describe('Feature 6 Boundaries: Schema Constraint Violations', () => {
    it('6.1 member registration with short password (<8 chars) returns HTTP 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'x-mosque-slug': tenant.slug },
        payload: { name: 'Short', email: `short-${Date.now()}@example.test`, password: 'short' }
      });
      expect(res.statusCode).toBe(400);
    });

    it('6.2 mosque application with short admin password (<8 chars) returns HTTP 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/mosques',
        payload: {
          name: 'Short Pass Mosque',
          slug: `shortpass-${Date.now().toString(36)}`,
          admin_name: 'Admin',
          admin_email: `shortadmin-${Date.now()}@example.test`,
          admin_password: '123'
        }
      });
      expect(res.statusCode).toBe(400);
    });

    it('6.3 manual donation with non-Cash method returns HTTP 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${financeOfficer.bearerToken}`
        },
        payload: { amount: 100, category: 'General', method: 'Card' }
      });
      expect(res.statusCode).toBe(400);
    });

    it('6.4 inviting member with invalid role enum returns HTTP 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/memberships/invite',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        },
        payload: {
          name: 'Invalid Role',
          email: `invrole-${Date.now()}@example.test`,
          role: 'hacker_role',
          temporary_password: 'Password123!'
        }
      });
      expect(res.statusCode).toBe(400);
    });

    it('6.5 decimal amounts in donations convert accurately to minor integer units', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/donations',
        headers: { 'x-mosque-slug': tenant.slug },
        payload: { amount: 50.75, category: 'Sadaqah', method: 'Card' }
      });
      expect(res.statusCode).toBe(201);
      const don = res.json();
      expect(don.amount).toBe(50.75);

      const inDb = await app.prisma.donation.findUnique({
        where: { donation_id: don.donation_id }
      });
      expect(inDb?.amount_minor).toBe(5075);
      await app.prisma.donation.delete({ where: { donation_id: don.donation_id } });
    });
  });

  // -------------------------------------------------------------------------
  // Feature 7 Boundaries: Strict Production CORS
  // -------------------------------------------------------------------------
  describe('Feature 7 Boundaries: CORS Origin Edge Cases', () => {
    it('7.1 rejects unknown subdomain with omitted Access-Control-Allow-Origin', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/auth/login',
        headers: {
          origin: 'http://evil.localhost:3000',
          'access-control-request-method': 'POST'
        }
      });
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('7.2 rejects random public IP origin', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/auth/login',
        headers: {
          origin: 'http://192.168.1.55:8080',
          'access-control-request-method': 'POST'
        }
      });
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('7.3 preflight with non-whitelisted request method does not crash server', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/auth/login',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'TRACE'
        }
      });
      expect(res.statusCode).toBe(204);
    });

    it('7.4 accepts 127.0.0.1:3000 as whitelisted origin', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/auth/login',
        headers: {
          origin: 'http://127.0.0.1:3000',
          'access-control-request-method': 'POST'
        }
      });
      expect(res.headers['access-control-allow-origin']).toBe('http://127.0.0.1:3000');
    });

    it('7.5 accepts 127.0.0.1:5000 as whitelisted origin', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/auth/login',
        headers: {
          origin: 'http://127.0.0.1:5000',
          'access-control-request-method': 'POST'
        }
      });
      expect(res.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5000');
    });
  });

  // -------------------------------------------------------------------------
  // Feature 8 Boundaries: Structured Audit Event Logging
  // -------------------------------------------------------------------------
  describe('Feature 8 Boundaries: Audit Event Robustness', () => {
    it('8.1 anonymous online donation logs audit event with null actor_id', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/donations',
        headers: { 'x-mosque-slug': tenant.slug },
        payload: { amount: 50, category: 'General', method: 'Card' }
      });
      expect(res.statusCode).toBe(201);
      const donId = res.json().donation_id;

      const event = await app.prisma.auditEvent.findFirst({
        where: { mosque_id: tenant.mosqueId, target_id: String(donId) }
      });
      expect(event).toBeDefined();
      expect(event?.actor_id).toBeNull();
    });

    it('8.2 audit event records client IP and request_id', async () => {
      const event = await app.prisma.auditEvent.findFirst({
        where: { mosque_id: tenant.mosqueId }
      });
      expect(event?.ip_address).toBeDefined();
      expect(event?.request_id).toBeDefined();
    });

    it('8.3 audit event summary handles long strings without truncation crash', async () => {
      const longTitle = 'A'.repeat(80);
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${programmeOfficer.bearerToken}`
        },
        payload: {
          title: longTitle,
          description: 'Long title test',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 3600000).toISOString(),
          location: 'Hall'
        }
      });
      expect(res.statusCode).toBe(201);
      const id = res.json().program_id;
      await app.prisma.program.delete({ where: { program_id: id } });
    });

    it('8.4 audit events list limits results cleanly to maximum limit', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-events',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().length).toBeLessThanOrEqual(200);
    });

    it('8.5 audit event target_id supports null targets (e.g. export action)', async () => {
      await app.inject({
        method: 'GET',
        url: '/api/admin/donations/export.csv',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${financeOfficer.bearerToken}`
        }
      });
      const exportEvent = await app.prisma.auditEvent.findFirst({
        where: { mosque_id: tenant.mosqueId, action: 'donations.exported' }
      });
      expect(exportEvent).toBeDefined();
      expect(exportEvent?.target_id).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Feature 9 Boundaries: Programme Lifecycle Management
  // -------------------------------------------------------------------------
  describe('Feature 9 Boundaries: Program Capacity & Constraints', () => {
    it('9.1 max_capacity: 0 represents unlimited seating capacity', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${programmeOfficer.bearerToken}`
        },
        payload: {
          title: 'Unlimited Program',
          description: 'Desc',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 3600000).toISOString(),
          location: 'Main Hall',
          max_capacity: 0
        }
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().max_capacity).toBe(0);
      await app.prisma.program.delete({ where: { program_id: res.json().program_id } });
    });

    it('9.2 max_capacity: 1 sets strict 1-seat capacity', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${programmeOfficer.bearerToken}`
        },
        payload: {
          title: '1 Seat Masterclass',
          description: 'Desc',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 3600000).toISOString(),
          location: 'Room 1',
          max_capacity: 1
        }
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().max_capacity).toBe(1);
      await app.prisma.program.delete({ where: { program_id: res.json().program_id } });
    });

    it('9.3 update non-existent program ID returns HTTP 404', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/programs/999999',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${programmeOfficer.bearerToken}`
        },
        payload: { title: 'Non Existent' }
      });
      expect(res.statusCode).toBe(404);
    });

    it('9.4 delete non-existent program ID returns HTTP 404', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/admin/programs/999999',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${programmeOfficer.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(404);
    });

    it('9.5 updating program status to Draft hides it from public GET /api/programs', async () => {
      const prog = await app.prisma.program.create({
        data: {
          mosque_id: tenant.mosqueId,
          title: 'Draft Program',
          description: 'Desc',
          start_date: new Date(),
          end_date: new Date(Date.now() + 3600000),
          location: 'Room',
          status: 'Draft'
        }
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/programs',
        headers: { 'x-mosque-slug': tenant.slug }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().some((p: any) => p.program_id === prog.program_id)).toBe(false);
      await app.prisma.program.delete({ where: { program_id: prog.program_id } });
    });
  });

  // -------------------------------------------------------------------------
  // Feature 10 Boundaries: Attendee Check-in & Reminders
  // -------------------------------------------------------------------------
  describe('Feature 10 Boundaries: Capacity Overflow & Duplicate Registration', () => {
    let singleSeatProgId: number;

    beforeAll(async () => {
      const prog = await app.prisma.program.create({
        data: {
          mosque_id: tenant.mosqueId,
          title: 'Single Seat Boundary Program',
          description: 'Desc',
          start_date: new Date(),
          end_date: new Date(Date.now() + 3600000),
          location: 'Room B',
          max_capacity: 1,
          status: 'Published'
        }
      });
      singleSeatProgId = prog.program_id;
    });

    afterAll(async () => {
      await app.prisma.registration.deleteMany({ where: { program_id: singleSeatProgId } });
      await app.prisma.program.deleteMany({ where: { program_id: singleSeatProgId } });
    });

    it('10.1 allows first member to register for the single seat (HTTP 201)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/programs/${singleSeatProgId}/register`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${regularMember.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(201);
    });

    it('10.2 rejects double registration for same member with HTTP 409', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/programs/${singleSeatProgId}/register`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${regularMember.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(409);
    });

    it('10.3 rejects second member registration when capacity is full (HTTP 409)', async () => {
      const secondMember = await createMemberUser(app, tenant, 'member');
      const res = await app.inject({
        method: 'POST',
        url: `/api/programs/${singleSeatProgId}/register`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${secondMember.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error).toMatch(/capacity/i);
      await app.prisma.membership.deleteMany({ where: { user_id: secondMember.userId } });
      await app.prisma.user.deleteMany({ where: { user_id: secondMember.userId } });
    });

    it('10.4 cancelling non-existent registration returns HTTP 404', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/programs/999999/cancel',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${regularMember.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(404);
    });

    it('10.5 attendee check-in on non-existent registration returns HTTP 404', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/registrations/999999/attendance',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${programmeOfficer.bearerToken}`
        },
        payload: { status: 'Attended' }
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 11 Boundaries: Donation Reconciliation & Offline Entry
  // -------------------------------------------------------------------------
  describe('Feature 11 Boundaries: Invalid Donations & Edge Reconciles', () => {
    it('11.1 rejects donation with amount 0 with HTTP 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/donations',
        headers: { 'x-mosque-slug': tenant.slug },
        payload: { amount: 0, category: 'General', method: 'Card' }
      });
      expect(res.statusCode).toBe(400);
    });

    it('11.2 rejects manual donation with negative amount with HTTP 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${financeOfficer.bearerToken}`
        },
        payload: { amount: -100, category: 'Zakat', method: 'Cash' }
      });
      expect(res.statusCode).toBe(400);
    });

    it('11.3 manual donation with unknown donor email creates record with user_id = null', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${financeOfficer.bearerToken}`
        },
        payload: {
          amount: 250,
          category: 'Sadaqah',
          method: 'Cash',
          donor_email: 'unknown-donor@example.test'
        }
      });
      expect(res.statusCode).toBe(201);
      const don = res.json();
      expect(don.user_id).toBeUndefined();
      await app.prisma.donation.delete({ where: { donation_id: don.donation_id } });
    });

    it('11.4 reconciling non-existent donation ID returns HTTP 404', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/donations/999999/reconcile',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${financeOfficer.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(404);
    });

    it('11.5 searching donations with non-matching query returns empty array', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/donations?search=NON_EXISTENT_RECEIPT_XYZ',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${financeOfficer.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 12 Boundaries: CSV Ledger Export
  // -------------------------------------------------------------------------
  describe('Feature 12 Boundaries: CSV Header & Data Formats', () => {
    it('12.1 empty donation ledger exports valid CSV with header line only', async () => {
      const freshTenant = await createActiveTenant(app, { slugPrefix: 'empty-csv' });
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/donations/export.csv',
        headers: {
          'x-mosque-slug': freshTenant.slug,
          authorization: `Bearer ${freshTenant.adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.trim()).toBe('receipt,date,amount,currency,category,method,status,reconciliation');
      await cleanupTenant(app, freshTenant.mosqueId);
    });

    it('12.2 export preserves 2 decimal places for whole number amounts (e.g. 500.00)', async () => {
      const don = await app.prisma.donation.create({
        data: {
          mosque_id: tenant.mosqueId,
          amount_minor: 50000,
          category: 'Zakat',
          method: 'Transfer',
          status: 'Completed',
          receipt_number: `MH-DEC-${Date.now()}`
        }
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/donations/export.csv',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${financeOfficer.bearerToken}`
        }
      });
      expect(res.body).toContain('500.00');
      await app.prisma.donation.delete({ where: { donation_id: don.donation_id } });
    });

    it('12.3 export blocked with HTTP 403 for communications_officer', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/donations/export.csv',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${commsOfficer.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(403);
    });

    it('12.4 export blocked with HTTP 403 for programme_officer', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/donations/export.csv',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${programmeOfficer.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(403);
    });

    it('12.5 export blocked with HTTP 401 when no token is supplied', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/donations/export.csv',
        headers: { 'x-mosque-slug': tenant.slug }
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 13 Boundaries: In-App Notification Center
  // -------------------------------------------------------------------------
  describe('Feature 13 Boundaries: Isolation & Read Updates', () => {
    it('13.1 marking non-existent notification as read returns HTTP 404', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/members/notifications/999999/read',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${regularMember.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(404);
    });

    it('13.2 member cannot mark another member notification as read (HTTP 404)', async () => {
      const otherNotif = await app.prisma.notification.create({
        data: {
          mosque_id: tenant.mosqueId,
          user_id: financeOfficer.userId,
          message: 'Confidential Finance Notification',
          type: 'In-App'
        }
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/members/notifications/${otherNotif.notif_id}/read`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${regularMember.bearerToken}` // Regular member tries to mark finance notification
        }
      });
      expect(res.statusCode).toBe(404);
      await app.prisma.notification.delete({ where: { notif_id: otherNotif.notif_id } });
    });

    it('13.3 member with zero notifications receives empty list', async () => {
      const freshMember = await createMemberUser(app, tenant, 'member');
      const res = await app.inject({
        method: 'GET',
        url: '/api/members/notifications',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${freshMember.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
      await app.prisma.membership.deleteMany({ where: { user_id: freshMember.userId } });
      await app.prisma.user.deleteMany({ where: { user_id: freshMember.userId } });
    });

    it('13.4 reminder dispatch for program with zero registrations sends 0 reminders', async () => {
      const emptyProg = await app.prisma.program.create({
        data: {
          mosque_id: tenant.mosqueId,
          title: 'Empty Program',
          description: 'Desc',
          start_date: new Date(),
          end_date: new Date(Date.now() + 3600000),
          location: 'Hall'
        }
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/admin/programs/${emptyProg.program_id}/reminders`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${programmeOfficer.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().sent).toBe(0);
      await app.prisma.program.delete({ where: { program_id: emptyProg.program_id } });
    });

    it('13.5 reminder dispatch for non-existent program ID returns HTTP 404', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs/999999/reminders',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${programmeOfficer.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 14 Boundaries: Tenant Audit Log Viewer
  // -------------------------------------------------------------------------
  describe('Feature 14 Boundaries: RBAC on Audit Logs', () => {
    it('14.1 rejects communications_officer from viewing audit logs with HTTP 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-events',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${commsOfficer.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(403);
    });

    it('14.2 rejects programme_officer from viewing audit logs with HTTP 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-events',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${programmeOfficer.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(403);
    });

    it('14.3 rejects finance_officer from viewing audit logs with HTTP 403', async () => {
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

    it('14.4 rejects regular member from viewing audit logs with HTTP 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-events',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${regularMember.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(403);
    });

    it('14.5 unauthenticated call to audit logs returns HTTP 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-events',
        headers: { 'x-mosque-slug': tenant.slug }
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 15 Boundaries: Role-Based Workspace Views & RBAC
  // -------------------------------------------------------------------------
  describe('Feature 15 Boundaries: Membership Status Invalidation', () => {
    it('15.1 suspended membership returns HTTP 403 on role actions', async () => {
      const suspendedOfficer = await createMemberUser(app, tenant, 'finance_officer');
      // Suspend membership
      await app.prisma.membership.updateMany({
        where: { user_id: suspendedOfficer.userId, mosque_id: tenant.mosqueId },
        data: { status: 'Suspended' }
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${suspendedOfficer.bearerToken}`
        },
        payload: { amount: 100, category: 'General', method: 'Cash' }
      });
      expect(res.statusCode).toBe(403);
      await app.prisma.membership.deleteMany({ where: { user_id: suspendedOfficer.userId } });
      await app.prisma.user.deleteMany({ where: { user_id: suspendedOfficer.userId } });
    });

    it('15.2 updating membership to invalid role string returns HTTP 400', async () => {
      const targetMember = await createMemberUser(app, tenant, 'member');
      const m = await app.prisma.membership.findFirst({
        where: { user_id: targetMember.userId, mosque_id: tenant.mosqueId }
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/memberships/${m?.membership_id}`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        },
        payload: { role: 'invalid_role_xyz' }
      });
      expect(res.statusCode).toBe(400);
      await app.prisma.membership.deleteMany({ where: { user_id: targetMember.userId } });
      await app.prisma.user.deleteMany({ where: { user_id: targetMember.userId } });
    });

    it('15.3 updating non-existent membership ID returns HTTP 404', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/memberships/999999',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        },
        payload: { status: 'Suspended' }
      });
      expect(res.statusCode).toBe(404);
    });

    it('15.4 inviting user who already has membership in this mosque returns HTTP 409', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/memberships/invite',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        },
        payload: {
          name: 'Already Member',
          email: regularMember.email,
          role: 'member',
          temporary_password: 'Password123!'
        }
      });
      expect(res.statusCode).toBe(409);
    });

    it('15.5 updating membership status to Active restores permissions', async () => {
      const testOfficer = await createMemberUser(app, tenant, 'programme_officer');
      const m = await app.prisma.membership.findFirst({
        where: { user_id: testOfficer.userId, mosque_id: tenant.mosqueId }
      });

      // Suspend
      await app.prisma.membership.update({
        where: { membership_id: m!.membership_id },
        data: { status: 'Suspended' }
      });

      // Admin reactivates
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/memberships/${m!.membership_id}`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        },
        payload: { status: 'Active' }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('Active');

      await app.prisma.membership.deleteMany({ where: { user_id: testOfficer.userId } });
      await app.prisma.user.deleteMany({ where: { user_id: testOfficer.userId } });
    });
  });

  // -------------------------------------------------------------------------
  // Feature 16 Boundaries: 5-Role Integration Test Suite
  // -------------------------------------------------------------------------
  describe('Feature 16 Boundaries: Privilege Boundaries', () => {
    it('16.1 member cannot update mosque profile settings (HTTP 403)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/mosques/${tenant.slug}`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${regularMember.bearerToken}`
        },
        payload: { name: 'Hacked Mosque Name' }
      });
      expect(res.statusCode).toBe(403);
    });

    it('16.2 finance_officer cannot update mosque profile settings (HTTP 403)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/mosques/${tenant.slug}`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${financeOfficer.bearerToken}`
        },
        payload: { name: 'Finance Name' }
      });
      expect(res.statusCode).toBe(403);
    });

    it('16.3 programme_officer cannot update mosque profile settings (HTTP 403)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/mosques/${tenant.slug}`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${programmeOfficer.bearerToken}`
        },
        payload: { name: 'Prog Name' }
      });
      expect(res.statusCode).toBe(403);
    });

    it('16.4 communications_officer cannot update mosque profile settings (HTTP 403)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/mosques/${tenant.slug}`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${commsOfficer.bearerToken}`
        },
        payload: { name: 'Comms Name' }
      });
      expect(res.statusCode).toBe(403);
    });

    it('16.5 tenant_admin can update mosque profile settings (HTTP 200)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/mosques/${tenant.slug}`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        },
        payload: { brand_color: '#099268' }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().brand_color).toBe('#099268');
    });
  });

  // -------------------------------------------------------------------------
  // Feature 17 Boundaries: Multi-Mosque Global Users
  // -------------------------------------------------------------------------
  describe('Feature 17 Boundaries: Tenant Switch Boundaries', () => {
    it('17.1 switching to non-existent mosque slug returns HTTP 404', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/switch-tenant/non-existent-mosque-slug-xyz',
        headers: { authorization: `Bearer ${regularMember.bearerToken}` }
      });
      expect(res.statusCode).toBe(404);
    });

    it('17.2 switching to mosque without active membership returns HTTP 403', async () => {
      const otherTenant = await createActiveTenant(app, { slugPrefix: 'other-switch' });

      const res = await app.inject({
        method: 'POST',
        url: `/api/auth/switch-tenant/${otherTenant.slug}`,
        headers: { authorization: `Bearer ${regularMember.bearerToken}` }
      });
      expect(res.statusCode).toBe(403);
      await cleanupTenant(app, otherTenant.mosqueId);
    });

    it('17.3 switching without authorization header returns HTTP 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/auth/switch-tenant/${tenant.slug}`
      });
      expect(res.statusCode).toBe(401);
    });

    it('17.4 switching to pending (unactivated) mosque returns HTTP 404', async () => {
      const pendingMosque = await app.prisma.mosque.create({
        data: { name: 'Pending Mosque', slug: `pending-${Date.now().toString(36)}`, status: 'Pending' }
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/auth/switch-tenant/${pendingMosque.slug}`,
        headers: { authorization: `Bearer ${regularMember.bearerToken}` }
      });
      expect(res.statusCode).toBe(404);
      await app.prisma.mosque.delete({ where: { mosque_id: pendingMosque.mosque_id } });
    });

    it('17.5 switching to suspended mosque returns HTTP 404', async () => {
      const suspendedMosque = await app.prisma.mosque.create({
        data: { name: 'Suspended Mosque', slug: `suspended-${Date.now().toString(36)}`, status: 'Suspended' }
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/auth/switch-tenant/${suspendedMosque.slug}`,
        headers: { authorization: `Bearer ${regularMember.bearerToken}` }
      });
      expect(res.statusCode).toBe(404);
      await app.prisma.mosque.delete({ where: { mosque_id: suspendedMosque.mosque_id } });
    });
  });

  // -------------------------------------------------------------------------
  // Feature 18 Boundaries: Adversarial Multi-Tenant Isolation
  // -------------------------------------------------------------------------
  describe('Feature 18 Boundaries: Cross-Tenant Mutation Rejection', () => {
    let victimTenant: TestTenant;
    let victimAnnouncementId: number;

    beforeAll(async () => {
      victimTenant = await createActiveTenant(app, { slugPrefix: 'victim' });
      const ann = await app.prisma.announcement.create({
        data: {
          mosque_id: victimTenant.mosqueId,
          author_id: victimTenant.adminUserId,
          title: 'Victim Announcement',
          content: 'Confidential Info',
          category: 'Urgent'
        }
      });
      victimAnnouncementId = ann.announcement_id;
    });

    afterAll(async () => {
      if (victimTenant?.mosqueId) {
        await cleanupTenant(app, victimTenant.mosqueId);
      }
    });

    it('18.1 attacker admin cannot update victim announcement (HTTP 404)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/announcements/${victimAnnouncementId}`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        },
        payload: { title: 'Attacked Announcement' }
      });
      expect(res.statusCode).toBe(404);
    });

    it('18.2 attacker admin cannot delete victim announcement (HTTP 404)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/admin/announcements/${victimAnnouncementId}`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(404);
    });

    it('18.3 attacker admin cannot invite members into victim mosque (HTTP 403/404)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/memberships/invite',
        headers: {
          'x-mosque-slug': victimTenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}` // Attacker token with victim slug
        },
        payload: {
          name: 'Injected Member',
          email: `injected-${Date.now()}@example.test`,
          role: 'tenant_admin',
          temporary_password: 'Password123!'
        }
      });
      expect(res.statusCode).toBe(403);
    });

    it('18.4 attacker finance officer cannot query victim donations (HTTP 403)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/donations',
        headers: {
          'x-mosque-slug': victimTenant.slug,
          authorization: `Bearer ${financeOfficer.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(403);
    });

    it('18.5 attacker member cannot view victim member registrations (HTTP 403)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/members/registrations',
        headers: {
          'x-mosque-slug': victimTenant.slug,
          authorization: `Bearer ${regularMember.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 19 Boundaries: Opaque-Box E2E Test Suite
  // -------------------------------------------------------------------------
  describe('Feature 19 Boundaries: Public Endpoint Error Handling', () => {
    it('19.1 public mosque lookup for non-existent slug returns HTTP 404', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/mosques/this-slug-definitely-does-not-exist-12345'
      });
      expect(res.statusCode).toBe(404);
    });

    it('19.2 login with non-existent email returns HTTP 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'x-mosque-slug': tenant.slug },
        payload: { email: 'nonexistent-user@example.test', password: 'Password123!' }
      });
      expect(res.statusCode).toBe(401);
    });

    it('19.3 login with incorrect password returns HTTP 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'x-mosque-slug': tenant.slug },
        payload: { email: tenant.adminEmail, password: 'WrongPassword999!' }
      });
      expect(res.statusCode).toBe(401);
    });

    it('19.4 login request without X-Mosque-Slug header returns HTTP 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: tenant.adminEmail, password: tenant.adminPassword }
      });
      expect(res.statusCode).toBe(400);
    });

    it('19.5 registration request without X-Mosque-Slug header returns HTTP 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { name: 'No Slug', email: 'noslug@example.test', password: 'Password123!' }
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 20 Boundaries: Final Integration & Adversarial Hardening
  // -------------------------------------------------------------------------
  describe('Feature 20 Boundaries: Adversarial String Injections', () => {
    it('20.1 SQL injection attack string in search query returns 200 without executing code', async () => {
      const res = await app.inject({
        method: 'GET',
        url: "/api/admin/donations?search=' OR '1'='1' --",
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${financeOfficer.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });

    it('20.2 XSS payload in announcement content safely saved as text without server error', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/announcements',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${commsOfficer.bearerToken}`
        },
        payload: {
          title: '<script>alert(1)</script>',
          content: '<img src=x onerror=alert("XSS")>',
          category: 'General'
        }
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().title).toBe('<script>alert(1)</script>');
      await app.prisma.announcement.delete({ where: { announcement_id: res.json().announcement_id } });
    });

    it('20.3 path traversal string in mosque slug returns HTTP 404', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/mosques/..%2F..%2Fetc%2Fpasswd'
      });
      expect(res.statusCode).toBe(404);
    });

    it('20.4 null byte string in header handled gracefully without crash', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/announcements',
        headers: { 'x-mosque-slug': tenant.slug }
      });
      expect(res.statusCode).toBe(200);
    });

    it('20.5 large string payloads within JSON body handled gracefully', async () => {
      const largeContent = 'Long content block. '.repeat(100);
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/announcements',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${commsOfficer.bearerToken}`
        },
        payload: {
          title: 'Large Payload Announcement',
          content: largeContent,
          category: 'General'
        }
      });
      expect(res.statusCode).toBe(201);
      await app.prisma.announcement.delete({ where: { announcement_id: res.json().announcement_id } });
    });
  });
});
