import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import programRoutes from '../../src/routes/programs.js';

// Setup Mocks
const mockFindMany = vi.fn();
const mockCreate = vi.fn();
const mockFindUniqueMosque = vi.fn();
const mockFindUniqueProgram = vi.fn();
const mockDelete = vi.fn();

const mockPrisma = {
  program: {
    findMany: mockFindMany,
    create: mockCreate,
    findUnique: mockFindUniqueProgram,
    delete: mockDelete
  },
  mosque: {
    findUnique: mockFindUniqueMosque
  }
};

describe('Programs Route Handlers', () => {
  let app: any;
  const mockTenant = { mosque_id: 1, name: 'Al-Noor', slug: 'al-noor' };

  beforeEach(async () => {
    vi.clearAllMocks();

    app = fastify();
    app.decorate('prisma', mockPrisma);
    app.register(fastifyJwt, { secret: 'test-secret' });

    app.decorate('adminOnly', async (request: any, reply: any) => {
      try {
        await request.jwtVerify();
        if (request.tenant && request.user.mosque_id !== request.tenant.mosque_id) {
          reply.status(403).send({ error: 'Access Denied' });
          return;
        }
        if (request.user.role !== 'admin') {
          reply.status(403).send({ error: 'Forbidden' });
        }
      } catch (err) {
        reply.status(401).send({ error: 'Unauthorized' });
      }
    });

    app.register(programRoutes);
    mockFindUniqueMosque.mockResolvedValue(mockTenant);
    await app.ready();
  });

  describe('GET /api/programs', () => {
    it('should return all programs for active tenant', async () => {
      const mockPrograms = [{ program_id: 1, title: 'Quran Class', location: 'Hall A' }];
      mockFindMany.mockResolvedValue(mockPrograms);

      const response = await app.inject({
        method: 'GET',
        url: '/api/programs',
        headers: { 'x-mosque-slug': 'al-noor' }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual(mockPrograms);
    });
  });

  describe('POST /api/admin/programs', () => {
    it('should block non-admins from creating programs', async () => {
      const memberToken = app.jwt.sign({ user_id: 2, role: 'member', mosque_id: 1 });

      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': 'al-noor',
          'Authorization': `Bearer ${memberToken}`
        },
        payload: {
          title: 'Class',
          description: 'Desc',
          start_date: '2026-07-20T10:00:00.000Z',
          end_date: '2026-07-20T12:00:00.000Z',
          location: 'Main'
        }
      });

      expect(response.statusCode).toBe(403);
    });

    it('should allow admins to create new programs', async () => {
      const adminToken = app.jwt.sign({ user_id: 1, role: 'admin', mosque_id: 1 });
      const mockCreated = { program_id: 10, title: 'Quran Class' };
      mockCreate.mockResolvedValue(mockCreated);

      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': 'al-noor',
          'Authorization': `Bearer ${adminToken}`
        },
        payload: {
          title: 'Quran Class',
          description: 'Learn tajweed',
          start_date: '2026-07-20T10:00:00.000Z',
          end_date: '2026-07-20T12:00:00.000Z',
          location: 'Hall A',
          max_capacity: 30
        }
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.body)).toEqual(mockCreated);
    });
  });
});
