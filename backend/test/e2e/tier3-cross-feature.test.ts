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

describe('Tier 3: Cross-Feature & Pairwise Combinations', () => {
  let app: FastifyInstance;
  let tenant: TestTenant;
  let financeOfficer: TestOfficer;
  let programmeOfficer: TestOfficer;
  let commsOfficer: TestOfficer;
  let regularMember: TestOfficer;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    tenant = await createActiveTenant(app, { slugPrefix: 'tier3' });
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
  // Combination Flow 1: Complete Program Lifecycle -> Registration -> Checkin -> Reminders -> Audit
  // -------------------------------------------------------------------------
  describe('Flow 1: Program Lifecycle -> Attendee Check-In -> Reminder Notifications -> Audit Verification', () => {
    let programId: number;
    let registrationId: number;

    it('Step 1: Programme Officer schedules new youth workshop', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${programmeOfficer.bearerToken}`
        },
        payload: {
          title: 'Youth Leadership & Hadith Seminar',
          description: 'Comprehensive leadership workshop for community youth',
          category: 'Youth',
          start_date: new Date(Date.now() + 86400000).toISOString(),
          end_date: new Date(Date.now() + 90000000).toISOString(),
          location: 'Community Hall 1',
          max_capacity: 30,
          visibility: 'Public',
          status: 'Published'
        }
      });
      expect(res.statusCode).toBe(201);
      programId = res.json().program_id;
      expect(programId).toBeDefined();
    });

    it('Step 2: Member discovers program in public schedule and registers', async () => {
      const browseRes = await app.inject({
        method: 'GET',
        url: '/api/programs',
        headers: { 'x-mosque-slug': tenant.slug }
      });
      expect(browseRes.statusCode).toBe(200);
      expect(browseRes.json().some((p: any) => p.program_id === programId)).toBe(true);

      const regRes = await app.inject({
        method: 'POST',
        url: `/api/programs/${programId}/register`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${regularMember.bearerToken}`
        }
      });
      expect(regRes.statusCode).toBe(201);
      registrationId = regRes.json().reg_id;
    });

    it('Step 3: Programme Officer inspects registration roster', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/admin/programs/${programId}/registrations`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${programmeOfficer.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      const roster = res.json();
      expect(roster.length).toBe(1);
      expect(roster[0].user.email).toBe(regularMember.email);
    });

    it('Step 4: Programme Officer dispatches automated reminder to registered attendees', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/admin/programs/${programId}/reminders`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${programmeOfficer.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().sent).toBe(1);
    });

    it('Step 5: Member receives in-app reminder in inbox and marks as read', async () => {
      const inboxRes = await app.inject({
        method: 'GET',
        url: '/api/members/notifications',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${regularMember.bearerToken}`
        }
      });
      expect(inboxRes.statusCode).toBe(200);
      const notifs = inboxRes.json();
      const reminder = notifs.find((n: any) => n.related_id === programId);
      expect(reminder).toBeDefined();
      expect(reminder.is_read).toBe(false);

      const readRes = await app.inject({
        method: 'PATCH',
        url: `/api/members/notifications/${reminder.notif_id}/read`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${regularMember.bearerToken}`
        }
      });
      expect(readRes.statusCode).toBe(200);
      expect(readRes.json().is_read).toBe(true);
    });

    it('Step 6: Programme Officer checks in attendee at the door', async () => {
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
      expect(res.json().attended_at).not.toBeNull();
    });

    it('Step 7: Tenant Admin verifies full end-to-end audit trail in audit log viewer', async () => {
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
      const actions = events.map((e: any) => e.action);
      expect(actions).toContain('program.created');
      expect(actions).toContain('program.reminders_sent');
      expect(actions).toContain('attendance.recorded');
    });
  });

  // -------------------------------------------------------------------------
  // Combination Flow 2: Donations -> Offline Entry -> Reconcile -> CSV Export -> Analytics
  // -------------------------------------------------------------------------
  describe('Flow 2: Multi-Channel Donations -> Reconciliation -> CSV Export -> Analytics', () => {
    let onlineDonationId: number;
    let manualDonationId: number;
    let onlineReceipt: string;
    let manualReceipt: string;

    it('Step 1: Public donor completes online Card donation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/donations',
        headers: { 'x-mosque-slug': tenant.slug },
        payload: {
          amount: 500,
          category: 'Zakat',
          method: 'Card',
          external_reference: 'CARD_TX_987654'
        }
      });
      expect(res.statusCode).toBe(201);
      onlineDonationId = res.json().donation_id;
      onlineReceipt = res.json().receipt_number;
      expect(res.json().status).toBe('Completed');
    });

    it('Step 2: Finance Officer records in-person cash donation for registered member', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${financeOfficer.bearerToken}`
        },
        payload: {
          amount: 1500,
          category: 'Waqf',
          method: 'Cash',
          donor_email: regularMember.email,
          external_reference: 'CASH_BOX_DRAWER_1'
        }
      });
      expect(res.statusCode).toBe(201);
      manualDonationId = res.json().donation_id;
      manualReceipt = res.json().receipt_number;
      expect(res.json().method).toBe('Cash');
    });

    it('Step 3: Finance Officer reviews Unreconciled queue and reconciles online donation', async () => {
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/admin/donations?reconciliation_status=Unreconciled',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${financeOfficer.bearerToken}`
        }
      });
      expect(listRes.statusCode).toBe(200);
      const unreconciled = listRes.json();
      expect(unreconciled.some((d: any) => d.donation_id === onlineDonationId)).toBe(true);

      const recRes = await app.inject({
        method: 'PATCH',
        url: `/api/admin/donations/${onlineDonationId}/reconcile`,
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${financeOfficer.bearerToken}`
        }
      });
      expect(recRes.statusCode).toBe(200);
      expect(recRes.json().reconciliation_status).toBe('Reconciled');
    });

    it('Step 4: Finance Officer exports CSV ledger containing both receipts and correct statuses', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/donations/export.csv',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${financeOfficer.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain(onlineReceipt);
      expect(res.body).toContain(manualReceipt);
      expect(res.body).toContain('Reconciled');
      expect(res.body).toContain('Unreconciled');
    });

    it('Step 5: Admin inspects aggregated donation analytics to confirm totals', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/analytics/donations',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${tenant.adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      const analytics = res.json();
      expect(analytics.totalDonated).toBeGreaterThanOrEqual(2000);
      expect(analytics.byCategory.Zakat).toBeGreaterThanOrEqual(500);
      expect(analytics.byCategory.Waqf).toBeGreaterThanOrEqual(1500);
      expect(analytics.byMethod.Card).toBeGreaterThanOrEqual(500);
      expect(analytics.byMethod.Cash).toBeGreaterThanOrEqual(1500);
    });
  });

  // -------------------------------------------------------------------------
  // Combination Flow 3: Global Multi-Mosque User Navigation & Context Switching
  // -------------------------------------------------------------------------
  describe('Flow 3: Multi-Mosque User -> Switch Tenant -> Role Privilege Enforcement', () => {
    let secondMosque: TestTenant;
    let crossOfficer: TestOfficer;

    beforeAll(async () => {
      secondMosque = await createActiveTenant(app, { slugPrefix: 'cross-m2' });
      // Create user as comms_officer in Mosque 1
      crossOfficer = await createMemberUser(app, tenant, 'communications_officer', {
        email: `crossofficer-${Date.now()}@example.test`
      });
      // Add membership to Mosque 2 as finance_officer
      await app.prisma.membership.create({
        data: {
          mosque_id: secondMosque.mosqueId,
          user_id: crossOfficer.userId,
          role: 'finance_officer',
          status: 'Active'
        }
      });
    });

    afterAll(async () => {
      if (secondMosque?.mosqueId) {
        await cleanupTenant(app, secondMosque.mosqueId);
      }
      await app.prisma.user.deleteMany({ where: { email: crossOfficer.email } });
    });

    it('Step 1: User creates announcement in Mosque 1 context (communications_officer role)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/announcements',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${crossOfficer.bearerToken}`
        },
        payload: {
          title: 'Mosque 1 Community Update',
          content: 'Important news for Mosque 1 members.',
          category: 'General'
        }
      });
      expect(res.statusCode).toBe(201);
      const annId = res.json().announcement_id;
      await app.prisma.announcement.delete({ where: { announcement_id: annId } });
    });

    it('Step 2: User fails when attempting finance operations in Mosque 1 context (HTTP 403)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': tenant.slug,
          authorization: `Bearer ${crossOfficer.bearerToken}`
        },
        payload: { amount: 100, category: 'General', method: 'Cash' }
      });
      expect(res.statusCode).toBe(403);
    });

    it('Step 3: User executes tenant switch to Mosque 2 via POST /api/auth/switch-tenant/:slug', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/auth/switch-tenant/${secondMosque.slug}`,
        headers: { authorization: `Bearer ${crossOfficer.bearerToken}` }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().role).toBe('finance_officer');
      expect(res.json().token).toBeDefined();
    });

    it('Step 4: In Mosque 2 context, user records manual cash donation (finance_officer role)', async () => {
      const switchRes = await app.inject({
        method: 'POST',
        url: `/api/auth/switch-tenant/${secondMosque.slug}`,
        headers: { authorization: `Bearer ${crossOfficer.bearerToken}` }
      });
      const tokenM2 = switchRes.json().token;

      const donRes = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': secondMosque.slug,
          authorization: `Bearer ${tokenM2}`
        },
        payload: { amount: 300, category: 'Zakat', method: 'Cash' }
      });
      expect(donRes.statusCode).toBe(201);
    });

    it('Step 5: In Mosque 2 context, user is blocked from creating announcements (HTTP 403)', async () => {
      const switchRes = await app.inject({
        method: 'POST',
        url: `/api/auth/switch-tenant/${secondMosque.slug}`,
        headers: { authorization: `Bearer ${crossOfficer.bearerToken}` }
      });
      const tokenM2 = switchRes.json().token;

      const annRes = await app.inject({
        method: 'POST',
        url: '/api/admin/announcements',
        headers: {
          'x-mosque-slug': secondMosque.slug,
          authorization: `Bearer ${tokenM2}`
        },
        payload: { title: 'Unauthorized M2 Announcement', content: 'Blocked', category: 'General' }
      });
      expect(annRes.statusCode).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // Combination Flow 4: CSRF Token Handshake & Cookie Session Lifecycle
  // -------------------------------------------------------------------------
  describe('Flow 4: Cookie Session & CSRF Token Rotation Lifecycle', () => {
    let sessionCookie: string;
    let csrfToken: string;
    let announcementId: number;

    it('Step 1: Admin logs in via browser cookie mode and captures CSRF token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'x-mosque-slug': tenant.slug },
        payload: { email: tenant.adminEmail, password: tenant.adminPassword }
      });
      expect(res.statusCode).toBe(200);
      sessionCookie = extractCookie(res.headers, 'mh_session');
      csrfToken = res.json().csrfToken;
      expect(sessionCookie).toBeTruthy();
      expect(csrfToken).toBeTruthy();
    });

    it('Step 2: Admin creates announcement with valid CSRF header (POST mutation)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/announcements',
        headers: {
          'x-mosque-slug': tenant.slug,
          cookie: `mh_session=${sessionCookie}`,
          'x-csrf-token': csrfToken
        },
        payload: {
          title: 'CSRF Session Lifecycle Announcement',
          content: 'Testing full CSRF handshake flow.',
          category: 'General'
        }
      });
      expect(res.statusCode).toBe(201);
      announcementId = res.json().announcement_id;
    });

    it('Step 3: Admin refreshes CSRF token via GET /api/auth/csrf and performs PUT mutation', async () => {
      const csrfRes = await app.inject({
        method: 'GET',
        url: '/api/auth/csrf'
      });
      expect(csrfRes.statusCode).toBe(200);
      const newCsrf = csrfRes.json().csrfToken;

      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/admin/announcements/${announcementId}`,
        headers: {
          'x-mosque-slug': tenant.slug,
          cookie: `mh_session=${sessionCookie}`,
          'x-csrf-token': newCsrf
        },
        payload: { title: 'Updated CSRF Title' }
      });
      expect(updateRes.statusCode).toBe(200);
      expect(updateRes.json().title).toBe('Updated CSRF Title');
    });

    it('Step 4: Admin fails DELETE mutation with tampered CSRF token (HTTP 403)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/admin/announcements/${announcementId}`,
        headers: {
          'x-mosque-slug': tenant.slug,
          cookie: `mh_session=${sessionCookie}`,
          'x-csrf-token': 'forged_fake_token.signature'
        }
      });
      expect(res.statusCode).toBe(403);
    });

    it('Step 5: Admin succeeds DELETE mutation with valid CSRF token', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/admin/announcements/${announcementId}`,
        headers: {
          'x-mosque-slug': tenant.slug,
          cookie: `mh_session=${sessionCookie}`,
          'x-csrf-token': csrfToken
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Combination Flow 5: Tenant Onboarding -> Platform Activation -> Officer Delegation
  // -------------------------------------------------------------------------
  describe('Flow 5: Public Mosque Onboarding -> Platform Approval -> Officer Delegation', () => {
    const suffix = Date.now().toString(36);
    const newSlug = `genesis-${suffix}`;
    const newEmail = `genesis-admin-${suffix}@example.test`;
    const password = 'GenesisPass123!';
    let newMosqueId: number;
    let adminToken: string;

    it('Step 1: Public applicant submits new mosque onboarding application', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/mosques',
        payload: {
          name: 'Genesis Islamic Center',
          slug: newSlug,
          admin_name: 'Genesis President',
          admin_email: newEmail,
          admin_password: password,
          address: '45 Pioneer Way',
          phone: '+2348011223344'
        }
      });
      expect(res.statusCode).toBe(201);
      newMosqueId = res.json().mosque_id;
      expect(res.json().status).toBe('Pending');
    });

    it('Step 2: Admin cannot login while tenant is still in Pending status (HTTP 403)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'x-mosque-slug': newSlug },
        payload: { email: newEmail, password }
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toMatch(/approval|pending/i);
    });

    it('Step 3: Platform Super Admin reviews directory and activates tenant', async () => {
      const platLogin = await app.inject({
        method: 'POST',
        url: '/api/platform/auth/login',
        payload: { email: 'platform@masjidhub.local', password: 'platformPass123' }
      });
      const platToken = platLogin.json().token;

      const actRes = await app.inject({
        method: 'PATCH',
        url: `/api/platform/tenants/${newMosqueId}/status`,
        headers: { authorization: `Bearer ${platToken}` },
        payload: { status: 'Active' }
      });
      expect(actRes.statusCode).toBe(200);
      expect(actRes.json().status).toBe('Active');
    });

    it('Step 4: Mosque Admin successfully logs in to active workspace', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'x-mosque-slug': newSlug },
        payload: { email: newEmail, password }
      });
      expect(res.statusCode).toBe(200);
      adminToken = res.json().token;
      expect(adminToken).toBeDefined();
    });

    it('Step 5: Mosque Admin invites Finance and Programme officers', async () => {
      const finInvite = await app.inject({
        method: 'POST',
        url: '/api/admin/memberships/invite',
        headers: {
          'x-mosque-slug': newSlug,
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          name: 'Genesis Finance Officer',
          email: `gen-fin-${suffix}@example.test`,
          role: 'finance_officer',
          temporary_password: password
        }
      });
      expect(finInvite.statusCode).toBe(201);

      const progInvite = await app.inject({
        method: 'POST',
        url: '/api/admin/memberships/invite',
        headers: {
          'x-mosque-slug': newSlug,
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          name: 'Genesis Programme Officer',
          email: `gen-prog-${suffix}@example.test`,
          role: 'programme_officer',
          temporary_password: password
        }
      });
      expect(progInvite.statusCode).toBe(201);
    });

    it('Step 6: Mosque Admin verifies genesis audit trail contains onboarding and invite events', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-events',
        headers: {
          'x-mosque-slug': newSlug,
          authorization: `Bearer ${adminToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      const events = res.json();
      const actions = events.map((e: any) => e.action);
      expect(actions).toContain('tenant.applied');
      expect(actions).toContain('tenant.active');
      expect(actions).toContain('membership.invited');

      await cleanupTenant(app, newMosqueId);
      await app.prisma.user.deleteMany({
        where: {
          email: {
            in: [
              newEmail,
              `gen-fin-${suffix}@example.test`,
              `gen-prog-${suffix}@example.test`
            ]
          }
        }
      });
    });
  });
});
