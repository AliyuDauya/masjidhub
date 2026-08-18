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
    const { id } = request.params as { id: string };
    const { status } = request.body as { status?: string };
    if (!['Active', 'Suspended'].includes(status || '')) return reply.status(400).send({ error: 'Status must be Active or Suspended.' });
    const mosque = await fastify.prisma.mosque.update({ where: { mosque_id: Number(id) }, data: { status } });
    await fastify.prisma.auditEvent.create({
      data: {
        actor_id: (request.user as { user_id: number }).user_id,
        mosque_id: mosque.mosque_id,
        action: `tenant.${status!.toLowerCase()}`,
        target_type: 'Mosque',
        target_id: id,
        summary: `Tenant marked ${status}.`,
        request_id: request.id,
        ip_address: request.ip
      }
    });
    reply.send(mosque);
  });

  fastify.get('/api/platform/metrics', { preHandler: [fastify.platformOnly] }, async (_request, reply) => {
    const [tenants, users, memberships, auditEvents] = await Promise.all([
      fastify.prisma.mosque.groupBy({ by: ['status'], _count: true }),
      fastify.prisma.user.count(),
      fastify.prisma.membership.count(),
      fastify.prisma.auditEvent.count()
    ]);
    reply.send({ tenants, users, memberships, auditEvents });
  });
}
