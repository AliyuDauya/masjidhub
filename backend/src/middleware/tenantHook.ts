import { FastifyRequest, FastifyReply } from 'fastify';
import { Mosque } from '@prisma/client';

declare module 'fastify' {
  interface FastifyRequest {
    tenant: Mosque;
  }
}

export async function tenantHook(request: FastifyRequest, reply: FastifyReply) {
  // Extract slug from headers or params
  const slug = (request.headers['x-mosque-slug'] as string) || (request.params as any)?.slug;

  if (!slug) {
    reply.status(400).send({ error: 'Missing X-Mosque-Slug tenant context header or route parameter.' });
    return;
  }

  // Retrieve the mosque from the SQLite DB using shared Prisma client instance
  const mosque = await request.server.prisma.mosque.findUnique({
    where: { slug }
  });

  if (!mosque) {
    reply.status(404).send({ error: `Mosque with slug "${slug}" not found.` });
    return;
  }

  // Inject the validated tenant object into the request context
  request.tenant = mosque;
}
