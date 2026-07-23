import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';
import { tenantHook } from '../../src/middleware/tenantHook.js';

// Setup Mock Prisma instance
const mockFindUnique = vi.fn();
const mockServer = {
  prisma: {
    mosque: {
      findUnique: mockFindUnique
    }
  }
};

describe('tenantHook middleware', () => {
  let app: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create a mock Fastify instance for routing tests
    app = fastify();
    app.decorate('prisma', mockServer.prisma);
    
    // Register route that applies the tenantHook
    app.get('/test-route/:slug?', { preHandler: tenantHook }, async (request: any, reply: any) => {
      reply.send({ success: true, tenant: request.tenant });
    });
  });

  it('should fail with 400 if X-Mosque-Slug header and slug param are missing', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test-route'
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      error: 'Missing X-Mosque-Slug tenant context header or route parameter.'
    });
  });

  it('should fail with 404 if mosque is not found in database', async () => {
    mockFindUnique.mockResolvedValue(null);

    const response = await app.inject({
      method: 'GET',
      url: '/test-route',
      headers: {
        'x-mosque-slug': 'non-existent'
      }
    });

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { slug: 'non-existent' }
    });
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({
      error: 'Mosque with slug "non-existent" not found.'
    });
  });

  it('should succeed and inject tenant request context if mosque exists', async () => {
    const mockMosque = { mosque_id: 1, name: 'Al-Noor Mosque', slug: 'al-noor' };
    mockFindUnique.mockResolvedValue(mockMosque);

    const response = await app.inject({
      method: 'GET',
      url: '/test-route/al-noor'
    });

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { slug: 'al-noor' }
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      tenant: mockMosque
    });
  });
});
