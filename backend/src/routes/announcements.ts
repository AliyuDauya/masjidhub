import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { tenantHook } from '../middleware/tenantHook.js';

interface AnnouncementBody {
  title: string;
  content: string;
  category: 'General' | 'Event' | 'Prayer' | 'Urgent';
  expiry_date?: string; // ISO-8601 string
}

interface JWTPayload {
  user_id: number;
  email: string;
  role: string;
  mosque_id: number;
}

export default async function announcementRoutes(fastify: FastifyInstance) {
  // Apply tenantHook as a preHandler for all routes in this plugin
  fastify.addHook('preHandler', tenantHook);

  // GET /api/announcements - Fetch active and non-expired announcements for tenant
  fastify.get('/api/announcements', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const now = new Date();
      const announcements = await fastify.prisma.announcement.findMany({
        where: {
          mosque_id: request.tenant.mosque_id,
          OR: [
            { expiry_date: null },
            { expiry_date: { gt: now } }
          ]
        },
        orderBy: { posted_at: 'desc' }
      });
      reply.send(announcements);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ error: 'Failed to fetch announcements.' });
    }
  });

  // POST /api/admin/announcements - Create new announcement (restricted to Mosque Admin)
  fastify.post('/api/admin/announcements', {
    preHandler: [fastify.adminOnly]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { title, content, category, expiry_date } = request.body as AnnouncementBody;
    const payload = request.user as JWTPayload;

    if (!title || !content || !category) {
      reply.status(400).send({ error: 'Title, content, and category are required.' });
      return;
    }

    const categories = ['General', 'Event', 'Prayer', 'Urgent'];
    if (!categories.includes(category)) {
      reply.status(400).send({ error: 'Invalid announcement category.' });
      return;
    }

    try {
      const announcement = await fastify.prisma.announcement.create({
        data: {
          mosque_id: request.tenant.mosque_id,
          admin_id: payload.user_id,
          title,
          content,
          category,
          expiry_date: expiry_date ? new Date(expiry_date) : null
        }
      });
      reply.status(201).send(announcement);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ error: 'Failed to create announcement.' });
    }
  });

  // PUT /api/admin/announcements/:id - Update announcement details
  fastify.put('/api/admin/announcements/:id', {
    preHandler: [fastify.adminOnly]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { title, content, category, expiry_date } = request.body as AnnouncementBody;

    try {
      const announcementId = parseInt(id, 10);
      if (isNaN(announcementId)) {
        reply.status(400).send({ error: 'Invalid announcement ID.' });
        return;
      }

      // Check existence and tenant boundary
      const announcement = await fastify.prisma.announcement.findUnique({
        where: { announcement_id: announcementId }
      });

      if (!announcement || announcement.mosque_id !== request.tenant.mosque_id) {
        reply.status(404).send({ error: 'Announcement not found.' });
        return;
      }

      const updated = await fastify.prisma.announcement.update({
        where: { announcement_id: announcementId },
        data: {
          title: title ?? undefined,
          content: content ?? undefined,
          category: category ?? undefined,
          expiry_date: expiry_date !== undefined ? (expiry_date ? new Date(expiry_date) : null) : undefined
        }
      });

      reply.send(updated);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ error: 'Failed to update announcement.' });
    }
  });

  // DELETE /api/admin/announcements/:id - Delete announcement
  fastify.delete('/api/admin/announcements/:id', {
    preHandler: [fastify.adminOnly]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const announcementId = parseInt(id, 10);
      if (isNaN(announcementId)) {
        reply.status(400).send({ error: 'Invalid announcement ID.' });
        return;
      }

      // Check existence and tenant boundary
      const announcement = await fastify.prisma.announcement.findUnique({
        where: { announcement_id: announcementId }
      });

      if (!announcement || announcement.mosque_id !== request.tenant.mosque_id) {
        reply.status(404).send({ error: 'Announcement not found.' });
        return;
      }

      await fastify.prisma.announcement.delete({
        where: { announcement_id: announcementId }
      });

      reply.send({ success: true, message: 'Announcement deleted successfully.' });
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ error: 'Failed to delete announcement.' });
    }
  });
}
