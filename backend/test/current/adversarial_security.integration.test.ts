import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/server.js';

describe('Milestone 2 Adversarial Stress Tests: Schema Validation, CORS Origins & AuditEvent Integrity', () => {
  let app: FastifyInstance;
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const slug = `adv-${suffix}`;
  const adminEmail = `advadmin-${suffix}@example.test`;
  const memberEmail = `advmember-${suffix}@example.test`;
  const password = 'AdversarialPass123!';

  let mosqueId: number;
  let adminUserId: number;
  let memberUserId: number;
  let adminBearerToken = '';
  let platformBearerToken = '';

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    // 1. Create a Mosque & Tenant Admin
    const mosqueRes = await app.inject({
      method: 'POST',
      url: '/api/mosques',
      payload: {
        name: 'Adversarial Test Mosque',
        slug,
        admin_name: 'Adversarial Admin',
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
      payload: { name: 'Adversarial Member', email: memberEmail, password }
    });
    expect(memberRes.statusCode).toBe(201);
    memberUserId = memberRes.json().user.user_id;

    // 4. Admin Login to obtain bearer token
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'x-mosque-slug': slug },
      payload: { email: adminEmail, password }
    });
    expect(adminLogin.statusCode).toBe(200);
    adminUserId = adminLogin.json().user.user_id;
    adminBearerToken = adminLogin.json().token;
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
  // SECTION 1: Schema Validation Adversarial Fuzzing
  // =========================================================================
  describe('Adversarial Schema Validation & Fuzzing', () => {
    describe('POST /api/auth/register', () => {
      it('rejects missing required fields with HTTP 400', async () => {
        const payloads = [
          {},
          { name: 'Only Name' },
          { email: 'only@email.com' },
          { password: 'OnlyPassword123!' },
          { name: 'Name', email: 'name@email.com' }, // missing password
          { name: 'Name', password: 'Password123!' }  // missing email
        ];
        for (const payload of payloads) {
          const res = await app.inject({
            method: 'POST',
            url: '/api/auth/register',
            headers: { 'x-mosque-slug': slug },
            payload
          });
          expect(res.statusCode).toBe(400);
          expect(res.json()).toHaveProperty('statusCode', 400);
          expect(res.json()).toHaveProperty('error');
        }
      });

      it('rejects type mismatches (numbers, booleans, arrays, objects for string fields) with HTTP 400', async () => {
        const payloads = [
          { name: 12345, email: 'valid@email.com', password: 'Password123!' },
          { name: 'Valid Name', email: true, password: 'Password123!' },
          { name: 'Valid Name', email: ['email@test.com'], password: 'Password123!' },
          { name: 'Valid Name', email: 'valid@email.com', password: { secret: 'Password123!' } },
          { name: 'Valid Name', email: 'valid@email.com', password: 'Password123!', phone: 123456789 }
        ];
        for (const payload of payloads) {
          const res = await app.inject({
            method: 'POST',
            url: '/api/auth/register',
            headers: { 'x-mosque-slug': slug },
            payload
          });
          expect(res.statusCode).toBe(400);
          expect(res.json().statusCode).toBe(400);
          expect(res.json().error).toBeDefined();
        }
      });

      it('rejects payloads with additional forbidden properties with HTTP 400', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/auth/register',
          headers: { 'x-mosque-slug': slug },
          payload: {
            name: 'Valid Name',
            email: 'valid_unique@email.com',
            password: 'Password123!',
            is_admin: true,
            platform_role: 'super_admin',
            malicious_field: '<script>alert(1)</script>'
          }
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().statusCode).toBe(400);
      });

      it('rejects password below minimum length (8 chars) with HTTP 400', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/auth/register',
          headers: { 'x-mosque-slug': slug },
          payload: {
            name: 'Valid Name',
            email: 'shortpass@email.com',
            password: 'short'
          }
        });
        expect(res.statusCode).toBe(400);
      });
    });

    describe('POST /api/auth/login', () => {
      it('rejects missing credentials or type mismatches with HTTP 400', async () => {
        const invalidPayloads = [
          {},
          { email: 'test@example.com' },
          { password: 'Password123!' },
          { email: 99999, password: 'Password123!' },
          { email: 'test@example.com', password: false },
          { email: 'test@example.com', password: 'Password123!', extra: 'unexpected' }
        ];
        for (const payload of invalidPayloads) {
          const res = await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            headers: { 'x-mosque-slug': slug },
            payload
          });
          expect(res.statusCode).toBe(400);
          expect(res.json().statusCode).toBe(400);
        }
      });
    });

    describe('POST /api/mosques', () => {
      it('rejects invalid mosque registration payloads (missing admin details, invalid slug regex) with HTTP 400', async () => {
        const invalidPayloads = [
          {},
          { name: 'Mosque', slug: 'mosque-1' }, // missing admin details
          { name: 'M', slug: 'valid-slug', admin_name: 'Admin', admin_email: 'a@b.com', admin_password: 'Password123!' }, // name too short
          { name: 'Mosque', slug: 'INVALID SLUG WITH SPACES', admin_name: 'Admin', admin_email: 'a@b.com', admin_password: 'Password123!' },
          { name: 'Mosque', slug: 'invalid_slug_with_special_chars!@#', admin_name: 'Admin', admin_email: 'a@b.com', admin_password: 'Password123!' },
          { name: 'Mosque', slug: 'valid-slug', admin_name: 'Admin', admin_email: 'a@b.com', admin_password: 'short' }, // password too short
          { name: 'Mosque', slug: 'valid-slug', admin_name: 'Admin', admin_email: 'a@b.com', admin_password: 'Password123!', extra_prop: 'denied' }
        ];
        for (const payload of invalidPayloads) {
          const res = await app.inject({
            method: 'POST',
            url: '/api/mosques',
            payload
          });
          expect(res.statusCode).toBe(400);
          expect(res.json().statusCode).toBe(400);
        }
      });
    });

    describe('PUT /api/mosques/:slug', () => {
      it('rejects invalid brand_color pattern or boolean type mismatches with HTTP 400', async () => {
        const invalidPayloads = [
          { brand_color: 'not-a-hex-color' },
          { brand_color: '#12345' }, // 5 hex digits instead of 6
          { brand_color: '#GGGGGG' }, // non-hex characters
          { notification_email: 'yes' }, // string instead of boolean
          { notification_in_app: 1 }, // number instead of boolean
          { unknown_setting: true } // unexpected property
        ];
        for (const payload of invalidPayloads) {
          const res = await app.inject({
            method: 'PUT',
            url: `/api/mosques/${slug}`,
            headers: {
              'x-mosque-slug': slug,
              authorization: `Bearer ${adminBearerToken}`
            },
            payload
          });
          expect(res.statusCode).toBe(400);
          expect(res.json().statusCode).toBe(400);
        }
      });
    });

    describe('POST & PUT /api/admin/programs', () => {
      it('rejects missing required program fields with HTTP 400', async () => {
        const invalidPayloads = [
          {},
          { title: 'Only Title' },
          { title: 'T', description: 'Desc', start_date: '2026-09-01T10:00:00Z', end_date: '2026-09-01T12:00:00Z', location: 'Hall' }, // title too short
          { title: 'Title', description: 'Desc', start_date: 'invalid', end_date: '2026-09-01T12:00:00Z', location: 'Hall' }, // date too short
          { title: 'Title', description: 'Desc', start_date: '2026-09-01T10:00:00Z', end_date: '2026-09-01T12:00:00Z' } // missing location
        ];
        for (const payload of invalidPayloads) {
          const res = await app.inject({
            method: 'POST',
            url: '/api/admin/programs',
            headers: {
              'x-mosque-slug': slug,
              authorization: `Bearer ${adminBearerToken}`
            },
            payload
          });
          expect(res.statusCode).toBe(400);
          expect(res.json().statusCode).toBe(400);
        }
      });

      it('rejects type mismatches (string for integer max_capacity, negative numbers) with HTTP 400', async () => {
        const invalidPayloads = [
          {
            title: 'Fuzzed Program',
            description: 'Testing fuzz',
            start_date: '2026-09-01T10:00:00Z',
            end_date: '2026-09-01T12:00:00Z',
            location: 'Main Hall',
            max_capacity: 'fifty' // string instead of integer
          },
          {
            title: 'Fuzzed Program',
            description: 'Testing fuzz',
            start_date: '2026-09-01T10:00:00Z',
            end_date: '2026-09-01T12:00:00Z',
            location: 'Main Hall',
            max_capacity: -10 // negative integer
          },
          {
            title: 'Fuzzed Program',
            description: 'Testing fuzz',
            start_date: '2026-09-01T10:00:00Z',
            end_date: '2026-09-01T12:00:00Z',
            location: 'Main Hall',
            visibility: 'Confidential' // invalid enum
          },
          {
            title: 'Fuzzed Program',
            description: 'Testing fuzz',
            start_date: '2026-09-01T10:00:00Z',
            end_date: '2026-09-01T12:00:00Z',
            location: 'Main Hall',
            status: 'Destroyed' // invalid enum
          }
        ];
        for (const payload of invalidPayloads) {
          const res = await app.inject({
            method: 'POST',
            url: '/api/admin/programs',
            headers: {
              'x-mosque-slug': slug,
              authorization: `Bearer ${adminBearerToken}`
            },
            payload
          });
          expect(res.statusCode).toBe(400);
          expect(res.json().statusCode).toBe(400);
        }
      });

      it('rejects non-integer IDs on PUT and DELETE /api/admin/programs/:id with HTTP 400', async () => {
        const invalidIds = ['abc', 'invalid-uuid-1234', '1.5', '-10', '0'];
        for (const id of invalidIds) {
          const putRes = await app.inject({
            method: 'PUT',
            url: `/api/admin/programs/${id}`,
            headers: {
              'x-mosque-slug': slug,
              authorization: `Bearer ${adminBearerToken}`
            },
            payload: { title: 'Updated Title' }
          });
          expect(putRes.statusCode).toBe(400);

          const delRes = await app.inject({
            method: 'DELETE',
            url: `/api/admin/programs/${id}`,
            headers: {
              'x-mosque-slug': slug,
              authorization: `Bearer ${adminBearerToken}`
            }
          });
          expect(delRes.statusCode).toBe(400);
        }
      });
    });

    describe('POST /api/donations & POST /api/admin/donations/manual', () => {
      it('rejects malformed donation payloads (negative/zero amounts, string amounts, invalid categories) with HTTP 400', async () => {
        const invalidWebDonations = [
          {},
          { amount: -100, category: 'Zakat', method: 'Card' },
          { amount: 0, category: 'Zakat', method: 'Card' },
          { amount: 'one thousand', category: 'Zakat', method: 'Card' },
          { amount: 50, category: 'NonExistentCategory', method: 'Card' },
          { amount: 50, category: 'Zakat', method: 'Cash' }, // Cash is not allowed for web
          { amount: 50, category: 'Zakat', method: 'Card', currency: 'USDD' }, // 4 chars
          { amount: 50, category: 'Zakat', method: 'Card', currency: 'N' }, // 1 char
          { amount: 50, category: 'Zakat', method: 'Card', extra_unauthorized_field: 'exploit' }
        ];

        for (const payload of invalidWebDonations) {
          const res = await app.inject({
            method: 'POST',
            url: '/api/donations',
            headers: { 'x-mosque-slug': slug },
            payload
          });
          expect(res.statusCode).toBe(400);
          expect(res.json().statusCode).toBe(400);
        }
      });

      it('rejects non-Cash method and malformed inputs on manual cash donations with HTTP 400', async () => {
        const invalidManualDonations = [
          { amount: 100, category: 'Zakat', method: 'Card' }, // Card forbidden for manual
          { amount: 100, category: 'Zakat', method: 'Transfer' }, // Transfer forbidden for manual
          { amount: -50, category: 'General', method: 'Cash' },
          { amount: 0, category: 'General', method: 'Cash' },
          { amount: 'fifty', category: 'General', method: 'Cash' },
          { amount: 50, category: 'InvalidCategory', method: 'Cash' }
        ];

        for (const payload of invalidManualDonations) {
          const res = await app.inject({
            method: 'POST',
            url: '/api/admin/donations/manual',
            headers: {
              'x-mosque-slug': slug,
              authorization: `Bearer ${adminBearerToken}`
            },
            payload
          });
          expect(res.statusCode).toBe(400);
          expect(res.json().statusCode).toBe(400);
        }
      });

      it('rejects non-integer donation ID on PATCH /api/admin/donations/:id/reconcile with HTTP 400', async () => {
        const invalidIds = ['not-a-number', 'xyz', '-1', '0', '3.14'];
        for (const id of invalidIds) {
          const res = await app.inject({
            method: 'PATCH',
            url: `/api/admin/donations/${id}/reconcile`,
            headers: {
              'x-mosque-slug': slug,
              authorization: `Bearer ${adminBearerToken}`
            }
          });
          expect(res.statusCode).toBe(400);
        }
      });
    });

    describe('POST & PUT /api/admin/announcements', () => {
      it('rejects malformed announcement payloads with HTTP 400', async () => {
        const invalidPayloads = [
          {},
          { title: 'Only Title' },
          { title: 'T', content: 'Valid Content', category: 'General' }, // title too short
          { title: 'Title', content: 'Valid Content', category: 'UrgentNews' }, // invalid category enum
          { title: 'Title', content: 'Valid Content', category: 'General', audience: 'AllHumans' }, // invalid audience
          { title: 'Title', content: 'Valid Content', category: 'General', status: 'Trash' }, // invalid status
          { title: 'Title', content: 'Valid Content', category: 'General', unknown_field: 123 }
        ];

        for (const payload of invalidPayloads) {
          const res = await app.inject({
            method: 'POST',
            url: '/api/admin/announcements',
            headers: {
              'x-mosque-slug': slug,
              authorization: `Bearer ${adminBearerToken}`
            },
            payload
          });
          expect(res.statusCode).toBe(400);
          expect(res.json().statusCode).toBe(400);
        }
      });

      it('rejects non-integer ID on PUT and DELETE /api/admin/announcements/:id with HTTP 400', async () => {
        const invalidIds = ['not-valid', '0', '-99', 'uuid-style-param'];
        for (const id of invalidIds) {
          const putRes = await app.inject({
            method: 'PUT',
            url: `/api/admin/announcements/${id}`,
            headers: {
              'x-mosque-slug': slug,
              authorization: `Bearer ${adminBearerToken}`
            },
            payload: { title: 'Updated' }
          });
          expect(putRes.statusCode).toBe(400);

          const delRes = await app.inject({
            method: 'DELETE',
            url: `/api/admin/announcements/${id}`,
            headers: {
              'x-mosque-slug': slug,
              authorization: `Bearer ${adminBearerToken}`
            }
          });
          expect(delRes.statusCode).toBe(400);
        }
      });
    });

    describe('Attendance Check-In & Membership Schemas', () => {
      it('rejects invalid attendance check-in status or non-integer registration ID with HTTP 400', async () => {
        const invalidCheckIns = [
          { url: '/api/admin/registrations/not-an-id/attendance', payload: { status: 'Attended' } },
          { url: '/api/admin/registrations/0/attendance', payload: { status: 'Attended' } },
          { url: '/api/admin/registrations/1/attendance', payload: { status: 'Present' } }, // invalid enum
          { url: '/api/admin/registrations/1/attendance', payload: { status: 123 } }, // type mismatch
          { url: '/api/admin/registrations/1/attendance', payload: { status: 'Attended', extra: true } }
        ];

        for (const testCase of invalidCheckIns) {
          const res = await app.inject({
            method: 'PATCH',
            url: testCase.url,
            headers: {
              'x-mosque-slug': slug,
              authorization: `Bearer ${adminBearerToken}`
            },
            payload: testCase.payload
          });
          expect(res.statusCode).toBe(400);
        }
      });

      it('rejects invalid membership invite and update schemas with HTTP 400', async () => {
        const invalidInvites = [
          {},
          { name: 'User', email: 'user@test.com' }, // missing password
          { name: 'User', email: 'user@test.com', temporary_password: 'short', role: 'member' }, // password < 8
          { name: 'User', email: 'user@test.com', temporary_password: 'Password123!', role: 'super_admin' }, // role not allowed for mosque invite
          { name: 'User', email: 'user@test.com', temporary_password: 'Password123!', role: 'member', extra_field: 456 }
        ];

        for (const payload of invalidInvites) {
          const res = await app.inject({
            method: 'POST',
            url: '/api/admin/memberships/invite',
            headers: {
              'x-mosque-slug': slug,
              authorization: `Bearer ${adminBearerToken}`
            },
            payload
          });
          expect(res.statusCode).toBe(400);
        }

        const invalidUpdates = [
          { id: 'not-an-id', payload: { role: 'finance_officer' } },
          { id: '1', payload: { role: 'hacker_role' } },
          { id: '1', payload: { status: 'Deleted' } },
          { id: '1', payload: { role: 'finance_officer', unexpected_prop: 'bad' } }
        ];

        for (const testCase of invalidUpdates) {
          const res = await app.inject({
            method: 'PATCH',
            url: `/api/admin/memberships/${testCase.id}`,
            headers: {
              'x-mosque-slug': slug,
              authorization: `Bearer ${adminBearerToken}`
            },
            payload: testCase.payload
          });
          expect(res.statusCode).toBe(400);
        }
      });
    });
  });

  // =========================================================================
  // SECTION 2: CORS Origin Validation & Hostile Origins
  // =========================================================================
  describe('Adversarial CORS Origin Validation', () => {
    const maliciousOrigins = [
      'http://evil.com',
      'https://attacker.org',
      'http://localhost:3000.evil.com',
      'http://attacker-localhost:3000',
      'http://localhost:9999',
      'http://127.0.0.1:8080',
      'null',
      'https://subdomain.localhost:3000',
      'http://localhost:3001'
    ];

    const whitelistedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5000',
      'http://127.0.0.1:5000'
    ];

    it('strictly omits Access-Control-Allow-Origin for all unauthorized and malicious origins on preflight OPTIONS', async () => {
      for (const origin of maliciousOrigins) {
        const res = await app.inject({
          method: 'OPTIONS',
          url: '/api/auth/login',
          headers: {
            origin,
            'access-control-request-method': 'POST',
            'access-control-request-headers': 'Content-Type, X-Mosque-Slug'
          }
        });
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
      }
    });

    it('strictly omits Access-Control-Allow-Origin for malicious origins on actual POST/GET requests', async () => {
      for (const origin of maliciousOrigins) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          headers: {
            origin,
            'x-mosque-slug': slug
          },
          payload: { email: adminEmail, password }
        });
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
      }
    });

    it('correctly returns Access-Control-Allow-Origin and credentials: true for whitelisted origins', async () => {
      for (const origin of whitelistedOrigins) {
        const res = await app.inject({
          method: 'OPTIONS',
          url: '/api/auth/login',
          headers: {
            origin,
            'access-control-request-method': 'POST',
            'access-control-request-headers': 'Content-Type, X-Mosque-Slug'
          }
        });
        expect(res.statusCode).toBe(204);
        expect(res.headers['access-control-allow-origin']).toBe(origin);
        expect(res.headers['access-control-allow-credentials']).toBe('true');
        expect(res.headers['access-control-max-age']).toBe('86400');
      }
    });

    it('exposes Set-Cookie and X-CSRF-Token headers in CORS response', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/auth/login',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'POST'
        }
      });
      const exposed = res.headers['access-control-expose-headers'];
      expect(exposed).toBeDefined();
      expect(String(exposed).toLowerCase()).toContain('set-cookie');
      expect(String(exposed).toLowerCase()).toContain('x-csrf-token');
    });
  });

  // =========================================================================
  // SECTION 3: Consecutive Admin Actions & AuditEvent Integrity
  // =========================================================================
  describe('Consecutive Admin Actions Pipeline & AuditEvent Integrity Verification', () => {
    it('executes a sequence of 15+ consecutive administrative actions and confirms strict request_id & ip_address non-null persistence for each', async () => {
      const customIp = '198.51.100.42';

      // 1. Update Mosque Settings
      const updateMosqueRes = await app.inject({
        method: 'PUT',
        url: `/api/mosques/${slug}`,
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`,
          'x-forwarded-for': customIp
        },
        payload: {
          name: 'Updated Pipeline Mosque',
          timezone: 'Africa/Lagos',
          brand_color: '#10b981'
        }
      });
      expect(updateMosqueRes.statusCode).toBe(200);

      // 2. Invite a new officer
      const officerEmail = `officer-${suffix}@example.test`;
      const inviteRes = await app.inject({
        method: 'POST',
        url: '/api/admin/memberships/invite',
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`,
          'x-forwarded-for': customIp
        },
        payload: {
          name: 'Pipeline Programme Officer',
          email: officerEmail,
          role: 'programme_officer',
          temporary_password: 'TempPassword123!'
        }
      });
      expect(inviteRes.statusCode).toBe(201);
      const officerMembershipId = inviteRes.json().membership_id;

      // 3. Update Officer Membership permissions
      const updateMemberRes = await app.inject({
        method: 'PATCH',
        url: `/api/admin/memberships/${officerMembershipId}`,
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`,
          'x-forwarded-for': customIp
        },
        payload: {
          role: 'programme_officer',
          status: 'Active'
        }
      });
      expect(updateMemberRes.statusCode).toBe(200);

      // 4. Create Announcement
      const annCreateRes = await app.inject({
        method: 'POST',
        url: '/api/admin/announcements',
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`,
          'x-forwarded-for': customIp
        },
        payload: {
          title: 'Pipeline Announcement',
          content: 'Testing consecutive audit logging',
          category: 'General',
          audience: 'Public'
        }
      });
      expect(annCreateRes.statusCode).toBe(201);
      const announcementId = annCreateRes.json().announcement_id;

      // 5. Update Announcement
      const annUpdateRes = await app.inject({
        method: 'PUT',
        url: `/api/admin/announcements/${announcementId}`,
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`,
          'x-forwarded-for': customIp
        },
        payload: {
          title: 'Updated Pipeline Announcement'
        }
      });
      expect(annUpdateRes.statusCode).toBe(200);

      // 6. Create Programme
      const progCreateRes = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`,
          'x-forwarded-for': customIp
        },
        payload: {
          title: 'Pipeline Programme',
          description: 'Testing audit integrity',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 7200000).toISOString(),
          location: 'Conference Room 1',
          max_capacity: 50
        }
      });
      expect(progCreateRes.statusCode).toBe(201);
      const programId = progCreateRes.json().program_id;

      // 7. Update Programme
      const progUpdateRes = await app.inject({
        method: 'PUT',
        url: `/api/admin/programs/${programId}`,
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`,
          'x-forwarded-for': customIp
        },
        payload: {
          max_capacity: 60
        }
      });
      expect(progUpdateRes.statusCode).toBe(200);

      // 8. Register Member for Programme
      const regRes = await app.inject({
        method: 'POST',
        url: `/api/programs/${programId}/register`,
        headers: {
          'x-mosque-slug': slug,
          cookie: `mh_session=${(await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            headers: { 'x-mosque-slug': slug },
            payload: { email: memberEmail, password }
          })).headers['set-cookie']}`
        }
      });
      expect(regRes.statusCode).toBe(201);
      const regId = regRes.json().reg_id;

      // 9. Mark Attendee Check-In
      const checkInRes = await app.inject({
        method: 'PATCH',
        url: `/api/admin/registrations/${regId}/attendance`,
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`,
          'x-forwarded-for': customIp
        },
        payload: { status: 'Attended' }
      });
      expect(checkInRes.statusCode).toBe(200);

      // 10. Send Programme Reminders
      const reminderRes = await app.inject({
        method: 'POST',
        url: `/api/admin/programs/${programId}/reminders`,
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`,
          'x-forwarded-for': customIp
        }
      });
      expect(reminderRes.statusCode).toBe(200);

      // 11. Record Manual Cash Donation
      const cashDonRes = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`,
          'x-forwarded-for': customIp
        },
        payload: {
          amount: 5000,
          category: 'Zakat',
          method: 'Cash'
        }
      });
      expect(cashDonRes.statusCode).toBe(201);
      const donationId = cashDonRes.json().donation_id;

      // 12. Reconcile Donation
      const reconcileRes = await app.inject({
        method: 'PATCH',
        url: `/api/admin/donations/${donationId}/reconcile`,
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`,
          'x-forwarded-for': customIp
        }
      });
      expect(reconcileRes.statusCode).toBe(200);

      // 13. Export Donations CSV
      const exportRes = await app.inject({
        method: 'GET',
        url: '/api/admin/donations/export.csv',
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`,
          'x-forwarded-for': customIp
        }
      });
      expect(exportRes.statusCode).toBe(200);

      // 14. Delete Announcement
      const annDelRes = await app.inject({
        method: 'DELETE',
        url: `/api/admin/announcements/${announcementId}`,
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`,
          'x-forwarded-for': customIp
        }
      });
      expect(annDelRes.statusCode).toBe(200);

      // 15. Delete Programme
      const progDelRes = await app.inject({
        method: 'DELETE',
        url: `/api/admin/programs/${programId}`,
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`,
          'x-forwarded-for': customIp
        }
      });
      expect(progDelRes.statusCode).toBe(200);

      // 16. Query All Audit Events for this Mosque from DB
      const allAuditEvents = await app.prisma.auditEvent.findMany({
        where: { mosque_id: mosqueId },
        orderBy: { created_at: 'asc' }
      });

      expect(allAuditEvents.length).toBeGreaterThanOrEqual(15);

      // Validate strict non-null and correctness constraints on every single AuditEvent
      for (const ev of allAuditEvents) {
        expect(ev.request_id).toBeDefined();
        expect(typeof ev.request_id).toBe('string');
        expect(ev.request_id!.length).toBeGreaterThan(0);

        expect(ev.ip_address).toBeDefined();
        expect(typeof ev.ip_address).toBe('string');
        expect(ev.ip_address!.length).toBeGreaterThan(0);

        expect(ev.mosque_id).toBe(mosqueId);
        expect(ev.action).toBeDefined();
        expect(typeof ev.action).toBe('string');
        expect(ev.action.length).toBeGreaterThan(0);

        expect(ev.target_type).toBeDefined();
        expect(typeof ev.target_type).toBe('string');
        expect(ev.target_type.length).toBeGreaterThan(0);

        expect(ev.summary).toBeDefined();
        expect(typeof ev.summary).toBe('string');
        expect(ev.summary.length).toBeGreaterThan(0);
      }

      // Verify the diversity of audited actions in the pipeline
      const actions = allAuditEvents.map((e) => e.action);
      expect(actions).toContain('tenant.applied');
      expect(actions).toContain('tenant.active');
      expect(actions).toContain('tenant.updated');
      expect(actions).toContain('membership.invited');
      expect(actions).toContain('membership.updated');
      expect(actions).toContain('announcement.created');
      expect(actions).toContain('announcement.updated');
      expect(actions).toContain('program.created');
      expect(actions).toContain('program.updated');
      expect(actions).toContain('registration.created');
      expect(actions).toContain('attendance.recorded');
      expect(actions).toContain('program.reminders_sent');
      expect(actions).toContain('donation.recorded');
      expect(actions).toContain('donation.reconciled');
      expect(actions).toContain('donations.exported');
      expect(actions).toContain('announcement.deleted');
      expect(actions).toContain('program.deleted');
    });
  });
});
