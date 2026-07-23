import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { tenantHook } from '../middleware/tenantHook.js';

interface WebDonationBody {
  amount: number;
  category: 'Zakat' | 'Sadaqah' | 'Waqf' | 'General';
  method: 'Card' | 'Transfer';
}

interface ManualDonationBody {
  amount: number;
  category: 'Zakat' | 'Sadaqah' | 'Waqf' | 'General';
  method: 'Cash';
  donor_name?: string;
  donor_email?: string;
}

interface JWTPayload {
  user_id: number;
  email: string;
  role: string;
  mosque_id: number;
}

export default async function donationRoutes(fastify: FastifyInstance) {
  // Apply tenantHook as a preHandler for all routes in this plugin
  fastify.addHook('preHandler', tenantHook);

  // POST /api/donations - Public/Member online checkout simulation endpoint
  fastify.post('/api/donations', async (request: FastifyRequest, reply: FastifyReply) => {
    const { amount, category, method } = request.body as WebDonationBody;

    if (!amount || !category || !method) {
      reply.status(400).send({ error: 'Amount, category, and payment method are required.' });
      return;
    }

    if (amount <= 0) {
      reply.status(400).send({ error: 'Donation amount must be greater than zero.' });
      return;
    }

    const categories = ['Zakat', 'Sadaqah', 'Waqf', 'General'];
    if (!categories.includes(category)) {
      reply.status(400).send({ error: 'Invalid donation category.' });
      return;
    }

    if (method !== 'Card' && method !== 'Transfer') {
      reply.status(400).send({ error: 'Invalid web donation payment method.' });
      return;
    }

    // Try to resolve user token if they are logged in (donation is optional-auth)
    let authenticatedUserId: number | null = null;
    try {
      const decoded = await request.jwtVerify() as JWTPayload;
      if (decoded && decoded.mosque_id === request.tenant.mosque_id) {
        authenticatedUserId = decoded.user_id;
      }
    } catch (err) {
      // Allow anonymous donations by ignoring signature verification failures
    }

    try {
      // Simulate transaction processing delay & success confirmation
      const donation = await fastify.prisma.donation.create({
        data: {
          mosque_id: request.tenant.mosque_id,
          user_id: authenticatedUserId,
          amount,
          category,
          method,
          status: 'Completed', // Autocompleted for simulation
          date: new Date()
        }
      });

      reply.status(201).send(donation);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ error: 'Failed to record donation.' });
    }
  });

  // POST /api/admin/donations/manual - Admins manually record offline cash donations
  fastify.post('/api/admin/donations/manual', {
    preHandler: [fastify.adminOnly]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { amount, category, method, donor_email } = request.body as ManualDonationBody;

    if (!amount || !category || method !== 'Cash') {
      reply.status(400).send({ error: 'Amount, category, and cash payment method are required.' });
      return;
    }

    if (amount <= 0) {
      reply.status(400).send({ error: 'Donation amount must be greater than zero.' });
      return;
    }

    // Attempt to link member if email is supplied
    let donorUserId: number | null = null;
    if (donor_email) {
      const member = await fastify.prisma.user.findFirst({
        where: {
          mosque_id: request.tenant.mosque_id,
          email: donor_email.toLowerCase()
        }
      });
      if (member) {
        donorUserId = member.user_id;
      }
    }

    try {
      const donation = await fastify.prisma.donation.create({
        data: {
          mosque_id: request.tenant.mosque_id,
          user_id: donorUserId,
          amount,
          category,
          method: 'Cash',
          status: 'Completed',
          date: new Date()
        }
      });

      reply.status(201).send(donation);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ error: 'Failed to log offline manual donation.' });
    }
  });

  // GET /api/members/donations - Members retrieve their past contributions
  fastify.get('/api/members/donations', {
    preHandler: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.user as JWTPayload;

    try {
      const contributions = await fastify.prisma.donation.findMany({
        where: {
          mosque_id: request.tenant.mosque_id,
          user_id: payload.user_id
        },
        orderBy: { date: 'desc' }
      });
      reply.send(contributions);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ error: 'Failed to retrieve donation history.' });
    }
  });

  // GET /api/admin/donations - Admins fetch all donation logs for report compilation
  fastify.get('/api/admin/donations', {
    preHandler: [fastify.adminOnly]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const logs = await fastify.prisma.donation.findMany({
        where: { mosque_id: request.tenant.mosque_id },
        orderBy: { date: 'desc' }
      });
      reply.send(logs);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ error: 'Failed to fetch donations log.' });
    }
  });
}
