import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import registrationRoutes from '../../src/routes/registrations.js';

// Mocks
const mockFindUniqueProgram = vi.fn();
const mockFindUniqueRegistration = vi.fn();
const mockFindFirstRegistration = vi.fn();
const mockCreateRegistration = vi.fn();
const mockUpdateRegistration = vi.fn();
const mockFindManyRegistrations = vi.fn();
const mockFindUniqueMosque = vi.fn();

const mockPrisma = {
  program: {
    findUnique: mockFindUniqueProgram
  },
  registration: {
    findUnique: mockFindUniqueRegistration,
    findFirst: mockFindFirstRegistration,
    create: mockCreateRegistration,
    update: mockUpdateRegistration,
    findMany: mockFindManyRegistrations
  },
  mosque: {
    findUnique: mockFindUniqueMosque
  }
};

describe('Registrations Route Handlers', () => {
  let app: any;
  const mockTenant = { mosque_id: 1, name: 'Al-Noor', slug: 'al-noor' };

  beforeEach(async () => {
    vi.clearAllMocks();

    app = fastify();
    app.decorate('prisma', mockPrisma);
    app.register(fastifyJwt, { secret: 'test-secret' });

    app.decorate('authenticate', async (request: any, reply: any) => {
      try {
        await request.jwtVerify();
        if (request.tenant && request.user.mosque_id !== request.tenant.mosque_id) {
          reply.status(403).send({ error: 'Access Denied' });
        }
      } catch (err) {
        reply.status(401).send({ error: 'Unauthorized' });
      }
    });

    app.decorate('adminOnly', async (request: any, reply: any) => {
      await app.authenticate(request, reply);
      if (reply.sent) return;
      if (request.user.role !== 'admin') {
        reply.status(403).send({ error: 'Forbidden' });
      }
    });

    app.register(registrationRoutes);
    mockFindUniqueMosque.mockResolvedValue(mockTenant);
    await app.ready();
  });

  describe('POST /api/programs/:id/register', () => {
    it('should fail with 409 if event capacity is full', async () => {
      const userToken = app.jwt.sign({ user_id: 5, role: 'member', mosque_id: 1 });
      
      // Setup program with capacity limit of 1
      mockFindUniqueProgram.mockResolvedValue({
        program_id: 10,
        mosque_id: 1,
        max_capacity: 1,
        registrations: [
          { reg_id: 1, status: 'Registered' } // 1 active registration already exists
        ]
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/programs/10/register',
        headers: {
          'x-mosque-slug': 'al-noor',
          'Authorization': `Bearer ${userToken}`
        }
      });

      expect(response.statusCode).toBe(409);
      expect(JSON.parse(response.body).error).toContain('capacity is full');
    });

    it('should successfully register a member to a program with remaining capacity', async () => {
      const userToken = app.jwt.sign({ user_id: 5, role: 'member', mosque_id: 1 });
      
      mockFindUniqueProgram.mockResolvedValue({
        program_id: 10,
        mosque_id: 1,
        max_capacity: 10,
        registrations: []
      });
      mockFindUniqueRegistration.mockResolvedValue(null);
      mockCreateRegistration.mockResolvedValue({ reg_id: 22, status: 'Registered' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/programs/10/register',
        headers: {
          'x-mosque-slug': 'al-noor',
          'Authorization': `Bearer ${userToken}`
        }
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.body)).toEqual({ reg_id: 22, status: 'Registered' });
    });
  });
});
