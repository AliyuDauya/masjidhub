import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { Membership, Mosque } from '@prisma/client';
import { SESSION_COOKIE_NAME } from './security.js';

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
    authType?: 'cookie' | 'bearer';
    cookies: Record<string, string | undefined>;
  }

  interface FastifyReply {
    setCookie(name: string, value: string, options?: any): this;
    clearCookie(name: string, options?: any): this;
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireMembership: (roles?: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    adminOnly: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    platformOnly: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    audit: (request: FastifyRequest, action: string, targetType: string, targetId: string | number | null, summary: string, overrideMosqueId?: number | null) => Promise<void>;
    createCsrfToken: () => string;
    verifyCsrfToken: (token?: string) => boolean;
    setAuthCookies: (reply: FastifyReply, token: string, csrfToken: string) => void;
    clearAuthCookies: (reply: FastifyReply) => void;
  }
}

async function authPlugin(fastify: FastifyInstance) {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production.');
  }

  await fastify.register(fastifyJwt, {
    secret: secret || 'development-only-change-me',
    sign: { expiresIn: '8h' }
  });

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      let token: string | undefined;
      if (request.headers.authorization) {
        const parts = request.headers.authorization.split(' ');
        if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
          token = parts[1];
          request.authType = 'bearer';
        }
      }
      if (!token && request.cookies?.[SESSION_COOKIE_NAME]) {
        token = request.cookies[SESSION_COOKIE_NAME];
        request.authType = 'cookie';
      }

      if (!token) {
        reply.status(401).send({ error: 'Unauthorized: Invalid or missing token.' });
        return;
      }

      const payload = fastify.jwt.verify<JWTPayload>(token);
      request.user = payload;

      const user = await fastify.prisma.user.findUnique({ where: { user_id: payload.user_id } });
      if (!user || user.account_status !== 'Active') {
        reply.status(401).send({ error: 'Account is unavailable.' });
        return;
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
      if (!request.tenant) {
        reply.status(400).send({ error: 'Tenant context is missing.' });
        return;
      }

      // 1. Look up existing membership in the active tenant context
      let membership = await fastify.prisma.membership.findUnique({
        where: { mosque_id_user_id: { mosque_id: request.tenant.mosque_id, user_id: payload.user_id } }
      });

      // 2. If no membership exists yet in this active tenant, auto-link worshipper role for general member requests
      if (!membership) {
        if (roles.length === 0 || (roles.length === 1 && roles[0] === 'member')) {
          membership = await fastify.prisma.membership.create({
            data: {
              mosque_id: request.tenant.mosque_id,
              user_id: payload.user_id,
              role: 'member',
              status: 'Active'
            }
          });
        } else {
          reply.status(403).send({ error: 'Access denied for this mosque workspace.' });
          return;
        }
      }

      if (membership.status !== 'Active') {
        reply.status(403).send({ error: 'Your mosque membership is currently suspended.' });
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

  fastify.decorate('audit', async (request, action, targetType, targetId, summary, overrideMosqueId) => {
    const payload = request.user as JWTPayload | undefined;
    await fastify.prisma.auditEvent.create({
      data: {
        mosque_id: overrideMosqueId !== undefined ? overrideMosqueId : request.tenant?.mosque_id,
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
