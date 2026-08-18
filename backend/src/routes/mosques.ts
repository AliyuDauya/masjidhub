import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { tenantHook } from '../middleware/tenantHook.js';
import { createMosqueSchema, getMosqueSchema, updateMosqueSchema } from '../schemas/index.js';

interface CreateMosqueBody {
  name: string; slug: string; address?: string; phone?: string; email?: string;
  admin_name: string; admin_email: string; admin_password: string;
}

export default async function mosqueRoutes(fastify: FastifyInstance) {
  fastify.get('/api/mosques', async (_request, reply) => {
    const mosques = await fastify.prisma.mosque.findMany({
      where: { status: 'Active' },
      select: { mosque_id: true, name: true, slug: true, address: true, brand_color: true },
      orderBy: { name: 'asc' }
    });
    reply.send(mosques);
  });

  fastify.post('/api/mosques', {
    schema: createMosqueSchema
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as CreateMosqueBody;
    const formattedSlug = body.slug?.toLowerCase().trim().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
    if (!body.name?.trim() || !formattedSlug || !body.admin_name?.trim() || !body.admin_email || !body.admin_password) {
      return reply.status(400).send({ error: 'Mosque name, slug, and administrator details are required.' });
    }
    if (body.admin_password.length < 8) return reply.status(400).send({ error: 'Administrator password must contain at least 8 characters.' });
    if (await fastify.prisma.mosque.findUnique({ where: { slug: formattedSlug } })) {
      return reply.status(409).send({ error: 'A mosque with this slug already exists.' });
    }
    const normalizedEmail = body.admin_email.trim().toLowerCase();
    const existingUser = await fastify.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) return reply.status(409).send({ error: 'Administrator email already has an account. Tenant joining requires an invitation.' });

    const password_hash = await bcrypt.hash(body.admin_password, 12);
    const result = await fastify.prisma.$transaction(async (tx) => {
      const mosque = await tx.mosque.create({
        data: {
          name: body.name.trim(),
          slug: formattedSlug,
          address: body.address,
          phone: body.phone,
          email: body.email?.trim().toLowerCase(),
          status: 'Pending'
        }
      });
      const user = await tx.user.create({ data: { name: body.admin_name.trim(), email: normalizedEmail, password_hash } });
      const membership = await tx.membership.create({ data: { mosque_id: mosque.mosque_id, user_id: user.user_id, role: 'tenant_admin' } });
      await tx.auditEvent.create({
        data: {
          mosque_id: mosque.mosque_id,
          actor_id: user.user_id,
          action: 'tenant.applied',
          target_type: 'Mosque',
          target_id: String(mosque.mosque_id),
          summary: 'Mosque application submitted.',
          request_id: request.id,
          ip_address: request.ip
        }
      });
      return { mosque, membership_id: membership.membership_id };
    });
    reply.status(201).send({ ...result.mosque, message: 'Application submitted for platform approval.' });
  });

  fastify.get('/api/mosques/:slug', {
    schema: getMosqueSchema
  }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const mosque = await fastify.prisma.mosque.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { mosque_id: true, name: true, slug: true, status: true, address: true, phone: true, email: true, timezone: true, brand_color: true, logo_url: true }
    });
    if (!mosque) return reply.status(404).send({ error: `Mosque with slug "${slug}" not found.` });
    reply.send(mosque);
  });

  fastify.put('/api/mosques/:slug', {
    schema: updateMosqueSchema,
    preHandler: [tenantHook, fastify.adminOnly]
  }, async (request, reply) => {
    const body = request.body as Partial<{ name: string; address: string; phone: string; email: string; timezone: string; brand_color: string; logo_url: string; notification_email: boolean; notification_in_app: boolean }>;
    const updated = await fastify.prisma.mosque.update({
      where: { mosque_id: request.tenant.mosque_id },
      data: {
        name: body.name?.trim(),
        address: body.address,
        phone: body.phone,
        email: body.email?.trim().toLowerCase(),
        timezone: body.timezone,
        brand_color: body.brand_color,
        logo_url: body.logo_url,
        notification_email: body.notification_email,
        notification_in_app: body.notification_in_app
      }
    });
    await fastify.audit(request, 'tenant.updated', 'Mosque', updated.mosque_id, 'Mosque settings updated.');
    reply.send(updated);
  });
}
