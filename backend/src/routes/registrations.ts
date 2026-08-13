import { FastifyInstance } from 'fastify';
import { tenantHook } from '../middleware/tenantHook.js';
import type { JWTPayload } from '../plugins/auth.js';

export default async function registrationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', tenantHook);

  fastify.post('/api/programs/:id/register', { preHandler: [fastify.requireMembership()] }, async (request, reply) => {
    const programId = Number((request.params as { id: string }).id);
    if (!Number.isInteger(programId)) return reply.status(400).send({ error: 'Invalid programme ID.' });
    const payload = request.user as JWTPayload;

    try {
      const registration = await fastify.prisma.$transaction(async (tx) => {
        const program = await tx.program.findFirst({ where: { program_id: programId, mosque_id: request.tenant.mosque_id, status: 'Published' } });
        if (!program) throw new Error('PROGRAM_NOT_FOUND');
        const existing = await tx.registration.findUnique({ where: { mosque_id_user_id_program_id: { mosque_id: request.tenant.mosque_id, user_id: payload.user_id, program_id: programId } } });
        if (existing?.status !== 'Cancelled') throw new Error('ALREADY_REGISTERED');
        if (program.max_capacity > 0) {
          const occupied = await tx.registration.count({ where: { mosque_id: request.tenant.mosque_id, program_id: programId, status: 'Registered' } });
          if (occupied >= program.max_capacity) throw new Error('CAPACITY_FULL');
        }
        if (existing) return tx.registration.update({ where: { reg_id: existing.reg_id }, data: { status: 'Registered', reg_date: new Date(), attended_at: null } });
        return tx.registration.create({ data: { mosque_id: request.tenant.mosque_id, user_id: payload.user_id, program_id: programId } });
      });
      await fastify.audit(request, 'registration.created', 'Registration', registration.reg_id, 'Programme seat registered.');
      reply.status(201).send(registration);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'PROGRAM_NOT_FOUND') return reply.status(404).send({ error: 'Programme not found.' });
      if (code === 'ALREADY_REGISTERED') return reply.status(409).send({ error: 'You are already registered for this programme.' });
      if (code === 'CAPACITY_FULL') return reply.status(409).send({ error: 'Registration failed: Programme capacity is full.' });
      throw error;
    }
  });

  fastify.post('/api/programs/:id/cancel', { preHandler: [fastify.requireMembership()] }, async (request, reply) => {
    const programId = Number((request.params as { id: string }).id);
    const payload = request.user as JWTPayload;
    const registration = await fastify.prisma.registration.findUnique({ where: { mosque_id_user_id_program_id: { mosque_id: request.tenant.mosque_id, user_id: payload.user_id, program_id: programId } } });
    if (!registration || registration.status === 'Cancelled') return reply.status(404).send({ error: 'Active registration not found.' });
    const updated = await fastify.prisma.registration.update({ where: { reg_id: registration.reg_id }, data: { status: 'Cancelled' } });
    await fastify.audit(request, 'registration.cancelled', 'Registration', registration.reg_id, 'Programme registration cancelled.');
    reply.send(updated);
  });

  fastify.get('/api/members/registrations', { preHandler: [fastify.requireMembership()] }, async (request, reply) => {
    const payload = request.user as JWTPayload;
    reply.send(await fastify.prisma.registration.findMany({ where: { mosque_id: request.tenant.mosque_id, user_id: payload.user_id }, include: { program: true }, orderBy: { reg_date: 'desc' } }));
  });

  fastify.get('/api/admin/programs/:id/registrations', { preHandler: [fastify.requireMembership(['tenant_admin', 'programme_officer'])] }, async (request, reply) => {
    const programId = Number((request.params as { id: string }).id);
    const program = await fastify.prisma.program.findFirst({ where: { program_id: programId, mosque_id: request.tenant.mosque_id } });
    if (!program) return reply.status(404).send({ error: 'Programme not found.' });
    reply.send(await fastify.prisma.registration.findMany({ where: { mosque_id: request.tenant.mosque_id, program_id: programId }, include: { user: { select: { user_id: true, name: true, email: true, phone: true } } } }));
  });

  fastify.patch('/api/admin/registrations/:id/attendance', { preHandler: [fastify.requireMembership(['tenant_admin', 'programme_officer'])] }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const registration = await fastify.prisma.registration.findFirst({ where: { reg_id: id, mosque_id: request.tenant.mosque_id } });
    if (!registration) return reply.status(404).send({ error: 'Registration not found.' });
    const updated = await fastify.prisma.registration.update({ where: { reg_id: id }, data: { status: 'Attended', attended_at: new Date() } });
    await fastify.audit(request, 'attendance.recorded', 'Registration', id, 'Programme attendance recorded.');
    reply.send(updated);
  });
}
