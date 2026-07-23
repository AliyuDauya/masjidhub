import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { tenantHook } from '../middleware/tenantHook.js';

interface JWTPayload {
  user_id: number;
  email: string;
  role: string;
  mosque_id: number;
}

export default async function registrationRoutes(fastify: FastifyInstance) {
  // Apply tenantHook as a preHandler for all routes in this plugin
  fastify.addHook('preHandler', tenantHook);

  // POST /api/programs/:id/register - Register active member to a program
  fastify.post('/api/programs/:id/register', {
    preHandler: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const payload = request.user as JWTPayload;

    try {
      const programId = parseInt(id, 10);
      if (isNaN(programId)) {
        reply.status(400).send({ error: 'Invalid program ID.' });
        return;
      }

      // 1. Verify program exists and belongs to this tenant
      const program = await fastify.prisma.program.findUnique({
        where: { program_id: programId },
        include: { registrations: true }
      });

      if (!program || program.mosque_id !== request.tenant.mosque_id) {
        reply.status(404).send({ error: 'Program not found.' });
        return;
      }

      // 2. Check capacity boundaries (max_capacity = 0 means unlimited)
      if (program.max_capacity > 0) {
        const activeRegistrationsCount = program.registrations.filter(r => r.status === 'Registered').length;
        if (activeRegistrationsCount >= program.max_capacity) {
          reply.status(409).send({ error: 'Registration failed: Program capacity is full.' });
          return;
        }
      }

      // 3. Prevent double registration
      const existing = await fastify.prisma.registration.findUnique({
        where: {
          user_id_program_id: {
            user_id: payload.user_id,
            program_id: programId
          }
        }
      });

      if (existing) {
        // If they had cancelled, reactivate registration
        if (existing.status === 'Cancelled') {
          const reactivated = await fastify.prisma.registration.update({
            where: { reg_id: existing.reg_id },
            data: { status: 'Registered', reg_date: new Date() }
          });
          reply.send(reactivated);
          return;
        }

        reply.status(409).send({ error: 'You are already registered for this program.' });
        return;
      }

      // 4. Create new registration
      const newRegistration = await fastify.prisma.registration.create({
        data: {
          user_id: payload.user_id,
          program_id: programId,
          status: 'Registered'
        }
      });

      reply.status(201).send(newRegistration);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ error: 'Failed to complete registration.' });
    }
  });

  // POST /api/programs/:id/cancel - Cancel registration
  fastify.post('/api/programs/:id/cancel', {
    preHandler: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const payload = request.user as JWTPayload;

    try {
      const programId = parseInt(id, 10);
      if (isNaN(programId)) {
        reply.status(400).send({ error: 'Invalid program ID.' });
        return;
      }

      const registration = await fastify.prisma.registration.findFirst({
        where: {
          user_id: payload.user_id,
          program_id: programId
        }
      });

      if (!registration) {
        reply.status(404).send({ error: 'Active registration not found.' });
        return;
      }

      const updated = await fastify.prisma.registration.update({
        where: { reg_id: registration.reg_id },
        data: { status: 'Cancelled' }
      });

      reply.send(updated);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ error: 'Failed to cancel registration.' });
    }
  });

  // GET /api/members/registrations - Retrieve user's registration history
  fastify.get('/api/members/registrations', {
    preHandler: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.user as JWTPayload;

    try {
      const registrations = await fastify.prisma.registration.findMany({
        where: { user_id: payload.user_id },
        include: { program: true }
      });
      reply.send(registrations);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ error: 'Failed to fetch registration records.' });
    }
  });

  // GET /api/admin/programs/:id/registrations - Admin list of attendees for program audit
  fastify.get('/api/admin/programs/:id/registrations', {
    preHandler: [fastify.adminOnly]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const programId = parseInt(id, 10);
      if (isNaN(programId)) {
        reply.status(400).send({ error: 'Invalid program ID.' });
        return;
      }

      const program = await fastify.prisma.program.findUnique({
        where: { program_id: programId }
      });

      if (!program || program.mosque_id !== request.tenant.mosque_id) {
        reply.status(404).send({ error: 'Program not found.' });
        return;
      }

      const registrants = await fastify.prisma.registration.findMany({
        where: { program_id: programId },
        include: {
          user: {
            select: { user_id: true, name: true, email: true, phone: true }
          }
        }
      });

      reply.send(registrants);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ error: 'Failed to fetch attendee list.' });
    }
  });
}
