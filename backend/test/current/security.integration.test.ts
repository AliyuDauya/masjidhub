import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/server.js';

describe('Milestone 2 Security Hardening & Session Integration Tests', () => {
  let app: FastifyInstance;
  const suffix = Date.now().toString(36);
  const slug = `sec-${suffix}`;
  const adminEmail = `secadmin-${suffix}@example.test`;
  const memberEmail = `secmember-${suffix}@example.test`;
  const password = 'SecurityPass123!';

  let mosqueId: number;
  let adminUserId: number;
  let memberUserId: number;
  let adminSessionCookie = '';
  let adminBearerToken = '';
  let memberSessionCookie = '';
  let csrfToken = '';
  let platformBearerToken = '';

  // Helper to extract cookie value by name from Set-Cookie headers
  function extractCookie(headers: Record<string, string | string[] | undefined>, name: string): string {
    const raw = headers['set-cookie'];
    if (!raw) return '';
    const array = Array.isArray(raw) ? raw : [raw];
    for (const cookie of array) {
      const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
      if (match) return match[1];
    }
    return '';
  }

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    // 1. Create a Mosque & Tenant Admin
    const mosqueRes = await app.inject({
      method: 'POST',
      url: '/api/mosques',
      payload: {
        name: 'Security Test Mosque',
        slug,
        admin_name: 'Security Admin',
        admin_email: adminEmail,
        admin_password: password
      }
    });
    expect(mosqueRes.statusCode).toBe(201);
    mosqueId = mosqueRes.json().mosque_id;

    // 2. Activate Mosque via Platform Admin
    const platLogin = await app.inject({
      method: 'POST',
      url: '/api/platform/auth/login',
      payload: { email: 'platform@masjidhub.local', password: 'platformPass123' }
    });
    expect(platLogin.statusCode).toBe(200);
    platformBearerToken = platLogin.json().token;

    const activateRes = await app.inject({
      method: 'PATCH',
      url: `/api/platform/tenants/${mosqueId}/status`,
      headers: { authorization: `Bearer ${platformBearerToken}` },
      payload: { status: 'Active' }
    });
    expect(activateRes.statusCode).toBe(200);

    // 3. Register a Regular Member
    const memberRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: { 'x-mosque-slug': slug },
      payload: { name: 'Security Member', email: memberEmail, password }
    });
    expect(memberRes.statusCode).toBe(201);
    memberUserId = memberRes.json().user.user_id;
    memberSessionCookie = extractCookie(memberRes.headers, 'mh_session');

    // 4. Admin Login to obtain session cookie and bearer token
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'x-mosque-slug': slug },
      payload: { email: adminEmail, password }
    });
    expect(adminLogin.statusCode).toBe(200);
    adminUserId = adminLogin.json().user.user_id;
    adminBearerToken = adminLogin.json().token;
    adminSessionCookie = extractCookie(adminLogin.headers, 'mh_session');

    // 5. Obtain CSRF Token
    const csrfRes = await app.inject({
      method: 'GET',
      url: '/api/auth/csrf'
    });
    expect(csrfRes.statusCode).toBe(200);
    csrfToken = csrfRes.json().csrfToken;
  });

  afterAll(async () => {
    if (mosqueId) {
      await app.prisma.donation.deleteMany({ where: { mosque_id: mosqueId } });
      await app.prisma.registration.deleteMany({ where: { mosque_id: mosqueId } });
      await app.prisma.program.deleteMany({ where: { mosque_id: mosqueId } });
      await app.prisma.announcement.deleteMany({ where: { mosque_id: mosqueId } });
      await app.prisma.notification.deleteMany({ where: { mosque_id: mosqueId } });
      await app.prisma.membership.deleteMany({ where: { mosque_id: mosqueId } });
      await app.prisma.auditEvent.deleteMany({ where: { mosque_id: mosqueId } });
      await app.prisma.mosque.deleteMany({ where: { mosque_id: mosqueId } });
    }
    await app.prisma.user.deleteMany({ where: { email: { in: [adminEmail, memberEmail] } } });
    await app.close();
  });

  // =========================================================================
  // PILLAR 1: HTTP-Only Cookie Session Authentication
  // =========================================================================
  describe('Pillar 1: Cookie-Based Session Authentication', () => {
    it('issues an HTTP-only mh_session cookie upon tenant login', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'x-mosque-slug': slug },
        payload: { email: adminEmail, password }
      });
      expect(res.statusCode).toBe(200);
      const cookieHeader = res.headers['set-cookie'];
      expect(cookieHeader).toBeDefined();
      const cookieStr = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : String(cookieHeader);
      expect(cookieStr).toContain('mh_session=');
      expect(cookieStr.toLowerCase()).toContain('httponly');
      expect(cookieStr.toLowerCase()).toContain('samesite=lax');
      expect(res.json()).toHaveProperty('csrfToken');
    });

    it('issues an HTTP-only mh_session cookie upon member registration', async () => {
      const regEmail = `regtest-${Date.now().toString(36)}@example.test`;
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'x-mosque-slug': slug },
        payload: { name: 'Reg User', email: regEmail, password }
      });
      expect(res.statusCode).toBe(201);
      const cookieHeader = res.headers['set-cookie'];
      expect(cookieHeader).toBeDefined();
      const cookieStr = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : String(cookieHeader);
      expect(cookieStr).toContain('mh_session=');
      expect(cookieStr.toLowerCase()).toContain('httponly');
      expect(res.json()).toHaveProperty('csrfToken');
      await app.prisma.membership.deleteMany({ where: { user: { email: regEmail } } });
      await app.prisma.user.deleteMany({ where: { email: regEmail } });
    });

    it('issues an HTTP-only mh_session cookie upon platform login', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/platform/auth/login',
        payload: { email: 'platform@masjidhub.local', password: 'platformPass123' }
      });
      expect(res.statusCode).toBe(200);
      const cookieHeader = res.headers['set-cookie'];
      expect(cookieHeader).toBeDefined();
      const cookieStr = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : String(cookieHeader);
      expect(cookieStr).toContain('mh_session=');
      expect(res.json()).toHaveProperty('csrfToken');
    });

    it('clears session and csrf cookies upon POST /api/auth/logout', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/logout'
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      const cookieHeader = res.headers['set-cookie'];
      expect(cookieHeader).toBeDefined();
      const cookieStr = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : String(cookieHeader);
      expect(cookieStr).toContain('mh_session=;');
      expect(cookieStr).toContain('mh_csrf=;');
    });

    it('clears session and csrf cookies upon POST /api/platform/auth/logout', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/platform/auth/logout'
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      const cookieHeader = res.headers['set-cookie'];
      expect(cookieHeader).toBeDefined();
      const cookieStr = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : String(cookieHeader);
      expect(cookieStr).toContain('mh_session=;');
    });

    it('authenticates protected endpoints using mh_session cookie header', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          cookie: `mh_session=${adminSessionCookie}`
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().email).toBe(adminEmail);
    });

    it('supports dual-mode fallback to Authorization Bearer header for API clients', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().email).toBe(adminEmail);
    });

    it('rejects protected endpoints with HTTP 401 when no token or cookie is supplied', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me'
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects protected endpoints with HTTP 401 when invalid cookie is provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          cookie: 'mh_session=invalid.tampered.token'
        }
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // =========================================================================
  // PILLAR 2: CSRF Protection on Mutation Routes
  // =========================================================================
  describe('Pillar 2: CSRF Protection', () => {
    it('provides a dedicated GET /api/auth/csrf endpoint returning a token and cookie', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/csrf'
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveProperty('csrfToken');
      expect(typeof res.json().csrfToken).toBe('string');
      const cookieHeader = res.headers['set-cookie'];
      expect(cookieHeader).toBeDefined();
      const cookieStr = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : String(cookieHeader);
      expect(cookieStr).toContain('mh_csrf=');
    });

    it('rejects mutation requests with HTTP 403 when cookie auth is present but CSRF header is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': slug,
          cookie: `mh_session=${adminSessionCookie}`
        },
        payload: {
          title: 'CSRF Blocked Program',
          description: 'Testing CSRF blocking',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 86400000).toISOString(),
          location: 'Hall A',
          max_capacity: 50
        }
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toMatch(/CSRF/i);
    });

    it('rejects mutation requests with HTTP 403 when cookie auth is present and invalid CSRF token is sent', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': slug,
          cookie: `mh_session=${adminSessionCookie}`,
          'x-csrf-token': 'forged.signature123'
        },
        payload: {
          title: 'CSRF Forged Program',
          description: 'Testing CSRF rejection',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 86400000).toISOString(),
          location: 'Hall A',
          max_capacity: 50
        }
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toMatch(/CSRF/i);
    });

    it('allows mutation requests when valid CSRF token accompanies the session cookie', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': slug,
          cookie: `mh_session=${adminSessionCookie}`,
          'x-csrf-token': csrfToken
        },
        payload: {
          title: 'CSRF Allowed Program',
          description: 'Testing valid CSRF token with cookie auth',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 86400000).toISOString(),
          location: 'Hall B',
          max_capacity: 40
        }
      });
      expect(res.statusCode).toBe(201);
      const programId = res.json().program_id;
      await app.prisma.program.delete({ where: { program_id: programId } });
    });

    it('allows safe read methods (GET) without CSRF token when authenticated via cookie', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/members/donations',
        headers: {
          'x-mosque-slug': slug,
          cookie: `mh_session=${adminSessionCookie}`
        }
      });
      expect(res.statusCode).toBe(200);
    });

    it('allows mutation requests when authenticated with Authorization Bearer header (API mode)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        },
        payload: {
          title: 'Bearer Auth Program',
          description: 'Testing bearer bypass for CSRF',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 86400000).toISOString(),
          location: 'Main Hall',
          max_capacity: 50
        }
      });
      expect(res.statusCode).toBe(201);
      const programId = res.json().program_id;
      await app.prisma.program.delete({ where: { program_id: programId } });
    });
  });

  // =========================================================================
  // PILLAR 3: Strict Production CORS & Credentials Handling
  // =========================================================================
  describe('Pillar 3: Strict CORS Configuration', () => {
    it('attaches Access-Control-Allow-Origin and credentials for whitelisted origin', async () => {
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
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('rejects unauthorized origins by omitting Access-Control-Allow-Origin header', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/auth/login',
        headers: {
          origin: 'https://attacker-domain.evil.com',
          'access-control-request-method': 'POST'
        }
      });
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('allows requests without Origin header (curl / server-to-server)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/mosques/${slug}`
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // PILLAR 4: Centralized Schema Validation
  // =========================================================================
  describe('Pillar 4: Centralized Schema Validation', () => {
    it('returns HTTP 400 Bad Request on missing required fields for login', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'x-mosque-slug': slug },
        payload: { email: 'invalid@test.com' } // missing password
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toHaveProperty('error');
    });

    it('returns HTTP 400 Bad Request on invalid donation amount (<= 0)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/donations',
        headers: { 'x-mosque-slug': slug },
        payload: {
          amount: -50,
          category: 'Sadaqah',
          method: 'Transfer'
        }
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/(greater than zero|minimum|amount)/i);
    });

    it('returns HTTP 400 Bad Request on invalid donation category enum', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/donations',
        headers: { 'x-mosque-slug': slug },
        payload: {
          amount: 100,
          category: 'NonExistentCategory',
          method: 'Card'
        }
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/(category|enum|invalid)/i);
    });

    it('returns HTTP 400 Bad Request on manual donation with non-Cash method', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        },
        payload: {
          amount: 500,
          category: 'Zakat',
          method: 'Card' // Only 'Cash' allowed for manual entry
        }
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns HTTP 400 Bad Request on program creation missing title or dates', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        },
        payload: {
          description: 'Incomplete program'
        }
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns HTTP 400 Bad Request on program update with invalid id param', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/programs/not-a-number',
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        },
        payload: {
          title: 'New Title'
        }
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // PILLAR 5: Structured AuditEvent Persistence & Verification
  // =========================================================================
  describe('Pillar 5: AuditEvent Logging Coverage & Integrity', () => {
    it('persists AuditEvent for donation.completed on web donations', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/donations',
        headers: { 'x-mosque-slug': slug },
        payload: { amount: 250, category: 'General', method: 'Card' }
      });
      expect(res.statusCode).toBe(201);
      const donationId = res.json().donation_id;

      const event = await app.prisma.auditEvent.findFirst({
        where: {
          mosque_id: mosqueId,
          action: 'donation.completed',
          target_type: 'Donation',
          target_id: String(donationId)
        }
      });
      expect(event).toBeDefined();
      expect(event?.summary).toContain('Donation receipt');
      expect(event?.request_id).toBeDefined();
      expect(event?.ip_address).toBeDefined();
    });

    it('persists AuditEvent for donation.recorded on manual cash donations', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        },
        payload: { amount: 3000, category: 'Zakat', method: 'Cash' }
      });
      expect(res.statusCode).toBe(201);
      const donationId = res.json().donation_id;

      const event = await app.prisma.auditEvent.findFirst({
        where: {
          mosque_id: mosqueId,
          action: 'donation.recorded',
          target_type: 'Donation',
          target_id: String(donationId)
        }
      });
      expect(event).toBeDefined();
      expect(event?.actor_id).toBe(adminUserId);
      expect(event?.summary).toContain('Offline donation recorded');
    });

    it('persists AuditEvent for donation.reconciled when finance officer reconciles', async () => {
      const don = await app.prisma.donation.create({
        data: {
          mosque_id: mosqueId,
          amount_minor: 10000,
          category: 'Waqf',
          method: 'Transfer',
          status: 'Completed',
          receipt_number: `MH-REC-${Date.now().toString(36).toUpperCase()}`
        }
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/donations/${don.donation_id}/reconcile`,
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);

      const event = await app.prisma.auditEvent.findFirst({
        where: {
          mosque_id: mosqueId,
          action: 'donation.reconciled',
          target_type: 'Donation',
          target_id: String(don.donation_id)
        }
      });
      expect(event).toBeDefined();
      expect(event?.actor_id).toBe(adminUserId);
      expect(event?.summary).toBe('Donation reconciled.');
    });

    it('persists AuditEvent for program lifecycle (created, updated, deleted)', async () => {
      // 1. Create Program
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        },
        payload: {
          title: 'Audit Test Program',
          description: 'Program for audit logging test',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 86400000).toISOString(),
          location: 'Youth Center',
          max_capacity: 30
        }
      });
      expect(createRes.statusCode).toBe(201);
      const programId = createRes.json().program_id;

      const createdEvent = await app.prisma.auditEvent.findFirst({
        where: { mosque_id: mosqueId, action: 'program.created', target_id: String(programId) }
      });
      expect(createdEvent).toBeDefined();
      expect(createdEvent?.actor_id).toBe(adminUserId);

      // 2. Update Program
      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/admin/programs/${programId}`,
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        },
        payload: { title: 'Updated Audit Test Program' }
      });
      expect(updateRes.statusCode).toBe(200);

      const updatedEvent = await app.prisma.auditEvent.findFirst({
        where: { mosque_id: mosqueId, action: 'program.updated', target_id: String(programId) }
      });
      expect(updatedEvent).toBeDefined();

      // 3. Delete Program
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/admin/programs/${programId}`,
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        }
      });
      expect(deleteRes.statusCode).toBe(200);

      const deletedEvent = await app.prisma.auditEvent.findFirst({
        where: { mosque_id: mosqueId, action: 'program.deleted', target_id: String(programId) }
      });
      expect(deletedEvent).toBeDefined();
    });

    it('persists AuditEvent for attendance.recorded on attendee check-in', async () => {
      const program = await app.prisma.program.create({
        data: {
          mosque_id: mosqueId,
          title: 'Attendance Audit Program',
          description: 'Testing attendance logging',
          start_date: new Date(),
          end_date: new Date(Date.now() + 3600000),
          location: 'Hall C'
        }
      });
      const reg = await app.prisma.registration.create({
        data: {
          mosque_id: mosqueId,
          user_id: memberUserId,
          program_id: program.program_id,
          status: 'Registered'
        }
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/registrations/${reg.reg_id}/attendance`,
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        },
        payload: { status: 'Attended' }
      });
      expect(res.statusCode).toBe(200);

      const event = await app.prisma.auditEvent.findFirst({
        where: {
          mosque_id: mosqueId,
          action: 'attendance.recorded',
          target_type: 'Registration',
          target_id: String(reg.reg_id)
        }
      });
      expect(event).toBeDefined();
      expect(event?.actor_id).toBe(adminUserId);
    });

    it('persists AuditEvent for announcement lifecycle (created, updated, deleted)', async () => {
      // 1. Create Announcement
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/admin/announcements',
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        },
        payload: {
          title: 'Audit Announcement',
          content: 'Important community announcement',
          category: 'General',
          audience: 'Public'
        }
      });
      expect(createRes.statusCode).toBe(201);
      const announcementId = createRes.json().announcement_id;

      const createdEvent = await app.prisma.auditEvent.findFirst({
        where: { mosque_id: mosqueId, action: 'announcement.created', target_id: String(announcementId) }
      });
      expect(createdEvent).toBeDefined();

      // 2. Update Announcement
      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/admin/announcements/${announcementId}`,
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        },
        payload: { title: 'Updated Announcement Title' }
      });
      expect(updateRes.statusCode).toBe(200);

      const updatedEvent = await app.prisma.auditEvent.findFirst({
        where: { mosque_id: mosqueId, action: 'announcement.updated', target_id: String(announcementId) }
      });
      expect(updatedEvent).toBeDefined();

      // 3. Delete Announcement
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/admin/announcements/${announcementId}`,
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        }
      });
      expect(deleteRes.statusCode).toBe(200);

      const deletedEvent = await app.prisma.auditEvent.findFirst({
        where: { mosque_id: mosqueId, action: 'announcement.deleted', target_id: String(announcementId) }
      });
      expect(deletedEvent).toBeDefined();
    });

    it('persists AuditEvent for tenant application with request_id and ip_address', async () => {
      const event = await app.prisma.auditEvent.findFirst({
        where: {
          mosque_id: mosqueId,
          action: 'tenant.applied'
        }
      });
      expect(event).toBeDefined();
      expect(event?.request_id).toBeDefined();
      expect(event?.ip_address).toBeDefined();
    });

    it('persists AuditEvent for platform tenant status change with request_id and ip_address', async () => {
      const event = await app.prisma.auditEvent.findFirst({
        where: {
          mosque_id: mosqueId,
          action: 'tenant.active'
        }
      });
      expect(event).toBeDefined();
      expect(event?.request_id).toBeDefined();
      expect(event?.ip_address).toBeDefined();
    });

    it('provides GET /api/admin/audit-events isolated strictly to tenant', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-events',
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      const events = res.json();
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);
      for (const ev of events) {
        expect(ev.mosque_id).toBe(mosqueId);
      }
    });
  });
});
