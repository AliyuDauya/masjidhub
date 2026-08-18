import { FastifyInstance } from 'fastify';
import { tenantHook } from '../middleware/tenantHook.js';
import type { JWTPayload } from '../plugins/auth.js';
import {
  readNotificationSchema,
  programReminderSchema
} from '../schemas/index.js';

export default async function notificationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', tenantHook);

  fastify.get('/api/members/notifications', { preHandler: [fastify.requireMembership()] }, async (request, reply) => {
    const payload = request.user as JWTPayload;
    reply.send(await fastify.prisma.notification.findMany({ where: { mosque_id: request.tenant.mosque_id, user_id: payload.user_id }, orderBy: { created_at: 'desc' } }));
  });

  fastify.patch('/api/members/notifications/:id/read', {
    schema: readNotificationSchema,
    preHandler: [fastify.requireMembership()]
  }, async (request, reply) => {
    const payload = request.user as JWTPayload;
    const id = Number((request.params as { id: string }).id);
    const row = await fastify.prisma.notification.findFirst({ where: { notif_id: id, mosque_id: request.tenant.mosque_id, user_id: payload.user_id } });
    if (!row) return reply.status(404).send({ error: 'Notification not found.' });
    reply.send(await fastify.prisma.notification.update({ where: { notif_id: id }, data: { is_read: true } }));
  });

  fastify.post('/api/admin/programs/:id/reminders', {
    schema: programReminderSchema,
    preHandler: [fastify.requireMembership(['tenant_admin', 'programme_officer'])]
  }, async (request, reply) => {
    const programId = Number((request.params as { id: string }).id);
    const program = await fastify.prisma.program.findFirst({
      where: { program_id: programId, mosque_id: request.tenant.mosque_id },
      include: { registrations: { where: { status: 'Registered' } } }
    });
    if (!program) return reply.status(404).send({ error: 'Programme not found.' });
    if (program.registrations.length) {
      await fastify.prisma.notification.createMany({
        data: program.registrations.map(r => ({
          mosque_id: request.tenant.mosque_id,
          user_id: r.user_id,
          message: `Reminder: ${program.title} begins ${program.start_date.toLocaleString()}.`,
          type: 'In-App',
          status: 'Sent',
          sent_at: new Date(),
          related_type: 'Program',
          related_id: program.program_id
        }))
      });
    }
    await fastify.audit(request, 'program.reminders_sent', 'Program', programId, `${program.registrations.length} reminders sent.`);
    reply.send({ sent: program.registrations.length });
  });

  fastify.get('/api/admin/audit-events', { preHandler: [fastify.adminOnly] }, async (request, reply) => {
    reply.send(await fastify.prisma.auditEvent.findMany({
      where: { mosque_id: request.tenant.mosque_id },
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { created_at: 'desc' },
      take: 200
    }));
  });
}
