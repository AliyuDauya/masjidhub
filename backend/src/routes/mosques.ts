import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { tenantHook } from '../middleware/tenantHook.js';

interface CreateMosqueBody {
  name: string;
  slug: string;
  address?: string;
  phone?: string;
  email?: string;
}

interface UpdateMosqueBody {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export default async function mosqueRoutes(fastify: FastifyInstance) {
  // POST /api/mosques - Global endpoint to register a new mosque tenant
  fastify.post('/api/mosques', async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, slug, address, phone, email } = request.body as CreateMosqueBody;

    if (!name || !slug) {
      reply.status(400).send({ error: 'Name and unique slug are required fields.' });
      return;
    }

    const formattedSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');

    try {
      const existing = await fastify.prisma.mosque.findUnique({
        where: { slug: formattedSlug }
      });

      if (existing) {
        reply.status(409).send({ error: 'A mosque with this slug already exists.' });
        return;
      }

      const newMosque = await fastify.prisma.mosque.create({
        data: {
          name,
          slug: formattedSlug,
          address,
          phone,
          email
        }
      });

      reply.status(211).send(newMosque);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ error: 'Internal server error while creating mosque.' });
    }
  });

  // GET /api/mosques/:slug - Public endpoint to retrieve mosque context info
  fastify.get('/api/mosques/:slug', async (request: FastifyRequest, reply: FastifyReply) => {
    const { slug } = request.params as { slug: string };

    const mosque = await fastify.prisma.mosque.findUnique({
      where: { slug: slug.toLowerCase() }
    });

    if (!mosque) {
      reply.status(404).send({ error: `Mosque with slug "${slug}" not found.` });
      return;
    }

    reply.send(mosque);
  });

  // PUT /api/mosques/:slug - Admin endpoint to update mosque profile details
  fastify.put('/api/mosques/:slug', {
    preHandler: [tenantHook, fastify.adminOnly]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, address, phone, email } = request.body as UpdateMosqueBody;

    try {
      const updatedMosque = await fastify.prisma.mosque.update({
        where: { mosque_id: request.tenant.mosque_id },
        data: {
          name: name ?? undefined,
          address: address ?? null,
          phone: phone ?? null,
          email: email ?? null
        }
      });

      reply.send(updatedMosque);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ error: 'Internal server error while updating mosque profile.' });
    }
  });
}
