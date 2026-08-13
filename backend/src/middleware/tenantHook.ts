import { FastifyRequest, FastifyReply } from 'fastify';

export async function tenantHook(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers['x-mosque-slug'];
  const slug = (Array.isArray(header) ? header[0] : header) || (request.params as { slug?: string })?.slug;

  if (!slug) {
    reply.status(400).send({ error: 'Select a mosque using X-Mosque-Slug or the route slug.' });
    return;
  }

  const mosque = await request.server.prisma.mosque.findUnique({
    where: { slug: slug.toLowerCase() }
  });
  if (!mosque) {
    reply.status(404).send({ error: `Mosque with slug "${slug}" not found.` });
    return;
  }
  if (mosque.status !== 'Active') {
    reply.status(423).send({ error: `This mosque is currently ${mosque.status.toLowerCase()}.` });
    return;
  }
  request.tenant = mosque;
}
