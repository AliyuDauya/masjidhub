import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { tenantHook } from '../middleware/tenantHook.js';

export default async function analyticsRoutes(fastify: FastifyInstance) {
  // Apply tenantHook and adminOnly constraints for all routes in this plugin
  fastify.addHook('preHandler', tenantHook);
  fastify.addHook('preHandler', fastify.adminOnly);

  // GET /api/admin/analytics/donations - Aggregated stats on donations
  fastify.get('/api/admin/analytics/donations', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const donations = await fastify.prisma.donation.findMany({
        where: { mosque_id: request.tenant.mosque_id }
      });

      let totalDonated = 0;
      const byCategory: Record<string, number> = { Zakat: 0, Sadaqah: 0, Waqf: 0, General: 0 };
      const byMethod: Record<string, number> = { Card: 0, Transfer: 0, Cash: 0 };

      donations.forEach((d) => {
        totalDonated += d.amount;
        if (byCategory[d.category] !== undefined) {
          byCategory[d.category] += d.amount;
        } else {
          byCategory[d.category] = d.amount;
        }

        if (byMethod[d.method] !== undefined) {
          byMethod[d.method] += d.amount;
        } else {
          byMethod[d.method] = d.amount;
        }
      });

      reply.send({
        totalDonationsCount: donations.length,
        totalDonated,
        byCategory,
        byMethod
      });
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ error: 'Failed to compile donation analytics.' });
    }
  });

  // GET /api/admin/analytics/registrations - Stats on program registrations & seat metrics
  fastify.get('/api/admin/analytics/registrations', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const programs = await fastify.prisma.program.findMany({
        where: { mosque_id: request.tenant.mosque_id },
        include: { registrations: true }
      });

      const analytics = programs.map((p) => {
        const activeRegistrations = p.registrations.filter((r) => r.status === 'Registered').length;
        const fillRate = p.max_capacity > 0 ? (activeRegistrations / p.max_capacity) * 100 : 100; // 100% if unlimited

        return {
          program_id: p.program_id,
          title: p.title,
          max_capacity: p.max_capacity,
          activeRegistrations,
          fillRate: parseFloat(fillRate.toFixed(2))
        };
      });

      reply.send(analytics);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ error: 'Failed to compile registration analytics.' });
    }
  });
}
