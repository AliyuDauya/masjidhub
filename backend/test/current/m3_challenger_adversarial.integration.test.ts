import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/server.js';
import {
  createActiveTenant,
  createMemberUser,
  cleanupTenant,
  type TestTenant,
  type TestOfficer
} from '../e2e/test-utils.js';

describe('Milestone 3 Adversarial Verification: Reconciliation, Cash Entry, CSV Export & RBAC Audit', () => {
  let app: FastifyInstance;

  // Primary Tenant A
  let tenantA: TestTenant;
  let financeOfficerA: TestOfficer;
  let programmeOfficerA: TestOfficer;
  let commsOfficerA: TestOfficer;
  let memberA: TestOfficer;

  // Secondary Tenant B (for multi-tenant isolation testing)
  let tenantB: TestTenant;
  let financeOfficerB: TestOfficer;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    // 1. Provision Tenant A & 5 Roles
    tenantA = await createActiveTenant(app, { slugPrefix: 'm3-challenger-a', name: 'Al-Ihsan Mosque' });
    financeOfficerA = await createMemberUser(app, tenantA, 'finance_officer');
    programmeOfficerA = await createMemberUser(app, tenantA, 'programme_officer');
    commsOfficerA = await createMemberUser(app, tenantA, 'communications_officer');
    memberA = await createMemberUser(app, tenantA, 'member');

    // 2. Provision Tenant B & Finance Officer
    tenantB = await createActiveTenant(app, { slugPrefix: 'm3-challenger-b', name: 'Al-Huda Mosque' });
    financeOfficerB = await createMemberUser(app, tenantB, 'finance_officer');
  });

  afterAll(async () => {
    if (tenantA) await cleanupTenant(app, tenantA.mosqueId);
    if (tenantB) await cleanupTenant(app, tenantB.mosqueId);
    await app.close();
  });

  // =========================================================================
  // SECTION 1: Donation Reconciliation Adversarial Tests
  // =========================================================================
  describe('1. Donation Reconciliation: PATCH /api/admin/donations/:id/reconcile', () => {
    let unrecDonationIdA: number;

    beforeAll(async () => {
      // Create an unreconciled donation for Tenant A
      const donRes = await app.inject({
        method: 'POST',
        url: '/api/donations',
        headers: { 'x-mosque-slug': tenantA.slug },
        payload: {
          amount: 250,
          category: 'Zakat',
          method: 'Card'
        }
      });
      expect(donRes.statusCode).toBe(201);
      unrecDonationIdA = donRes.json().donation_id;
    });

    it('1.1 RBAC: Rejects programme_officer with HTTP 403', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/donations/${unrecDonationIdA}/reconcile`,
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${programmeOfficerA.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toContain('permission');
    });

    it('1.2 RBAC: Rejects communications_officer with HTTP 403', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/donations/${unrecDonationIdA}/reconcile`,
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${commsOfficerA.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toContain('permission');
    });

    it('1.3 RBAC: Rejects regular member with HTTP 403', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/donations/${unrecDonationIdA}/reconcile`,
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${memberA.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toContain('permission');
    });

    it('1.4 Auth: Rejects unauthenticated request with HTTP 401', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/donations/${unrecDonationIdA}/reconcile`,
        headers: {
          'x-mosque-slug': tenantA.slug
        }
      });
      expect(res.statusCode).toBe(401);
    });

    it('1.5 Happy Path: finance_officer reconciles donation, sets status and records verified_by', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/donations/${unrecDonationIdA}/reconcile`,
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${financeOfficerA.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.reconciliation_status).toBe('Reconciled');
      expect(body.verified_by).toBe(financeOfficerA.userId);

      // Verify DB record
      const dbRecord = await app.prisma.donation.findUnique({
        where: { donation_id: unrecDonationIdA }
      });
      expect(dbRecord?.reconciliation_status).toBe('Reconciled');
      expect(dbRecord?.verified_by).toBe(financeOfficerA.userId);
    });

    it('1.6 Happy Path: tenant_admin reconciles donation, sets status and records verified_by', async () => {
      // Create another donation
      const donRes = await app.inject({
        method: 'POST',
        url: '/api/donations',
        headers: { 'x-mosque-slug': tenantA.slug },
        payload: {
          amount: 500,
          category: 'Sadaqah',
          method: 'Transfer'
        }
      });
      expect(donRes.statusCode).toBe(201);
      const donId = donRes.json().donation_id;

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/donations/${donId}/reconcile`,
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${tenantA.adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.reconciliation_status).toBe('Reconciled');
      expect(body.verified_by).toBe(tenantA.adminUserId);

      // Verify AuditEvent emitted
      const audit = await app.prisma.auditEvent.findFirst({
        where: {
          mosque_id: tenantA.mosqueId,
          action: 'donation.reconciled',
          target_id: String(donId)
        }
      });
      expect(audit).not.toBeNull();
      expect(audit?.actor_id).toBe(tenantA.adminUserId);
    });

    it('1.7 Boundary: Rejects non-existent donation ID with HTTP 404', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/donations/99999999/reconcile',
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${tenantA.adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toContain('not found');
    });

    it('1.8 Multi-Tenant Isolation: Tenant A cannot reconcile Tenant B donation (HTTP 404)', async () => {
      // Create donation in Tenant B
      const donResB = await app.inject({
        method: 'POST',
        url: '/api/donations',
        headers: { 'x-mosque-slug': tenantB.slug },
        payload: {
          amount: 300,
          category: 'Waqf',
          method: 'Card'
        }
      });
      expect(donResB.statusCode).toBe(201);
      const donationIdB = donResB.json().donation_id;

      // Tenant A admin tries to reconcile Tenant B's donation ID under Tenant A slug
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/donations/${donationIdB}/reconcile`,
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${tenantA.adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(404);

      // Verify Tenant B donation remains Unreconciled in DB
      const dbDonB = await app.prisma.donation.findUnique({
        where: { donation_id: donationIdB }
      });
      expect(dbDonB?.reconciliation_status).toBe('Unreconciled');
    });

    it('1.9 Schema Validation: Rejects non-integer or invalid ID parameters with HTTP 400', async () => {
      const invalidIds = ['abc', 'invalid-id', '-5', '0'];
      for (const invId of invalidIds) {
        const res = await app.inject({
          method: 'PATCH',
          url: `/api/admin/donations/${invId}/reconcile`,
          headers: {
            'x-mosque-slug': tenantA.slug,
            authorization: `Bearer ${tenantA.adminBearerToken}`
          }
        });
        expect(res.statusCode).toBe(400);
      }
    });
  });

  // =========================================================================
  // SECTION 2: Manual Cash Donation Adversarial Validation
  // =========================================================================
  describe('2. Manual Cash Donation: POST /api/admin/donations/manual', () => {
    it('2.1 RBAC: Allows tenant_admin and finance_officer; rejects others with HTTP 403', async () => {
      const validPayload = {
        amount: 150.50,
        category: 'Sadaqah',
        method: 'Cash'
      };

      // tenant_admin -> 201
      const resAdmin = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${tenantA.adminBearerToken}`
        },
        payload: validPayload
      });
      expect(resAdmin.statusCode).toBe(201);
      expect(resAdmin.json().recorded_by).toBe(tenantA.adminUserId);
      expect(resAdmin.json().receipt_number).toMatch(/^MH-[A-Z0-9]{8}$/);

      // finance_officer -> 201
      const resFin = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${financeOfficerA.bearerToken}`
        },
        payload: validPayload
      });
      expect(resFin.statusCode).toBe(201);
      expect(resFin.json().recorded_by).toBe(financeOfficerA.userId);

      // programme_officer -> 403
      const resProg = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${programmeOfficerA.bearerToken}`
        },
        payload: validPayload
      });
      expect(resProg.statusCode).toBe(403);

      // communications_officer -> 403
      const resComms = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${commsOfficerA.bearerToken}`
        },
        payload: validPayload
      });
      expect(resComms.statusCode).toBe(403);

      // member -> 403
      const resMem = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${memberA.bearerToken}`
        },
        payload: validPayload
      });
      expect(resMem.statusCode).toBe(403);
    });

    it('2.2 Validation: Rejects negative amounts with HTTP 400', async () => {
      const negativeAmounts = [-100, -0.01, -999999];
      for (const amount of negativeAmounts) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/admin/donations/manual',
          headers: {
            'x-mosque-slug': tenantA.slug,
            authorization: `Bearer ${tenantA.adminBearerToken}`
          },
          payload: {
            amount,
            category: 'Zakat',
            method: 'Cash'
          }
        });
        expect(res.statusCode).toBe(400);
      }
    });

    it('2.3 Validation: Rejects zero amounts with HTTP 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${tenantA.adminBearerToken}`
        },
        payload: {
          amount: 0,
          category: 'Zakat',
          method: 'Cash'
        }
      });
      expect(res.statusCode).toBe(400);
    });

    it('2.4 Validation: Rejects non-Cash payment methods with HTTP 400', async () => {
      const nonCashMethods = ['Card', 'Transfer', 'Crypto', 'Cheque', 'Bitcoin', ''];
      for (const method of nonCashMethods) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/admin/donations/manual',
          headers: {
            'x-mosque-slug': tenantA.slug,
            authorization: `Bearer ${tenantA.adminBearerToken}`
          },
          payload: {
            amount: 100,
            category: 'General',
            method
          }
        });
        expect(res.statusCode).toBe(400);
      }
    });

    it('2.5 Validation: Rejects invalid donation categories with HTTP 400', async () => {
      const invalidCategories = ['Cryptocurrency', 'Illegal', 'UnknownCat', '', 12345];
      for (const category of invalidCategories) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/admin/donations/manual',
          headers: {
            'x-mosque-slug': tenantA.slug,
            authorization: `Bearer ${tenantA.adminBearerToken}`
          },
          payload: {
            amount: 100,
            category,
            method: 'Cash'
          }
        });
        expect(res.statusCode).toBe(400);
      }
    });

    it('2.6 Validation: Rejects extra unexpected fields (additionalProperties: false) with HTTP 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${tenantA.adminBearerToken}`
        },
        payload: {
          amount: 100,
          category: 'Zakat',
          method: 'Cash',
          malicious_field: 'injected_content'
        }
      });
      expect(res.statusCode).toBe(400);
    });

    it('2.7 Member Linkage: Resolves member user_id when active member email is supplied', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${financeOfficerA.bearerToken}`
        },
        payload: {
          amount: 750,
          category: 'Waqf',
          method: 'Cash',
          donor_email: memberA.email
        }
      });
      expect(res.statusCode).toBe(201);
      const don = res.json();
      expect(don.user_id).toBe(memberA.userId);
      expect(don.recorded_by).toBe(financeOfficerA.userId);

      // Verify AuditEvent emitted
      const audit = await app.prisma.auditEvent.findFirst({
        where: {
          mosque_id: tenantA.mosqueId,
          action: 'donation.recorded',
          target_id: String(don.donation_id)
        }
      });
      expect(audit).not.toBeNull();
      expect(audit?.actor_id).toBe(financeOfficerA.userId);
    });
  });

  // =========================================================================
  // SECTION 3: CSV Ledger Export RFC 4180 Escaping & RBAC
  // =========================================================================
  describe('3. CSV Ledger Export: GET /api/admin/donations/export.csv', () => {
    it('3.1 RBAC: Allows tenant_admin and finance_officer; rejects others with HTTP 403', async () => {
      // tenant_admin -> 200
      const resAdmin = await app.inject({
        method: 'GET',
        url: '/api/admin/donations/export.csv',
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${tenantA.adminBearerToken}`
        }
      });
      expect(resAdmin.statusCode).toBe(200);

      // finance_officer -> 200
      const resFin = await app.inject({
        method: 'GET',
        url: '/api/admin/donations/export.csv',
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${financeOfficerA.bearerToken}`
        }
      });
      expect(resFin.statusCode).toBe(200);

      // programme_officer -> 403
      const resProg = await app.inject({
        method: 'GET',
        url: '/api/admin/donations/export.csv',
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${programmeOfficerA.bearerToken}`
        }
      });
      expect(resProg.statusCode).toBe(403);

      // communications_officer -> 403
      const resComms = await app.inject({
        method: 'GET',
        url: '/api/admin/donations/export.csv',
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${commsOfficerA.bearerToken}`
        }
      });
      expect(resComms.statusCode).toBe(403);

      // member -> 403
      const resMem = await app.inject({
        method: 'GET',
        url: '/api/admin/donations/export.csv',
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${memberA.bearerToken}`
        }
      });
      expect(resMem.statusCode).toBe(403);

      // unauthenticated -> 401
      const resUnauth = await app.inject({
        method: 'GET',
        url: '/api/admin/donations/export.csv',
        headers: {
          'x-mosque-slug': tenantA.slug
        }
      });
      expect(resUnauth.statusCode).toBe(401);
    });

    it('3.2 Headers & Content-Type: Returns text/csv with attachment filename donations.csv', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/donations/export.csv',
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${financeOfficerA.bearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toBe('attachment; filename="donations.csv"');
    });

    it('3.3 RFC 4180 Escaping: Special characters (commas, quotes, newlines) correctly escaped', async () => {
      // Insert custom donation with special characters directly to stress RFC 4180 formatting
      await app.prisma.donation.create({
        data: {
          mosque_id: tenantA.mosqueId,
          amount_minor: 125000,
          currency: 'NGN',
          category: 'General',
          method: 'Cash',
          status: 'Completed',
          receipt_number: 'MH-"SPECIAL",TEST\nNEWLINE',
          reconciliation_status: 'Unreconciled'
        }
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/donations/export.csv',
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${tenantA.adminBearerToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      const csvText = res.body;

      // Header row check
      expect(csvText.startsWith('receipt,date,amount,currency,category,method,status,reconciliation')).toBe(true);

      // Escaping check: the receipt containing quotes and commas must be double-quoted and internal quotes doubled
      expect(csvText).toContain('"MH-""SPECIAL"",TEST\nNEWLINE"');

      // Check AuditEvent
      const audit = await app.prisma.auditEvent.findFirst({
        where: {
          mosque_id: tenantA.mosqueId,
          action: 'donations.exported'
        }
      });
      expect(audit).not.toBeNull();
    });
  });

  // =========================================================================
  // SECTION 4: Tenant Audit Log Viewer RBAC & Multi-Tenant Isolation
  // =========================================================================
  describe('4. Tenant Audit Log Viewer: GET /api/admin/audit-events', () => {
    it('4.1 RBAC: Strictly allows tenant_admin only; rejects all other roles with HTTP 403', async () => {
      // tenant_admin -> 200
      const resAdmin = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-events',
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${tenantA.adminBearerToken}`
        }
      });
      expect(resAdmin.statusCode).toBe(200);
      const events = resAdmin.json();
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty('action');
      expect(events[0]).toHaveProperty('actor');
      expect(events[0]).toHaveProperty('ip_address');
      expect(events[0]).toHaveProperty('request_id');

      // finance_officer -> 403
      const resFin = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-events',
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${financeOfficerA.bearerToken}`
        }
      });
      expect(resFin.statusCode).toBe(403);
      expect(resFin.json().error).toContain('permission');

      // programme_officer -> 403
      const resProg = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-events',
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${programmeOfficerA.bearerToken}`
        }
      });
      expect(resProg.statusCode).toBe(403);

      // communications_officer -> 403
      const resComms = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-events',
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${commsOfficerA.bearerToken}`
        }
      });
      expect(resComms.statusCode).toBe(403);

      // member -> 403
      const resMem = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-events',
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${memberA.bearerToken}`
        }
      });
      expect(resMem.statusCode).toBe(403);

      // unauthenticated -> 401
      const resUnauth = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-events',
        headers: {
          'x-mosque-slug': tenantA.slug
        }
      });
      expect(resUnauth.statusCode).toBe(401);
    });

    it('4.2 Multi-Tenant Isolation: Tenant A admin strictly sees Tenant A audit events, zero bleed from Tenant B', async () => {
      // Trigger specific audit event in Tenant B
      const donResB = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': tenantB.slug,
          authorization: `Bearer ${tenantB.adminBearerToken}`
        },
        payload: {
          amount: 8888,
          category: 'Zakat',
          method: 'Cash',
          external_reference: 'TENANT-B-SECRET-REF'
        }
      });
      expect(donResB.statusCode).toBe(201);

      // Query Tenant A audit events
      const resA = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-events',
        headers: {
          'x-mosque-slug': tenantA.slug,
          authorization: `Bearer ${tenantA.adminBearerToken}`
        }
      });
      expect(resA.statusCode).toBe(200);
      const eventsA = resA.json();

      // Ensure every audit event has mosque_id == tenantA.mosqueId
      for (const event of eventsA) {
        expect(event.mosque_id).toBe(tenantA.mosqueId);
        expect(event.summary).not.toContain('TENANT-B-SECRET-REF');
      }

      // Query Tenant B audit events
      const resB = await app.inject({
        method: 'GET',
        url: '/api/admin/audit-events',
        headers: {
          'x-mosque-slug': tenantB.slug,
          authorization: `Bearer ${tenantB.adminBearerToken}`
        }
      });
      expect(resB.statusCode).toBe(200);
      const eventsB = resB.json();
      for (const event of eventsB) {
        expect(event.mosque_id).toBe(tenantB.mosqueId);
      }
      expect(eventsB.some((e: any) => e.mosque_id === tenantB.mosqueId)).toBe(true);
    });
  });
});
