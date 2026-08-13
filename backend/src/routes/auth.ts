import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { tenantHook } from '../middleware/tenantHook.js';
import type { JWTPayload } from '../plugins/auth.js';

interface RegisterBody { name: string; email: string; password: string; phone?: string }
interface LoginBody { email: string; password: string }

function tokenFor(fastify: FastifyInstance, user: { user_id: number; email: string; platform_role: string | null }, membership?: { membership_id: number; mosque_id: number; role: string }) {
  return fastify.jwt.sign({
    user_id: user.user_id,
    email: user.email,
    platform_role: user.platform_role || undefined,
    membership_id: membership?.membership_id,
    mosque_id: membership?.mosque_id,
    role: membership?.role
  });
}

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/api/auth/register', { preHandler: [tenantHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, email, password, phone } = request.body as RegisterBody;
    if (!name?.trim() || !email?.trim() || !password) {
      reply.status(400).send({ error: 'Name, email, and password are required.' });
      return;
    }
    if (password.length < 8) {
      reply.status(400).send({ error: 'Password must contain at least 8 characters.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await fastify.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      const membership = await fastify.prisma.membership.findUnique({
        where: { mosque_id_user_id: { mosque_id: request.tenant.mosque_id, user_id: existing.user_id } }
      });
      if (membership) {
        reply.status(409).send({ error: 'This account already belongs to the mosque.' });
        return;
      }
      reply.status(409).send({ error: 'An account with this email exists. Sign in before joining another mosque.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await fastify.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name: name.trim(), email: normalizedEmail, password_hash: passwordHash, phone } });
      const membership = await tx.membership.create({ data: { mosque_id: request.tenant.mosque_id, user_id: user.user_id, role: 'member' } });
      return { user, membership };
    });
    await fastify.audit(request, 'membership.registered', 'Membership', result.membership.membership_id, `${result.user.email} joined as a member.`);
    reply.status(201).send({
      user: { user_id: result.user.user_id, name: result.user.name, email: result.user.email },
      membership: result.membership,
      token: tokenFor(fastify, result.user, result.membership)
    });
  });

  fastify.post('/api/auth/login', { preHandler: [tenantHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = request.body as LoginBody;
    if (!email || !password) {
      reply.status(400).send({ error: 'Email and password are required.' });
      return;
    }
    const user = await fastify.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || user.account_status !== 'Active' || !(await bcrypt.compare(password, user.password_hash))) {
      reply.status(401).send({ error: 'Invalid email or password.' });
      return;
    }
    const membership = await fastify.prisma.membership.findUnique({
      where: { mosque_id_user_id: { mosque_id: request.tenant.mosque_id, user_id: user.user_id } }
    });
    if (!membership || membership.status !== 'Active') {
      reply.status(403).send({ error: 'You do not have an active membership in this mosque.' });
      return;
    }
    reply.send({
      token: tokenFor(fastify, user, membership),
      user: { user_id: user.user_id, name: user.name, email: user.email, platform_role: user.platform_role },
      membership: { membership_id: membership.membership_id, mosque_id: membership.mosque_id, role: membership.role }
    });
  });

  fastify.get('/api/auth/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const payload = request.user as JWTPayload;
    const user = await fastify.prisma.user.findUnique({
      where: { user_id: payload.user_id },
      select: { user_id: true, name: true, email: true, phone: true, platform_role: true, account_status: true,
        memberships: { include: { mosque: { select: { mosque_id: true, name: true, slug: true, status: true, brand_color: true } } } } }
    });
    reply.send(user);
  });

  fastify.post('/api/auth/switch-tenant/:slug', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const payload = request.user as JWTPayload;
    const { slug } = request.params as { slug: string };
    const mosque = await fastify.prisma.mosque.findUnique({ where: { slug: slug.toLowerCase() } });
    if (!mosque || mosque.status !== 'Active') return reply.status(404).send({ error: 'Active mosque not found.' });
    const membership = await fastify.prisma.membership.findUnique({
      where: { mosque_id_user_id: { mosque_id: mosque.mosque_id, user_id: payload.user_id } }
    });
    if (!membership || membership.status !== 'Active') return reply.status(403).send({ error: 'Active membership required.' });
    const user = await fastify.prisma.user.findUniqueOrThrow({ where: { user_id: payload.user_id } });
    reply.send({ token: tokenFor(fastify, user, membership), mosque, role: membership.role });
  });
}
