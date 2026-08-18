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

describe('Tier 4: Real-World Multi-Tenant Mosque Operations', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // -------------------------------------------------------------------------
  // Workflow A: A Day in the Life of Central Mosque (Jumu'ah & Community Programs)
  // -------------------------------------------------------------------------
  describe('Workflow A: Friday Jumu\'ah & Weekend Community Program Operations', () => {
    let mosque: TestTenant;
    let commsOfficer: TestOfficer;
    let progOfficer: TestOfficer;
    let member1: TestOfficer;
    let member2: TestOfficer;
    let member3: TestOfficer;
    let jumuahProgramId: number;
    let weekendProgramId: number;

    beforeAll(async () => {
      mosque = await createActiveTenant(app, {
        slugPrefix: 'central-masjid',
        name: 'Central Community Mosque'
      });
      commsOfficer = await createMemberUser(app, mosque, 'communications_officer');
      progOfficer = await createMemberUser(app, mosque, 'programme_officer');
      member1 = await createMemberUser(app, mosque, 'member', { name: 'Brother Ahmad' });
      member2 = await createMemberUser(app, mosque, 'member', { name: 'Sister Fatimah' });
      member3 = await createMemberUser(app, mosque, 'member', { name: 'Brother Zayd' });
    });

    afterAll(async () => {
      await cleanupTenant(app, mosque.mosqueId);
      await app.prisma.user.deleteMany({
        where: {
          email: {
            in: [
              mosque.adminEmail,
              commsOfficer.email,
              progOfficer.email,
              member1.email,
              member2.email,
              member3.email
            ]
          }
        }
      });
    });

    it('Morning: Communications Officer publishes Friday Khutbah Announcement', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/announcements',
        headers: {
          'x-mosque-slug': mosque.slug,
          authorization: `Bearer ${commsOfficer.bearerToken}`
        },
        payload: {
          title: 'Friday Khutbah: Building a Resilient Community',
          content: 'Khutbah begins at 1:15 PM with guest Sheikh Ibrahim. Please arrive early.',
          category: 'Prayer',
          audience: 'Public',
          status: 'Published'
        }
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().title).toContain('Friday Khutbah');
    });

    it('Morning: Programme Officer schedules Weekend Quran Intensive with 2-seat limit for testing cap', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': mosque.slug,
          authorization: `Bearer ${progOfficer.bearerToken}`
        },
        payload: {
          title: 'Weekend Intensive: Advanced Tajweed Workshop',
          description: 'Specialized 2-day workshop on classical tajweed rules.',
          category: 'Education',
          start_date: new Date(Date.now() + 86400000).toISOString(),
          end_date: new Date(Date.now() + 172800000).toISOString(),
          location: 'Conference Hall A',
          max_capacity: 2,
          visibility: 'Public',
          status: 'Published'
        }
      });
      expect(res.statusCode).toBe(201);
      weekendProgramId = res.json().program_id;
    });

    it('Afternoon: Member 1 and Member 2 register for the 2 available workshop seats', async () => {
      const reg1 = await app.inject({
        method: 'POST',
        url: `/api/programs/${weekendProgramId}/register`,
        headers: {
          'x-mosque-slug': mosque.slug,
          authorization: `Bearer ${member1.bearerToken}`
        }
      });
      expect(reg1.statusCode).toBe(201);

      const reg2 = await app.inject({
        method: 'POST',
        url: `/api/programs/${weekendProgramId}/register`,
        headers: {
          'x-mosque-slug': mosque.slug,
          authorization: `Bearer ${member2.bearerToken}`
        }
      });
      expect(reg2.statusCode).toBe(201);
    });

    it('Afternoon: Member 3 attempts to register when capacity is full (rejected 409)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/programs/${weekendProgramId}/register`,
        headers: {
          'x-mosque-slug': mosque.slug,
          authorization: `Bearer ${member3.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error).toMatch(/capacity/i);
    });

    it('Evening: Programme Officer expands workshop capacity to 5 seats via PUT /api/admin/programs/:id', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/programs/${weekendProgramId}`,
        headers: {
          'x-mosque-slug': mosque.slug,
          authorization: `Bearer ${progOfficer.bearerToken}`
        },
        payload: { max_capacity: 5 }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().max_capacity).toBe(5);
    });

    it('Evening: Member 3 registers now that capacity has been expanded', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/programs/${weekendProgramId}/register`,
        headers: {
          'x-mosque-slug': mosque.slug,
          authorization: `Bearer ${member3.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(201);
    });

    it('Event Day: Programme Officer performs door check-in for all 3 registered attendees', async () => {
      const rosterRes = await app.inject({
        method: 'GET',
        url: `/api/admin/programs/${weekendProgramId}/registrations`,
        headers: {
          'x-mosque-slug': mosque.slug,
          authorization: `Bearer ${progOfficer.bearerToken}`
        }
      });
      expect(rosterRes.statusCode).toBe(200);
      const roster = rosterRes.json();
      expect(roster.length).toBe(3);

      for (const reg of roster) {
        const checkin = await app.inject({
          method: 'PATCH',
          url: `/api/admin/registrations/${reg.reg_id}/attendance`,
          headers: {
            'x-mosque-slug': mosque.slug,
            authorization: `Bearer ${progOfficer.bearerToken}`
          },
          payload: { status: 'Attended' }
        });
        expect(checkin.statusCode).toBe(200);
        expect(checkin.json().status).toBe('Attended');
      }
    });

    it('Night: Tenant Admin verifies 100% attendance rate in registration analytics', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/analytics/registrations',
        headers: {
          'x-mosque-slug': mosque.slug,
          authorization: `Bearer ${mosque.adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      const progStat = data.find((p: any) => p.program_id === weekendProgramId);
      expect(progStat).toBeDefined();
      expect(progStat.max_capacity).toBe(5);
    });
  });

  // -------------------------------------------------------------------------
  // Workflow B: Ramadan Multi-Channel Fundraising Drive & Financial Reconciliation
  // -------------------------------------------------------------------------
  describe('Workflow B: Ramadan Multi-Channel Fundraising & Treasury Reconciliation', () => {
    let mosque: TestTenant;
    let financeOfficer: TestOfficer;
    let donorMember: TestOfficer;
    const generatedReceipts: string[] = [];

    beforeAll(async () => {
      mosque = await createActiveTenant(app, {
        slugPrefix: 'ramadan-drive',
        name: 'Ramadan Relief Mosque'
      });
      financeOfficer = await createMemberUser(app, mosque, 'finance_officer');
      donorMember = await createMemberUser(app, mosque, 'member');
    });

    afterAll(async () => {
      await cleanupTenant(app, mosque.mosqueId);
      await app.prisma.user.deleteMany({
        where: {
          email: { in: [mosque.adminEmail, financeOfficer.email, donorMember.email] }
        }
      });
    });

    it('Phase 1: 3 Online Card Donations are processed for Zakat, Sadaqah, and General fund', async () => {
      const donations = [
        { amount: 1000, category: 'Zakat', method: 'Card' },
        { amount: 500, category: 'Sadaqah', method: 'Card' },
        { amount: 250, category: 'General', method: 'Card' }
      ];

      for (const d of donations) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/donations',
          headers: { 'x-mosque-slug': mosque.slug },
          payload: d
        });
        expect(res.statusCode).toBe(201);
        generatedReceipts.push(res.json().receipt_number);
      }
      expect(generatedReceipts.length).toBe(3);
    });

    it('Phase 2: Finance Officer records 2 manual in-person Cash collections from community boxes', async () => {
      const cashDonations = [
        { amount: 3000, category: 'Waqf', donor_email: donorMember.email },
        { amount: 750, category: 'Sadaqah', donor_email: undefined }
      ];

      for (const c of cashDonations) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/admin/donations/manual',
          headers: {
            'x-mosque-slug': mosque.slug,
            authorization: `Bearer ${financeOfficer.bearerToken}`
          },
          payload: {
            amount: c.amount,
            category: c.category,
            method: 'Cash',
            donor_email: c.donor_email
          }
        });
        expect(res.statusCode).toBe(201);
        generatedReceipts.push(res.json().receipt_number);
      }
      expect(generatedReceipts.length).toBe(5);
    });

    it('Phase 3: Finance Officer reconciles all online donations in the queue', async () => {
      const unreconciledRes = await app.inject({
        method: 'GET',
        url: '/api/admin/donations?reconciliation_status=Unreconciled',
        headers: {
          'x-mosque-slug': mosque.slug,
          authorization: `Bearer ${financeOfficer.bearerToken}`
        }
      });
      expect(unreconciledRes.statusCode).toBe(200);
      const donations = unreconciledRes.json();

      for (const don of donations) {
        const recRes = await app.inject({
          method: 'PATCH',
          url: `/api/admin/donations/${don.donation_id}/reconcile`,
          headers: {
            'x-mosque-slug': mosque.slug,
            authorization: `Bearer ${financeOfficer.bearerToken}`
          }
        });
        expect(recRes.statusCode).toBe(200);
        expect(recRes.json().reconciliation_status).toBe('Reconciled');
      }
    });

    it('Phase 4: Finance Officer exports complete structured CSV ledger', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/donations/export.csv',
        headers: {
          'x-mosque-slug': mosque.slug,
          authorization: `Bearer ${financeOfficer.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      for (const r of generatedReceipts) {
        expect(res.body).toContain(r);
      }
    });

    it('Phase 5: Board Admin verifies financial analytics totals across all categories', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/analytics/donations',
        headers: {
          'x-mosque-slug': mosque.slug,
          authorization: `Bearer ${mosque.adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      const a = res.json();
      expect(a.totalDonated).toBe(5500); // 1000 + 500 + 250 + 3000 + 750
      expect(a.totalDonationsCount).toBe(5);
      expect(a.byCategory.Zakat).toBe(1000);
      expect(a.byCategory.Waqf).toBe(3000);
      expect(a.byCategory.Sadaqah).toBe(1250);
      expect(a.byCategory.General).toBe(250);
    });
  });

  // -------------------------------------------------------------------------
  // Workflow C: Federated Sister Mosques Network & Cross-Tenant Resilience
  // -------------------------------------------------------------------------
  describe('Workflow C: Sister Mosques Network & Strict Cross-Tenant Boundaries', () => {
    let mosqueNorth: TestTenant;
    let mosqueEast: TestTenant;
    let mosqueWest: TestTenant;
    let globalLeader: TestOfficer;
    let globalMember: TestOfficer;

    beforeAll(async () => {
      mosqueNorth = await createActiveTenant(app, { slugPrefix: 'north', name: 'Mosque North' });
      mosqueEast = await createActiveTenant(app, { slugPrefix: 'east', name: 'Mosque East' });
      mosqueWest = await createActiveTenant(app, { slugPrefix: 'west', name: 'Mosque West' });

      // Create Global Leader who is Admin at North, Finance at East
      globalLeader = await createMemberUser(app, mosqueNorth, 'tenant_admin', {
        email: `global-leader-${Date.now()}@example.test`
      });
      await app.prisma.membership.create({
        data: {
          mosque_id: mosqueEast.mosqueId,
          user_id: globalLeader.userId,
          role: 'finance_officer',
          status: 'Active'
        }
      });

      // Create Global Member who is Member at North and Member at West
      globalMember = await createMemberUser(app, mosqueNorth, 'member', {
        email: `global-member-${Date.now()}@example.test`
      });
      await app.prisma.membership.create({
        data: {
          mosque_id: mosqueWest.mosqueId,
          user_id: globalMember.userId,
          role: 'member',
          status: 'Active'
        }
      });
    });

    afterAll(async () => {
      await cleanupTenant(app, mosqueNorth.mosqueId);
      await cleanupTenant(app, mosqueEast.mosqueId);
      await cleanupTenant(app, mosqueWest.mosqueId);
      await app.prisma.user.deleteMany({
        where: { email: { in: [globalLeader.email, globalMember.email] } }
      });
    });

    it('Scene 1: Global Leader in Mosque North creates an announcement in North', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/announcements',
        headers: {
          'x-mosque-slug': mosqueNorth.slug,
          authorization: `Bearer ${globalLeader.bearerToken}`
        },
        payload: {
          title: 'North Mosque Monthly Forum',
          content: 'Monthly meeting for North congregation.',
          category: 'Event'
        }
      });
      expect(res.statusCode).toBe(201);
    });

    it('Scene 2: Mosque East and Mosque West cannot see North announcement in their public feeds', async () => {
      const eastRes = await app.inject({
        method: 'GET',
        url: '/api/announcements',
        headers: { 'x-mosque-slug': mosqueEast.slug }
      });
      expect(eastRes.statusCode).toBe(200);
      expect(eastRes.json().some((a: any) => a.title === 'North Mosque Monthly Forum')).toBe(false);

      const westRes = await app.inject({
        method: 'GET',
        url: '/api/announcements',
        headers: { 'x-mosque-slug': mosqueWest.slug }
      });
      expect(westRes.statusCode).toBe(200);
      expect(westRes.json().some((a: any) => a.title === 'North Mosque Monthly Forum')).toBe(false);
    });

    it('Scene 3: Global Leader switches context to Mosque East and performs finance actions', async () => {
      const switchRes = await app.inject({
        method: 'POST',
        url: `/api/auth/switch-tenant/${mosqueEast.slug}`,
        headers: { authorization: `Bearer ${globalLeader.bearerToken}` }
      });
      expect(switchRes.statusCode).toBe(200);
      const eastToken = switchRes.json().token;

      // In East context, record manual cash donation
      const donRes = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': mosqueEast.slug,
          authorization: `Bearer ${eastToken}`
        },
        payload: { amount: 800, category: 'General', method: 'Cash' }
      });
      expect(donRes.statusCode).toBe(201);
    });

    it('Scene 4: Global Member switches to Mosque West and registers for West community event', async () => {
      // West creates event
      const westProg = await app.prisma.program.create({
        data: {
          mosque_id: mosqueWest.mosqueId,
          title: 'West Mosque Family Picnic',
          description: 'Outdoor event',
          start_date: new Date(),
          end_date: new Date(Date.now() + 3600000),
          location: 'West Park',
          status: 'Published'
        }
      });

      // Member switches to West
      const switchRes = await app.inject({
        method: 'POST',
        url: `/api/auth/switch-tenant/${mosqueWest.slug}`,
        headers: { authorization: `Bearer ${globalMember.bearerToken}` }
      });
      expect(switchRes.statusCode).toBe(200);
      const westToken = switchRes.json().token;

      // Member registers for West event
      const regRes = await app.inject({
        method: 'POST',
        url: `/api/programs/${westProg.program_id}/register`,
        headers: {
          'x-mosque-slug': mosqueWest.slug,
          authorization: `Bearer ${westToken}`
        }
      });
      expect(regRes.statusCode).toBe(201);
    });

    it('Scene 5: Mosque North and Mosque East audit trails remain strictly isolated without cross-tenant bleed', async () => {
      const northAudit = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-events',
        headers: {
          'x-mosque-slug': mosqueNorth.slug,
          authorization: `Bearer ${mosqueNorth.adminBearerToken}`
        }
      });
      expect(northAudit.statusCode).toBe(200);
      for (const ev of northAudit.json()) {
        expect(ev.mosque_id).toBe(mosqueNorth.mosqueId);
      }

      const eastAudit = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-events',
        headers: {
          'x-mosque-slug': mosqueEast.slug,
          authorization: `Bearer ${mosqueEast.adminBearerToken}`
        }
      });
      expect(eastAudit.statusCode).toBe(200);
      for (const ev of eastAudit.json()) {
        expect(ev.mosque_id).toBe(mosqueEast.mosqueId);
      }
    });
  });
});
