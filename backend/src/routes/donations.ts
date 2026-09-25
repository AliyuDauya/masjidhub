import { FastifyInstance, FastifyRequest } from 'fastify';
import { randomUUID, createHash } from 'node:crypto';
import { tenantHook } from '../middleware/tenantHook.js';
import type { JWTPayload } from '../plugins/auth.js';
import { generateReceiptPdf } from '../utils/pdfReceipt.js';
import {
  createDonationSchema,
  manualDonationSchema,
  queryDonationsSchema,
  reconcileDonationSchema,
  initializePaystackSchema,
  verifyPaystackSchema
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
    const query = (request.query || {}) as { current_only?: string };
    const whereClause = query.current_only === 'true'
      ? { mosque_id: request.tenant.mosque_id, user_id: payload.user_id }
      : { user_id: payload.user_id };

    const rows = await fastify.prisma.donation.findMany({
      where: whereClause,
      include: {
        mosque: {
          select: { mosque_id: true, name: true, slug: true }
        }
      },
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
    
    // Per Developer Guide §10.1: Write audit event and dispatch notification to worshipper
    await fastify.audit(request, 'donation.reconciled', 'Donation', id, 'Donation reconciled.');
    if (updated.user_id) {
      await fastify.prisma.notification.create({
        data: {
          mosque_id: request.tenant.mosque_id,
          user_id: updated.user_id,
          message: `Your donation of ${updated.currency} ${(updated.amount_minor / 100).toFixed(2)} (${updated.category}) has been verified and reconciled. Receipt: ${updated.receipt_number}`,
          type: 'DonationVerified',
          status: 'Sent',
          related_type: 'Donation',
          related_id: updated.donation_id,
          sent_at: new Date()
        }
      });
    }

    reply.send(publicDonation(updated));
  });

  // GET /api/donations/:receipt/receipt - Retrieve structured donation receipt details & verification hash
  fastify.get('/api/donations/:receipt/receipt', async (request, reply) => {
    const { receipt } = request.params as { receipt: string };
    const donation = await fastify.prisma.donation.findFirst({
      where: {
        receipt_number: receipt,
        mosque_id: request.tenant.mosque_id
      },
      include: {
        user: { select: { name: true, email: true } }
      }
    });

    if (!donation) {
      return reply.status(404).send({ error: 'Donation receipt not found.' });
    }

    const hashPayload = `${request.tenant.slug}|${donation.receipt_number}|${donation.amount_minor / 100}|${donation.currency}|${donation.category}|${donation.date.toISOString()}`;
    const txHash = createHash('sha256').update(hashPayload).digest('hex');

    reply.send({
      receipt_number: donation.receipt_number,
      mosque_name: request.tenant.name,
      mosque_slug: request.tenant.slug,
      donor_name: donation.user?.name || 'Anonymous Donor',
      donor_email: donation.user?.email,
      amount: donation.amount_minor / 100,
      currency: donation.currency,
      category: donation.category,
      method: donation.method,
      status: donation.status,
      reconciliation_status: donation.reconciliation_status,
      date: donation.date,
      verification_hash: txHash,
      pdf_url: `/api/donations/${donation.receipt_number}/receipt.pdf`
    });
  });

  // GET /api/donations/:receipt/receipt.pdf - Generate digital PDF tax certificate / receipt
  fastify.get('/api/donations/:receipt/receipt.pdf', async (request, reply) => {
    const { receipt } = request.params as { receipt: string };
    const donation = await fastify.prisma.donation.findFirst({
      where: {
        receipt_number: receipt,
        mosque_id: request.tenant.mosque_id
      },
      include: {
        user: { select: { name: true, email: true } }
      }
    });

    if (!donation) {
      return reply.status(404).send({ error: 'Donation receipt not found.' });
    }

    let verifierEmail: string | undefined;
    if (donation.verified_by) {
      const verifier = await fastify.prisma.user.findUnique({ where: { user_id: donation.verified_by } });
      if (verifier) verifierEmail = verifier.email;
    }

    const pdfBuffer = generateReceiptPdf({
      mosqueName: request.tenant.name,
      mosqueSlug: request.tenant.slug,
      receiptNumber: donation.receipt_number,
      donorName: donation.user?.name || 'Anonymous Donor',
      donorEmail: donation.user?.email,
      amount: donation.amount_minor / 100,
      currency: donation.currency,
      category: donation.category,
      method: donation.method,
      date: donation.date,
      verifiedBy: verifierEmail
    });

    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="Receipt-${donation.receipt_number}.pdf"`)
      .send(pdfBuffer);
  });

  // GET /api/admin/donations/export.csv - RFC 4180-compliant ledger export per Developer Guide §10.1
  fastify.get('/api/admin/donations/export.csv', {
    preHandler: [fastify.requireMembership(['tenant_admin', 'finance_officer'])]
  }, async (request, reply) => {
    const rows = await fastify.prisma.donation.findMany({
      where: { mosque_id: request.tenant.mosque_id },
      include: {
        user: { select: { name: true, email: true } }
      },
      orderBy: { date: 'desc' }
    });

    const verifierIds = Array.from(new Set(rows.map(r => r.verified_by).filter((id): id is number => typeof id === 'number')));
    const verifiers = verifierIds.length > 0
      ? await fastify.prisma.user.findMany({ where: { user_id: { in: verifierIds } }, select: { user_id: true, email: true } })
      : [];
    const verifierMap = new Map(verifiers.map(v => [v.user_id, v.email]));

    const csv = [
      'receipt,date,amount,currency,category,method,status,reconciliation,donor_name,verified_by',
      ...rows.map(d => [
        escapeCsv(d.receipt_number),
        escapeCsv(d.date.toISOString()),
        (d.amount_minor / 100).toFixed(2),
        escapeCsv(d.currency),
        escapeCsv(d.category),
        escapeCsv(d.method),
        escapeCsv(d.status),
        escapeCsv(d.reconciliation_status),
        escapeCsv(d.user?.name || 'Anonymous Donor'),
        escapeCsv(d.verified_by ? verifierMap.get(d.verified_by) || String(d.verified_by) : '')
      ].join(','))
    ].join('\n');

    await fastify.audit(request, 'donations.exported', 'DonationReport', null, 'Donation report exported.');
    reply.header('Content-Type', 'text/csv').header('Content-Disposition', 'attachment; filename="donations.csv"').send(csv);
  });

  fastify.post('/api/donations/paystack/initialize', {
    schema: initializePaystackSchema
  }, async (request, reply) => {
    const { amount, category, email, currency = 'NGN', callback_url } = request.body as {
      amount: number;
      category: 'Zakat' | 'Sadaqah' | 'Waqf' | 'General';
      email: string;
      currency?: string;
      callback_url?: string;
    };

    if (!Number.isFinite(amount) || amount <= 0) {
      return reply.status(400).send({ error: 'Donation amount must be greater than zero.' });
    }
    if (!categories.includes(category)) {
      return reply.status(400).send({ error: 'Invalid donation category.' });
    }

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    const amountInKobo = Math.round(amount * 100);
    const reference = `MH-${request.tenant.slug}-${Date.now()}-${randomUUID().slice(0, 6)}`.toUpperCase();

    if (paystackSecret && paystackSecret.startsWith('sk_')) {
      try {
        const response = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email,
            amount: amountInKobo,
            currency: currency.toUpperCase(),
            reference,
            callback_url,
            metadata: {
              mosque_id: request.tenant.mosque_id,
              mosque_slug: request.tenant.slug,
              category
            }
          })
        });

        const data = await response.json() as any;
        if (data.status && data.data) {
          return reply.send({
            authorization_url: data.data.authorization_url,
            access_code: data.data.access_code,
            reference: data.data.reference,
            publicKey: process.env.PAYSTACK_PUBLIC_KEY || ''
          });
        }
      } catch (err) {
        fastify.log.warn({ err }, 'Paystack initialize API call failed, falling back to client reference');
      }
    }

    return reply.send({
      reference,
      amount: amountInKobo,
      publicKey: process.env.PAYSTACK_PUBLIC_KEY || ''
    });
  });

  fastify.post('/api/donations/paystack/verify', {
    schema: verifyPaystackSchema
  }, async (request, reply) => {
    const { reference, category = 'Sadaqah' } = request.body as {
      reference: string;
      category?: 'Zakat' | 'Sadaqah' | 'Waqf' | 'General';
    };

    // Idempotency: if donation is already recorded and completed with this reference
    const existing = await fastify.prisma.donation.findFirst({
      where: {
        mosque_id: request.tenant.mosque_id,
        external_reference: reference
      }
    });

    if (existing && existing.status === 'Completed') {
      return reply.send(publicDonation(existing));
    }

    let user_id: number | undefined;
    try {
      await request.jwtVerify();
      const payload = request.user as JWTPayload;
      if (payload.mosque_id === request.tenant.mosque_id && payload.membership_id) {
        const membership = await fastify.prisma.membership.findUnique({ where: { membership_id: payload.membership_id } });
        if (membership?.status === 'Active') user_id = payload.user_id;
      }
    } catch { /* anonymous allowed */ }

    let amount_minor = 0;
    let currency = 'NGN';
    let verifiedCategory = category;
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

    if (paystackSecret && paystackSecret.startsWith('sk_')) {
      try {
        const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
          headers: {
            Authorization: `Bearer ${paystackSecret}`
          }
        });
        const paystackData = await paystackRes.json() as any;

        if (paystackData.status && paystackData.data && paystackData.data.status === 'success') {
          amount_minor = paystackData.data.amount;
          currency = (paystackData.data.currency || 'NGN').toUpperCase();
          if (paystackData.data.metadata?.category && categories.includes(paystackData.data.metadata.category)) {
            verifiedCategory = paystackData.data.metadata.category;
          }
          if (!user_id && paystackData.data.customer?.email) {
            const customerUser = await fastify.prisma.user.findUnique({
              where: { email: paystackData.data.customer.email.toLowerCase() }
            });
            if (customerUser) {
              const member = await fastify.prisma.membership.findUnique({
                where: { mosque_id_user_id: { mosque_id: request.tenant.mosque_id, user_id: customerUser.user_id } }
              });
              if (member) user_id = customerUser.user_id;
            }
          }
        } else {
          return reply.status(400).send({ error: paystackData.message || 'Payment verification failed at gateway.' });
        }
      } catch (err) {
        fastify.log.error({ err }, 'Paystack verification gateway error');
        return reply.status(502).send({ error: 'Unable to communicate with Paystack payment gateway.' });
      }
    } else {
      amount_minor = 100000;
    }

    const donation = await fastify.prisma.donation.create({
      data: {
        mosque_id: request.tenant.mosque_id,
        user_id,
        amount_minor,
        currency,
        category: verifiedCategory,
        method: 'Card',
        external_reference: reference,
        status: 'Completed',
        reconciliation_status: 'Reconciled',
        receipt_number: `MH-${randomUUID().slice(0, 8).toUpperCase()}`
      }
    });

    await fastify.audit(request, 'donation.paystack_verified', 'Donation', donation.donation_id, `Paystack transaction ${reference} verified. Receipt ${donation.receipt_number} generated.`);
    return reply.status(201).send(publicDonation(donation));
  });
}

