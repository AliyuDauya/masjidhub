import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { Membership, Mosque } from '@prisma/client';

export interface JWTPayload {
  user_id: number;
  email: string;
  membership_id?: number;
  role?: string;
  mosque_id?: number;
  platform_role?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    tenant: Mosque;
    membership?: Membership;
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireMembership: (roles?: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    adminOnly: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    platformOnly: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    audit: (request: FastifyRequest, action: string, targetType: string, targetId: string | number | null, summary: string) => Promise<void>;
  }
}

async function authPlugin(fastify: FastifyInstance) {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production.');
  }

  fastify.register(fastifyJwt, {
    secret: secret || 'development-only-change-me',
    sign: { expiresIn: '8h' }
  });

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const payload = request.user as JWTPayload;
      const user = await fastify.prisma.user.findUnique({ where: { user_id: payload.user_id } });
      if (!user || user.account_status !== 'Active') {
        reply.status(401).send({ error: 'Account is unavailable.' });
      }
    } catch {
      if (!reply.sent) reply.status(401).send({ error: 'Unauthorized: Invalid or missing token.' });
    }
  });

  fastify.decorate('requireMembership', (roles: string[] = []) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      await fastify.authenticate(request, reply);
      if (reply.sent) return;

      const payload = request.user as JWTPayload;
      if (!request.tenant || !payload.membership_id || payload.mosque_id !== request.tenant.mosque_id) {
        reply.status(403).send({ error: 'Access denied for this mosque.' });
        return;
      }

      const membership = await fastify.prisma.membership.findUnique({
        where: { membership_id: payload.membership_id }
      });
      if (!membership || membership.status !== 'Active' || membership.user_id !== payload.user_id || membership.mosque_id !== request.tenant.mosque_id) {
        reply.status(403).send({ error: 'Your mosque membership is unavailable.' });
        return;
      }

      if (roles.length > 0 && !roles.includes(membership.role)) {
        reply.status(403).send({ error: 'You do not have permission to perform this action.' });
        return;
      }
      request.membership = membership;
    };
  });

  fastify.decorate('adminOnly', async (request: FastifyRequest, reply: FastifyReply) => {
    await fastify.requireMembership(['tenant_admin'])(request, reply);
  });

  fastify.decorate('platformOnly', async (request: FastifyRequest, reply: FastifyReply) => {
    await fastify.authenticate(request, reply);
    if (reply.sent) return;
    const payload = request.user as JWTPayload;
    if (payload.platform_role !== 'super_admin') {
      reply.status(403).send({ error: 'Platform administrator access is required.' });
    }
  });

  fastify.decorate('audit', async (request, action, targetType, targetId, summary) => {
    const payload = request.user as JWTPayload | undefined;
    await fastify.prisma.auditEvent.create({
      data: {
        mosque_id: request.tenant?.mosque_id,
        actor_id: payload?.user_id,
        action,
        target_type: targetType,
        target_id: targetId == null ? null : String(targetId),
        summary,
        request_id: request.id,
        ip_address: request.ip
      }
    });
  });
}

export default fp(authPlugin);
