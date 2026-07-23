import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import mosqueRoutes from '../../src/routes/mosques.js';

// Setup Mocks
const mockFindUniqueMosque = vi.fn();
const mockUpdateMosque = vi.fn();

const mockPrisma = {
  mosque: {
    findUnique: mockFindUniqueMosque,
    update: mockUpdateMosque
  }
};

describe('Mosque Profile Route (PUT)', () => {
  let app: any;
  const mockTenant = { mosque_id: 1, name: 'Original Name', slug: 'al-noor' };

  beforeEach(async () => {
    vi.clearAllMocks();

    app = fastify();
    app.decorate('prisma', mockPrisma);
    app.register(fastifyJwt, { secret: 'test-secret' });
    
    // Inject auth plugin locally
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

    app.register(mosqueRoutes);
    mockFindUniqueMosque.mockResolvedValue(mockTenant);
    await app.ready();
  });

  it('should return 401 if JWT token is missing', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/mosques/al-noor',
      payload: { name: 'New Name' }
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 403 if user is a member, not an admin', async () => {
    const token = app.jwt.sign({ user_id: 2, role: 'member', mosque_id: 1 });

    const response = await app.inject({
      method: 'PUT',
      url: '/api/mosques/al-noor',
      headers: {
        'x-mosque-slug': 'al-noor',
        'Authorization': `Bearer ${token}`
      },
      payload: { name: 'New Name' }
    });

    expect(response.statusCode).toBe(403);
  });

  it('should return 403 if admin is of a different mosque tenant', async () => {
    const token = app.jwt.sign({ user_id: 3, role: 'admin', mosque_id: 99 }); // Wrong mosque_id

    const response = await app.inject({
      method: 'PUT',
      url: '/api/mosques/al-noor',
      headers: {
        'x-mosque-slug': 'al-noor',
        'Authorization': `Bearer ${token}`
      },
      payload: { name: 'New Name' }
    });

    expect(response.statusCode).toBe(403);
  });

  it('should successfully update mosque details if admin is authenticated and belongs to current tenant', async () => {
    const token = app.jwt.sign({ user_id: 1, role: 'admin', mosque_id: 1 });
    const mockUpdated = { mosque_id: 1, name: 'New Name', slug: 'al-noor', address: '456 Lane' };
    mockUpdateMosque.mockResolvedValue(mockUpdated);

    const response = await app.inject({
      method: 'PUT',
      url: '/api/mosques/al-noor',
      headers: {
        'x-mosque-slug': 'al-noor',
        'Authorization': `Bearer ${token}`
      },
      payload: { name: 'New Name', address: '456 Lane' }
    });

    expect(response.statusCode).toBe(200);
    expect(mockUpdateMosque).toHaveBeenCalledWith({
      where: { mosque_id: 1 },
      data: {
        name: 'New Name',
        address: '456 Lane',
        phone: null,
        email: null
      }
    });
    expect(JSON.parse(response.body)).toEqual(mockUpdated);
  });
});
