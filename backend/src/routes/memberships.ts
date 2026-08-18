import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { tenantHook } from '../middleware/tenantHook.js';
import {
  inviteMembershipSchema,
  updateMembershipSchema
} from '../schemas/index.js';

const roles = ['tenant_admin', 'finance_officer', 'programme_officer', 'communications_officer', 'member'];

export default async function membershipRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', tenantHook);
  fastify.addHook('preHandler', fastify.adminOnly);

  fastify.get('/api/admin/memberships', async (request, reply) => {
    const rows = await fastify.prisma.membership.findMany({
      where: { mosque_id: request.tenant.mosque_id },
      include: { user: { select: { user_id: true, name: true, email: true, phone: true, account_status: true } } },
      orderBy: { joined_at: 'desc' }
    });
    reply.send(rows);
  });

  fastify.post('/api/admin/memberships/invite', {
    schema: inviteMembershipSchema
  }, async (request, reply) => {
    const { name, email, role = 'member', temporary_password } = request.body as { name?: string; email?: string; role?: string; temporary_password?: string };
    if (!name || !email || !temporary_password || !roles.includes(role)) return reply.status(400).send({ error: 'Name, email, valid role, and temporary password are required.' });
    if (temporary_password.length < 8) return reply.status(400).send({ error: 'Temporary password must contain at least 8 characters.' });
    const normalized = email.toLowerCase();
    let user = await fastify.prisma.user.findUnique({ where: { email: normalized } });
    if (!user) user = await fastify.prisma.user.create({ data: { name, email: normalized, password_hash: await bcrypt.hash(temporary_password, 12) } });
    const existing = await fastify.prisma.membership.findUnique({ where: { mosque_id_user_id: { mosque_id: request.tenant.mosque_id, user_id: user.user_id } } });
    if (existing) return reply.status(409).send({ error: 'User already has a mosque membership.' });
    const membership = await fastify.prisma.membership.create({ data: { mosque_id: request.tenant.mosque_id, user_id: user.user_id, role, status: 'Active' } });
    await fastify.audit(request, 'membership.invited', 'Membership', membership.membership_id, `${normalized} added as ${role}.`);
    reply.status(201).send(membership);
  });

  fastify.patch('/api/admin/memberships/:id', {
    schema: updateMembershipSchema
  }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const { role, status } = request.body as { role?: string; status?: string };
    if (role && !roles.includes(role)) return reply.status(400).send({ error: 'Invalid role.' });
    if (status && !['Active', 'Suspended'].includes(status)) return reply.status(400).send({ error: 'Invalid membership status.' });
    const membership = await fastify.prisma.membership.findFirst({ where: { membership_id: id, mosque_id: request.tenant.mosque_id } });
    if (!membership) return reply.status(404).send({ error: 'Membership not found.' });
    const updated = await fastify.prisma.membership.update({ where: { membership_id: id }, data: { role, status } });
    await fastify.audit(request, 'membership.updated', 'Membership', id, 'Membership permissions updated.');
    reply.send(updated);
  });
}
