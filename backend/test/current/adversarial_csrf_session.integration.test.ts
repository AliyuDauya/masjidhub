import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { verifyCsrfToken, createCsrfToken } from '../../src/plugins/security.js';

describe('Adversarial Stress Test: Session Security & CSRF Protections', () => {
  let app: FastifyInstance;
  const suffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const slug = `advsec-${suffix}`;
  const adminEmail = `advadmin-${suffix}@example.test`;
  const memberEmail = `advmember-${suffix}@example.test`;
  const password = 'AdvSecurityPass123!';

  let mosqueId: number;
  let adminUserId: number;
  let memberUserId: number;
  let adminSessionCookie = '';
  let adminBearerToken = '';
  let memberSessionCookie = '';
  let validCsrfToken = '';
  let platformBearerToken = '';
  let sampleProgramId: number;
  let sampleAnnouncementId: number;

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

  function extractCookieFullHeader(headers: Record<string, string | string[] | undefined>, name: string): string {
    const raw = headers['set-cookie'];
    if (!raw) return '';
    const array = Array.isArray(raw) ? raw : [raw];
    for (const cookie of array) {
      if (cookie.includes(`${name}=`)) return cookie;
    }
    return '';
  }

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    // 1. Create Mosque Tenant
    const mosqueRes = await app.inject({
      method: 'POST',
      url: '/api/mosques',
      payload: {
        name: 'Adversarial Security Mosque',
        slug,
        admin_name: 'Adv Admin',
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

    // 3. Register Member
    const memberRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: { 'x-mosque-slug': slug },
      payload: { name: 'Adv Member', email: memberEmail, password }
    });
    expect(memberRes.statusCode).toBe(201);
    memberUserId = memberRes.json().user.user_id;
    memberSessionCookie = extractCookie(memberRes.headers, 'mh_session');

    // 4. Admin Login
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

    // 5. Retrieve CSRF Token
    const csrfRes = await app.inject({
      method: 'GET',
      url: '/api/auth/csrf'
    });
    expect(csrfRes.statusCode).toBe(200);
    validCsrfToken = csrfRes.json().csrfToken;

    // 6. Create Seed Program & Announcement for update/delete tests
    const progRes = await app.inject({
      method: 'POST',
      url: '/api/admin/programs',
      headers: {
        'x-mosque-slug': slug,
        authorization: `Bearer ${adminBearerToken}`
      },
      payload: {
        title: 'Initial Adv Program',
        description: 'Testing lifecycle',
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 86400000).toISOString(),
        location: 'Hall A',
        max_capacity: 50
      }
    });
    expect(progRes.statusCode).toBe(201);
    sampleProgramId = progRes.json().program_id;

    const annRes = await app.inject({
      method: 'POST',
      url: '/api/admin/announcements',
      headers: {
        'x-mosque-slug': slug,
        authorization: `Bearer ${adminBearerToken}`
      },
      payload: {
        title: 'Initial Announcement',
        content: 'Initial content',
        category: 'General',
        audience: 'Public'
      }
    });
    expect(annRes.statusCode).toBe(201);
    sampleAnnouncementId = annRes.json().announcement_id;
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
  // ATTACK VECTOR 1: Mutation Requests Missing CSRF Header (Must Return 403)
  // =========================================================================
  describe('Attack Vector 1: Mutation Requests with Session Cookie Missing CSRF Header', () => {
    it('blocks POST /api/admin/programs with 403 when CSRF header is omitted', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': slug,
          cookie: `mh_session=${adminSessionCookie}`
        },
        payload: {
          title: 'Attack Program 1',
          description: 'Unprotected POST attempt',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 86400000).toISOString(),
          location: 'Hall A',
          max_capacity: 50
        }
      });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: 'Invalid or missing CSRF token.' });
    });

    it('blocks PUT /api/admin/programs/:id with 403 when CSRF header is omitted', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/programs/${sampleProgramId}`,
        headers: {
          'x-mosque-slug': slug,
          cookie: `mh_session=${adminSessionCookie}`
        },
        payload: { title: 'Attack Program Updated Title' }
      });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: 'Invalid or missing CSRF token.' });
    });

    it('blocks PATCH /api/admin/donations/:id/reconcile with 403 when CSRF header is omitted', async () => {
      const don = await app.prisma.donation.create({
        data: {
          mosque_id: mosqueId,
          amount_minor: 5000,
          category: 'General',
          method: 'Card',
          status: 'Completed',
          receipt_number: `MH-ATTACK-${Date.now().toString(36)}`
        }
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/donations/${don.donation_id}/reconcile`,
        headers: {
          'x-mosque-slug': slug,
          cookie: `mh_session=${adminSessionCookie}`
        }
      });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: 'Invalid or missing CSRF token.' });
    });

    it('blocks DELETE /api/admin/programs/:id with 403 when CSRF header is omitted', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/admin/programs/${sampleProgramId}`,
        headers: {
          'x-mosque-slug': slug,
          cookie: `mh_session=${adminSessionCookie}`
        }
      });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: 'Invalid or missing CSRF token.' });
    });

    it('blocks POST /api/admin/donations/manual with 403 when CSRF header is omitted', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': slug,
          cookie: `mh_session=${adminSessionCookie}`
        },
        payload: { amount: 1000, category: 'Sadaqah', method: 'Cash' }
      });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: 'Invalid or missing CSRF token.' });
    });

    it('blocks POST /api/admin/announcements with 403 when CSRF header is omitted', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/announcements',
        headers: {
          'x-mosque-slug': slug,
          cookie: `mh_session=${adminSessionCookie}`
        },
        payload: {
          title: 'Attack Announcement',
          content: 'CSRF missing test',
          category: 'General',
          audience: 'Public'
        }
      });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: 'Invalid or missing CSRF token.' });
    });

    it('blocks DELETE /api/admin/announcements/:id with 403 when CSRF header is omitted', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/admin/announcements/${sampleAnnouncementId}`,
        headers: {
          'x-mosque-slug': slug,
          cookie: `mh_session=${adminSessionCookie}`
        }
      });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: 'Invalid or missing CSRF token.' });
    });
  });

  // =========================================================================
  // ATTACK VECTOR 2: Forged, Tampered & Malformed CSRF Tokens (Must Return 403)
  // =========================================================================
  describe('Attack Vector 2: Forged & Tampered CSRF Tokens', () => {
    it('blocks completely random string CSRF token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': slug,
          cookie: `mh_session=${adminSessionCookie}`,
          'x-csrf-token': 'attacker_random_string_without_dots'
        },
        payload: {
          title: 'Random Token Attack',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 86400000).toISOString(),
          location: 'Hall A'
        }
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toMatch(/CSRF/i);
    });

    it('blocks token with forged HMAC signature', async () => {
      const [raw] = validCsrfToken.split('.');
      const forgedSig = crypto.createHmac('sha256', 'wrong-secret-key-1234567890123456').update(raw).digest('hex');
      const forgedToken = `${raw}.${forgedSig}`;

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': slug,
          cookie: `mh_session=${adminSessionCookie}`,
          'x-csrf-token': forgedToken
        },
        payload: {
          title: 'Forged Signature Attack',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 86400000).toISOString(),
          location: 'Hall A'
        }
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toMatch(/CSRF/i);
    });

    it('blocks token with tampered raw component', async () => {
      const [, sig] = validCsrfToken.split('.');
      const tamperedRaw = crypto.randomBytes(24).toString('hex');
      const tamperedToken = `${tamperedRaw}.${sig}`;

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': slug,
          cookie: `mh_session=${adminSessionCookie}`,
          'x-csrf-token': tamperedToken
        },
        payload: {
          title: 'Tampered Raw Attack',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 86400000).toISOString(),
          location: 'Hall A'
        }
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toMatch(/CSRF/i);
    });

    it('blocks token with length-mismatched signature (timing attack defense)', async () => {
      const [raw] = validCsrfToken.split('.');
      const shortSignature = 'deadbeef12345678'; // 16 chars instead of 64
      const mismatchedToken = `${raw}.${shortSignature}`;

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': slug,
          cookie: `mh_session=${adminSessionCookie}`,
          'x-csrf-token': mismatchedToken
        },
        payload: {
          title: 'Length Mismatch Attack',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 86400000).toISOString(),
          location: 'Hall A'
        }
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toMatch(/CSRF/i);
    });

    it('blocks empty string and whitespace tokens', async () => {
      for (const emptyVal of ['', '   ', '\t', '\n']) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/admin/programs',
          headers: {
            'x-mosque-slug': slug,
            cookie: `mh_session=${adminSessionCookie}`,
            'x-csrf-token': emptyVal
          },
          payload: {
            title: 'Empty Token Attack',
            start_date: new Date().toISOString(),
            end_date: new Date(Date.now() + 86400000).toISOString(),
            location: 'Hall A'
          }
        });
        expect(res.statusCode).toBe(403);
      }
    });

    it('blocks multi-dot and malformed structure tokens', async () => {
      for (const malformed of ['part1.part2.part3', '.onlysig', 'onlyraw.', '...', 'a.b.c.d']) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/admin/programs',
          headers: {
            'x-mosque-slug': slug,
            cookie: `mh_session=${adminSessionCookie}`,
            'x-csrf-token': malformed
          },
          payload: {
            title: 'Malformed Structure Attack',
            start_date: new Date().toISOString(),
            end_date: new Date(Date.now() + 86400000).toISOString(),
            location: 'Hall A'
          }
        });
        expect(res.statusCode).toBe(403);
      }
    });
  });

  // =========================================================================
  // ATTACK VECTOR 3: Cryptographic HMAC Unit & Timing Attack Invariant Verification
  // =========================================================================
  describe('Attack Vector 3: verifyCsrfToken Unit Robustness', () => {
    it('validates genuine tokens produced by createCsrfToken', () => {
      for (let i = 0; i < 20; i++) {
        const token = createCsrfToken();
        expect(verifyCsrfToken(token)).toBe(true);
      }
    });

    it('gracefully handles non-string and edge case inputs without throwing exceptions', () => {
      expect(verifyCsrfToken(undefined)).toBe(false);
      expect(verifyCsrfToken(null as any)).toBe(false);
      expect(verifyCsrfToken('' as any)).toBe(false);
      expect(verifyCsrfToken(12345 as any)).toBe(false);
      expect(verifyCsrfToken({} as any)).toBe(false);
      expect(verifyCsrfToken([] as any)).toBe(false);
      expect(verifyCsrfToken('singleword')).toBe(false);
      expect(verifyCsrfToken('a.b')).toBe(false);
    });

    it('prevents byte tampering on any single hex character', () => {
      const valid = createCsrfToken();
      const [raw, sig] = valid.split('.');

      // Flip first char of sig
      const flippedSigChar = sig[0] === 'a' ? 'b' : 'a';
      const tamperedSig = flippedSigChar + sig.slice(1);
      expect(verifyCsrfToken(`${raw}.${tamperedSig}`)).toBe(false);

      // Flip last char of raw
      const flippedRawChar = raw[raw.length - 1] === '0' ? '1' : '0';
      const tamperedRaw = raw.slice(0, -1) + flippedRawChar;
      expect(verifyCsrfToken(`${tamperedRaw}.${sig}`)).toBe(false);
    });
  });

  // =========================================================================
  // ATTACK VECTOR 4: Dual-Mode Authentication & Bearer Token Mutations
  // =========================================================================
  describe('Attack Vector 4: Dual-Mode Authentication & Bearer Token Mutations', () => {
    it('allows authorized Bearer token to perform POST mutations without CSRF token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        },
        payload: {
          title: 'Bearer Mutation Program',
          description: 'Created via Bearer without CSRF',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 86400000).toISOString(),
          location: 'Hall Bearer',
          max_capacity: 25
        }
      });
      expect(res.statusCode).toBe(201);
      const createdId = res.json().program_id;
      expect(createdId).toBeDefined();

      // Clean up
      await app.prisma.program.delete({ where: { program_id: createdId } });
    });

    it('allows authorized Bearer token to perform PUT mutations without CSRF token', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/programs/${sampleProgramId}`,
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`
        },
        payload: { title: 'Bearer Updated Title' }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().title).toBe('Bearer Updated Title');
    });

    it('enforces CSRF when both mh_session cookie AND Bearer header are sent', async () => {
      // If a browser session cookie is present, CSRF protection MUST activate regardless of Bearer presence
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`,
          cookie: `mh_session=${adminSessionCookie}`
          // No X-CSRF-Token provided
        },
        payload: {
          title: 'Mixed Auth Program',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 86400000).toISOString(),
          location: 'Hall Mixed'
        }
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toMatch(/CSRF/i);
    });

    it('succeeds when mixed auth includes a valid CSRF token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': slug,
          authorization: `Bearer ${adminBearerToken}`,
          cookie: `mh_session=${adminSessionCookie}`,
          'x-csrf-token': validCsrfToken
        },
        payload: {
          title: 'Mixed Auth Valid CSRF Program',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 86400000).toISOString(),
          location: 'Hall Mixed Valid',
          max_capacity: 10
        }
      });
      expect(res.statusCode).toBe(201);
      const progId = res.json().program_id;
      await app.prisma.program.delete({ where: { program_id: progId } });
    });
  });

  // =========================================================================
  // ATTACK VECTOR 5: Cookie Security Flags & Lifecycle Verification
  // =========================================================================
  describe('Attack Vector 5: Cookie Flags & Lifecycle', () => {
    it('sets mh_session with HttpOnly, SameSite=Lax, Path=/ and Max-Age=28800 on login', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'x-mosque-slug': slug },
        payload: { email: adminEmail, password }
      });
      expect(res.statusCode).toBe(200);

      const sessionCookieHeader = extractCookieFullHeader(res.headers, 'mh_session');
      expect(sessionCookieHeader).toBeDefined();
      expect(sessionCookieHeader.toLowerCase()).toContain('httponly');
      expect(sessionCookieHeader.toLowerCase()).toContain('samesite=lax');
      expect(sessionCookieHeader.toLowerCase()).toContain('path=/');
      expect(sessionCookieHeader.toLowerCase()).toContain('max-age=28800');

      const csrfCookieHeader = extractCookieFullHeader(res.headers, 'mh_csrf');
      expect(csrfCookieHeader).toBeDefined();
      expect(csrfCookieHeader.toLowerCase()).not.toContain('httponly'); // MUST be JS-readable
      expect(csrfCookieHeader.toLowerCase()).toContain('samesite=lax');
      expect(csrfCookieHeader.toLowerCase()).toContain('path=/');
    });

    it('sets mh_csrf with HttpOnly=false on GET /api/auth/csrf', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/csrf'
      });
      expect(res.statusCode).toBe(200);

      const csrfCookieHeader = extractCookieFullHeader(res.headers, 'mh_csrf');
      expect(csrfCookieHeader).toBeDefined();
      expect(csrfCookieHeader.toLowerCase()).not.toContain('httponly');
      expect(csrfCookieHeader.toLowerCase()).toContain('samesite=lax');
    });

    it('clears both mh_session and mh_csrf cookies on POST /api/auth/logout', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          cookie: `mh_session=${adminSessionCookie}`
        }
      });
      expect(res.statusCode).toBe(200);

      const sessionCookieHeader = extractCookieFullHeader(res.headers, 'mh_session');
      expect(sessionCookieHeader).toBeDefined();
      expect(sessionCookieHeader.toLowerCase()).toContain('max-age=0');
      expect(sessionCookieHeader).toContain('1970');

      const csrfCookieHeader = extractCookieFullHeader(res.headers, 'mh_csrf');
      expect(csrfCookieHeader).toBeDefined();
      expect(csrfCookieHeader.toLowerCase()).toContain('max-age=0');
      expect(csrfCookieHeader).toContain('1970');
    });
  });

  // =========================================================================
  // ATTACK VECTOR 6: Header Casing & Alternative Header Support
  // =========================================================================
  describe('Attack Vector 6: Header Casing & Alternate Header Names', () => {
    it('accepts valid token via standard X-CSRF-Token header', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': slug,
          cookie: `mh_session=${adminSessionCookie}`,
          'X-CSRF-Token': validCsrfToken
        },
        payload: {
          title: 'Upper Header Program',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 86400000).toISOString(),
          location: 'Hall Casing'
        }
      });
      expect(res.statusCode).toBe(201);
      await app.prisma.program.delete({ where: { program_id: res.json().program_id } });
    });

    it('accepts valid token via lowercase x-csrf-token header', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': slug,
          cookie: `mh_session=${adminSessionCookie}`,
          'x-csrf-token': validCsrfToken
        },
        payload: {
          title: 'Lower Header Program',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 86400000).toISOString(),
          location: 'Hall Casing 2'
        }
      });
      expect(res.statusCode).toBe(201);
      await app.prisma.program.delete({ where: { program_id: res.json().program_id } });
    });

    it('accepts valid token via x-xsrf-token alternate header', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': slug,
          cookie: `mh_session=${adminSessionCookie}`,
          'x-xsrf-token': validCsrfToken
        },
        payload: {
          title: 'XSRF Header Program',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 86400000).toISOString(),
          location: 'Hall XSRF'
        }
      });
      expect(res.statusCode).toBe(201);
      await app.prisma.program.delete({ where: { program_id: res.json().program_id } });
    });
  });

  // =========================================================================
  // ATTACK VECTOR 7: Safe Read (GET/OPTIONS) Methods Remain Unblocked
  // =========================================================================
  describe('Attack Vector 7: Safe HTTP Read Methods', () => {
    it('allows GET /api/members/donations with session cookie and no CSRF header', async () => {
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

    it('allows GET /api/auth/me with session cookie and no CSRF header', async () => {
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
  });
});
