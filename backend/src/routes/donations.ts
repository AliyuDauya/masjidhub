import { FastifyInstance, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { tenantHook } from '../middleware/tenantHook.js';
import type { JWTPayload } from '../plugins/auth.js';
import {
  createDonationSchema,
  manualDonationSchema,
  queryDonationsSchema,
  reconcileDonationSchema
} from '../schemas/index.js';

interface DonationBody {
  amount: number; category: 'Zakat' | 'Sadaqah' | 'Waqf' | 'General';
  method: 'Card' | 'Transfer' | 'Cash'; currency?: string; external_reference?: string; donor_email?: string;
}

const categories = ['Zakat', 'Sadaqah', 'Waqf', 'General'];
const publicDonation = (d: Record<string, unknown> & { amount_minor: number }) => ({ ...d, amount: d.amount_minor / 100 });

function escapeCsv(field: unknown): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default async function donationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', tenantHook);

  fastify.post('/api/donations', {
    schema: createDonationSchema
  }, async (request, reply) => {
    const { amount, category, method, currency = 'NGN', external_reference } = request.body as DonationBody;
    if (!Number.isFinite(amount) || amount <= 0) return reply.status(400).send({ error: 'Donation amount must be greater than zero.' });
    if (!categories.includes(category)) return reply.status(400).send({ error: 'Invalid donation category.' });
    if (!['Card', 'Transfer'].includes(method)) return reply.status(400).send({ error: 'Invalid web donation payment method.' });

    let user_id: number | undefined;
    try {
      await request.jwtVerify();
      const payload = request.user as JWTPayload;
      if (payload.mosque_id === request.tenant.mosque_id && payload.membership_id) {
        const membership = await fastify.prisma.membership.findUnique({ where: { membership_id: payload.membership_id } });
        if (membership?.status === 'Active') user_id = payload.user_id;
      }
    } catch { /* anonymous donations are allowed */ }

    const donation = await fastify.prisma.donation.create({
      data: {
        mosque_id: request.tenant.mosque_id,
        user_id,
        amount_minor: Math.round(amount * 100),
        currency: currency.toUpperCase(),
        category,
        method,
        external_reference,
        status: 'Completed',
        receipt_number: `MH-${randomUUID().slice(0, 8).toUpperCase()}`
      }
    });
    await fastify.audit(request, 'donation.completed', 'Donation', donation.donation_id, `Donation receipt ${donation.receipt_number} issued.`);
    reply.status(201).send(publicDonation(donation));
  });

  fastify.post('/api/admin/donations/manual', {
    schema: manualDonationSchema,
    preHandler: [fastify.requireMembership(['tenant_admin', 'finance_officer'])]
  }, async (request, reply) => {
    const { amount, category, method, currency = 'NGN', external_reference, donor_email } = request.body as DonationBody;
    if (!Number.isFinite(amount) || amount <= 0 || method !== 'Cash' || !categories.includes(category)) {
      return reply.status(400).send({ error: 'A positive amount, valid category, and cash method are required.' });
    }
    let user_id: number | undefined;
    if (donor_email) {
      const user = await fastify.prisma.user.findUnique({ where: { email: donor_email.toLowerCase() } });
      if (user) {
        const member = await fastify.prisma.membership.findUnique({
          where: { mosque_id_user_id: { mosque_id: request.tenant.mosque_id, user_id: user.user_id } }
        });
        if (member) user_id = user.user_id;
      }
    }
    const actor = request.user as JWTPayload;
    const donation = await fastify.prisma.donation.create({
      data: {
        mosque_id: request.tenant.mosque_id,
        user_id,
        amount_minor: Math.round(amount * 100),
        currency: currency.toUpperCase(),
        category,
        method: 'Cash',
        external_reference,
        status: 'Completed',
        recorded_by: actor.user_id,
        receipt_number: `MH-${randomUUID().slice(0, 8).toUpperCase()}`
      }
    });
    await fastify.audit(request, 'donation.recorded', 'Donation', donation.donation_id, 'Offline donation recorded.');
    reply.status(201).send(publicDonation(donation));
  });

  fastify.get('/api/members/donations', {
    preHandler: [fastify.requireMembership()]
  }, async (request, reply) => {
    const payload = request.user as JWTPayload;
    const rows = await fastify.prisma.donation.findMany({
      where: { mosque_id: request.tenant.mosque_id, user_id: payload.user_id },
      orderBy: { date: 'desc' }
    });
    reply.send(rows.map(publicDonation));
  });

  fastify.get('/api/admin/donations', {
    schema: queryDonationsSchema,
    preHandler: [fastify.requireMembership(['tenant_admin', 'finance_officer'])]
  }, async (request, reply) => {
    const query = request.query as { status?: string; category?: string; reconciliation_status?: string; search?: string };
    const rows = await fastify.prisma.donation.findMany({
      where: {
        mosque_id: request.tenant.mosque_id,
        status: query.status,
        category: query.category,
        reconciliation_status: query.reconciliation_status,
        OR: query.search ? [{ receipt_number: { contains: query.search } }, { external_reference: { contains: query.search } }] : undefined
      },
      orderBy: { date: 'desc' }
    });
    reply.send(rows.map(publicDonation));
  });

  fastify.patch('/api/admin/donations/:id/reconcile', {
    schema: reconcileDonationSchema,
    preHandler: [fastify.requireMembership(['tenant_admin', 'finance_officer'])]
  }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const found = await fastify.prisma.donation.findFirst({ where: { donation_id: id, mosque_id: request.tenant.mosque_id } });
    if (!found) return reply.status(404).send({ error: 'Donation not found.' });
    const actor = request.user as JWTPayload;
    const updated = await fastify.prisma.donation.update({
      where: { donation_id: id },
      data: { reconciliation_status: 'Reconciled', verified_by: actor.user_id }
    });
    await fastify.audit(request, 'donation.reconciled', 'Donation', id, 'Donation reconciled.');
    reply.send(publicDonation(updated));
  });

  fastify.get('/api/admin/donations/export.csv', {
    preHandler: [fastify.requireMembership(['tenant_admin', 'finance_officer'])]
  }, async (request, reply) => {
    const rows = await fastify.prisma.donation.findMany({
      where: { mosque_id: request.tenant.mosque_id },
      orderBy: { date: 'desc' }
    });
    const csv = [
      'receipt,date,amount,currency,category,method,status,reconciliation',
      ...rows.map(d => [
        escapeCsv(d.receipt_number),
        escapeCsv(d.date.toISOString()),
        (d.amount_minor / 100).toFixed(2),
        escapeCsv(d.currency),
        escapeCsv(d.category),
        escapeCsv(d.method),
        escapeCsv(d.status),
        escapeCsv(d.reconciliation_status)
      ].join(','))
    ].join('\n');
    await fastify.audit(request, 'donations.exported', 'DonationReport', null, 'Donation report exported.');
    reply.header('Content-Type', 'text/csv').header('Content-Disposition', 'attachment; filename="donations.csv"').send(csv);
  });
}
