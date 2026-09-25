import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { tenantHook } from '../middleware/tenantHook.js';
import {
  createProgramSchema,
  updateProgramSchema,
  programIdParamSchema
} from '../schemas/index.js';

interface ProgramBody {
  title: string;
  description: string;
  start_date: string; // ISO String
  end_date: string;   // ISO String
  location: string;
  max_capacity?: number;
  category?: string;
  visibility?: 'Public' | 'Members';
  status?: 'Draft' | 'Published' | 'Cancelled' | 'Completed';
}

export default async function programRoutes(fastify: FastifyInstance) {
  // Apply tenantHook as a preHandler for all routes in this plugin
  fastify.addHook('preHandler', tenantHook);

  // GET /api/programs - Public endpoint to retrieve scheduled programs for tenant with live attendee count
  fastify.get('/api/programs', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const programs = await fastify.prisma.program.findMany({
        where: { mosque_id: request.tenant.mosque_id, status: 'Published', visibility: 'Public' },
        include: {
          _count: {
            select: {
              registrations: {
                where: { status: 'Registered' }
              }
            }
          }
        },
        orderBy: { start_date: 'asc' }
      });
      reply.send(programs);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ error: 'Failed to fetch programs list.' });
    }
  });

  // GET /api/admin/programs - Admin endpoint to retrieve all programs with registration counts
  fastify.get('/api/admin/programs', {
    preHandler: [fastify.requireMembership(['tenant_admin', 'programme_officer'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const programs = await fastify.prisma.program.findMany({
        where: { mosque_id: request.tenant.mosque_id },
        include: {
          _count: {
            select: {
              registrations: {
                where: { status: { in: ['Registered', 'Attended'] } }
              }
            }
          }
        },
        orderBy: { start_date: 'desc' }
      });
      reply.send(programs);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ error: 'Failed to fetch admin programs list.' });
    }
  });

  // POST /api/admin/programs - Create a new program
  fastify.post('/api/admin/programs', {
    schema: createProgramSchema,
    preHandler: [fastify.requireMembership(['tenant_admin', 'programme_officer'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { title, description, start_date, end_date, location, max_capacity, category, visibility, status } = request.body as ProgramBody;

    if (!title || !description || !start_date || !end_date || !location) {
      reply.status(400).send({ error: 'Title, description, start date, end date, and location are required.' });
      return;
    }

    try {
      const newProgram = await fastify.prisma.program.create({
        data: {
          mosque_id: request.tenant.mosque_id,
          title,
          description,
          category,
          start_date: new Date(start_date),
          end_date: new Date(end_date),
          location,
          max_capacity: max_capacity !== undefined ? max_capacity : 0, // 0 means unlimited
          visibility: visibility || 'Public',
          status: status || 'Published'
        }
      });
      await fastify.audit(request, 'program.created', 'Program', newProgram.program_id, 'Programme created.');
      reply.status(201).send(newProgram);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ error: 'Failed to create program.' });
    }
  });

  // PUT /api/admin/programs/:id - Update an existing program
  fastify.put('/api/admin/programs/:id', {
    schema: updateProgramSchema,
    preHandler: [fastify.requireMembership(['tenant_admin', 'programme_officer'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { title, description, start_date, end_date, location, max_capacity, category, visibility, status } = request.body as ProgramBody;

    try {
      const programId = parseInt(id, 10);
      if (isNaN(programId)) {
        reply.status(400).send({ error: 'Invalid program ID.' });
        return;
      }

      // Check existence and tenant boundary
      const program = await fastify.prisma.program.findUnique({
        where: { program_id: programId }
      });

      if (!program || program.mosque_id !== request.tenant.mosque_id) {
        reply.status(404).send({ error: 'Program not found.' });
        return;
      }

      const updated = await fastify.prisma.program.update({
        where: { program_id: programId },
        data: {
          title: title ?? undefined,
          description: description ?? undefined,
          category: category ?? undefined,
          start_date: start_date ? new Date(start_date) : undefined,
          end_date: end_date ? new Date(end_date) : undefined,
          location: location ?? undefined,
          max_capacity: max_capacity !== undefined ? max_capacity : undefined,
          visibility: visibility ?? undefined,
          status: status ?? undefined
        }
      });

      await fastify.audit(request, 'program.updated', 'Program', programId, 'Programme updated.');
      reply.send(updated);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ error: 'Failed to update program.' });
    }
  });

  // DELETE /api/admin/programs/:id - Delete a program
  fastify.delete('/api/admin/programs/:id', {
    schema: programIdParamSchema,
    preHandler: [fastify.requireMembership(['tenant_admin', 'programme_officer'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const programId = parseInt(id, 10);
      if (isNaN(programId)) {
        reply.status(400).send({ error: 'Invalid program ID.' });
        return;
      }

      // Check existence and tenant boundary
      const program = await fastify.prisma.program.findUnique({
        where: { program_id: programId }
      });

      if (!program || program.mosque_id !== request.tenant.mosque_id) {
        reply.status(404).send({ error: 'Program not found.' });
        return;
      }

      await fastify.prisma.program.delete({
        where: { program_id: programId }
      });

      await fastify.audit(request, 'program.deleted', 'Program', programId, 'Programme deleted.');

      reply.send({ success: true, message: 'Program deleted successfully.' });
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ error: 'Failed to delete program.' });
    }
  });
}
