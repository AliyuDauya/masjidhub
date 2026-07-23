import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    adminOnly: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

interface JWTPayload {
  user_id: number;
  email: string;
  role: string;
  mosque_id: number;
}

async function authPlugin(fastify: FastifyInstance) {
  // Register fastify-jwt with a secure secret configuration
  fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'super-secret-key-masjidhub-2026',
  });

  // Middleware hook to verify if request is authenticated
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      
      const payload = request.user as JWTPayload;
      
      // Multi-tenant check: ensure the user belongs to the current request's tenant
      if (request.tenant && payload.mosque_id !== request.tenant.mosque_id) {
        reply.status(403).send({ error: 'Access Denied: You do not belong to this mosque tenant.' });
      }
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized: Invalid or missing token.' });
    }
  });

  // Middleware hook to restrict endpoints to admin users
  fastify.decorate('adminOnly', async (request: FastifyRequest, reply: FastifyReply) => {
    // Run authentication check first
    await fastify.authenticate(request, reply);
    if (reply.sent) return;

    const payload = request.user as JWTPayload;
    
    // Scoped role check
    if (payload.role !== 'admin') {
      reply.status(403).send({ error: 'Forbidden: Requires admin privileges.' });
    }
  });
}

export default fp(authPlugin);
