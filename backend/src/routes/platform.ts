import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { setAuthCookies, clearAuthCookies, createCsrfToken } from '../plugins/security.js';
import { platformLoginSchema, updateTenantStatusSchema } from '../schemas/index.js';

export default async function platformRoutes(fastify: FastifyInstance) {
  fastify.post('/api/platform/auth/login', {
    schema: platformLoginSchema
  }, async (request, reply) => {
    const { email, password } = request.body as { email?: string; password?: string };
    if (!email || !password) return reply.status(400).send({ error: 'Email and password are required.' });
    const user = await fastify.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || user.platform_role !== 'super_admin' || !(await bcrypt.compare(password, user.password_hash))) {
      return reply.status(401).send({ error: 'Invalid platform administrator credentials.' });
    }
    const token = fastify.jwt.sign({ user_id: user.user_id, email: user.email, platform_role: user.platform_role });
    const csrfToken = createCsrfToken();
    setAuthCookies(reply, token, csrfToken);

    reply.send({
      token,
      csrfToken,
      user: { user_id: user.user_id, name: user.name, email: user.email, platform_role: user.platform_role }
    });
  });

  fastify.post('/api/platform/auth/logout', async (_request, reply) => {
    clearAuthCookies(reply);
    reply.send({ success: true, message: 'Platform logged out successfully.' });
  });

  fastify.get('/api/platform/tenants', { preHandler: [fastify.platformOnly] }, async (_request, reply) => {
    const tenants = await fastify.prisma.mosque.findMany({
      include: { _count: { select: { memberships: true, donations: true, programs: true } } },
      orderBy: { created_at: 'desc' }
    });
    reply.send(tenants);
  });

  fastify.patch('/api/platform/tenants/:id/status', {
    schema: updateTenantStatusSchema,
    preHandler: [fastify.platformOnly]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string | number };
      const { status } = request.body as { status?: string };
      if (!['Active', 'Suspended'].includes(status || '')) {
        return reply.status(400).send({ error: 'Status must be Active or Suspended.' });
      }

      const mosqueId = Number(id);
      if (isNaN(mosqueId)) {
        return reply.status(400).send({ error: 'Invalid mosque ID.' });
      }

      const existingMosque = await fastify.prisma.mosque.findUnique({ where: { mosque_id: mosqueId } });
      if (!existingMosque) {
        return reply.status(404).send({ error: 'Mosque tenant not found.' });
      }

      const mosque = await fastify.prisma.mosque.update({
        where: { mosque_id: mosqueId },
        data: { status }
      });

      const actorId = (request.user as { user_id?: number })?.user_id;
      const actor = actorId ? await fastify.prisma.user.findUnique({ where: { user_id: actorId } }) : null;

      await fastify.prisma.auditEvent.create({
        data: {
          actor_id: actor ? actor.user_id : null,
          mosque_id: mosque.mosque_id,
          action: `tenant.${status!.toLowerCase()}`,
          target_type: 'Mosque',
          target_id: String(mosqueId),
          summary: `Tenant ${mosque.name} marked as ${status}.`,
          request_id: request.id || null,
          ip_address: request.ip || null
        }
      }).catch((auditErr) => {
        request.log.warn({ err: auditErr }, 'Failed to create audit event for tenant status update');
      });

      return reply.send(mosque);
    } catch (err: any) {
      request.log.error({ err }, 'Error updating tenant status');
      return reply.status(500).send({ error: err?.message || 'Failed to update tenant status.' });
    }
  });

  fastify.get('/api/platform/metrics', { preHandler: [fastify.platformOnly] }, async (_request, reply) => {
    const [tenants, users, memberships, auditEvents, donations, programs] = await Promise.all([
      fastify.prisma.mosque.groupBy({ by: ['status'], _count: true }),
      fastify.prisma.user.count(),
      fastify.prisma.membership.count(),
      fastify.prisma.auditEvent.count(),
      fastify.prisma.donation.count(),
      fastify.prisma.program.count()
    ]);
    reply.send({ tenants, users, memberships, auditEvents, donations, programs });
  });

  fastify.get('/api/platform/audit-events', { preHandler: [fastify.platformOnly] }, async (_request, reply) => {
    const events = await fastify.prisma.auditEvent.findMany({
      include: {
        actor: { select: { name: true, email: true } },
        mosque: { select: { name: true, slug: true } }
      },
      orderBy: { created_at: 'desc' },
      take: 150
    });
    reply.send(events);
  });

  fastify.get('/api/platform/users', { preHandler: [fastify.platformOnly] }, async (_request, reply) => {
    const users = await fastify.prisma.user.findMany({
      select: {
        user_id: true,
        name: true,
        email: true,
        phone: true,
        platform_role: true,
        account_status: true,
        created_at: true,
        memberships: {
          select: {
            membership_id: true,
            role: true,
            status: true,
            mosque: { select: { name: true, slug: true } }
          }
        }
      },
      orderBy: { created_at: 'desc' },
      take: 200
    });
    reply.send(users);
  });
}
