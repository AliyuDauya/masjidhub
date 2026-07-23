import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';
import mosqueRoutes from '../../src/routes/mosques.js';

// Setup Mock Prisma instance
const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockPrisma = {
  mosque: {
    findUnique: mockFindUnique,
    create: mockCreate
  }
};

describe('Mosques Route Handler', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = fastify();
    app.decorate('prisma', mockPrisma);
    app.decorate('authenticate', async () => {});
    app.decorate('adminOnly', async () => {});
    app.register(mosqueRoutes);
    await app.ready();
  });

  describe('POST /api/mosques', () => {
    it('should fail with 400 if name or slug is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/mosques',
        payload: { slug: 'al-noor' }
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('Name and unique slug are required');
    });

    it('should fail with 409 if slug already exists', async () => {
      mockFindUnique.mockResolvedValue({ mosque_id: 1, slug: 'al-noor' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/mosques',
        payload: { name: 'Al-Noor Mosque', slug: 'Al-Noor' }
      });

      expect(mockFindUnique).toHaveBeenCalledWith({ where: { slug: 'al-noor' } });
      expect(response.statusCode).toBe(409);
      expect(JSON.parse(response.body).error).toContain('already exists');
    });

    it('should succeed and create mosque with cleaned slug', async () => {
      mockFindUnique.mockResolvedValue(null);
      const createdMosque = { mosque_id: 2, name: 'Al-Noor Mosque', slug: 'al-noor' };
      mockCreate.mockResolvedValue(createdMosque);

      const response = await app.inject({
        method: 'POST',
        url: '/api/mosques',
        payload: { name: 'Al-Noor Mosque', slug: 'Al-Noor!!!' }
      });

      expect(mockFindUnique).toHaveBeenCalledWith({ where: { slug: 'al-noor' } });
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          name: 'Al-Noor Mosque',
          slug: 'al-noor',
          address: undefined,
          phone: undefined,
          email: undefined
        }
      });
      expect(response.statusCode).toBe(211);
      expect(JSON.parse(response.body)).toEqual(createdMosque);
    });
  });

  describe('GET /api/mosques/:slug', () => {
    it('should return 404 if mosque does not exist', async () => {
      mockFindUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/mosques/non-existent'
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return mosque profile if slug matches', async () => {
      const mockMosque = { mosque_id: 5, name: 'Central Mosque', slug: 'central' };
      mockFindUnique.mockResolvedValue(mockMosque);

      const response = await app.inject({
        method: 'GET',
        url: '/api/mosques/central'
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual(mockMosque);
    });
  });
});
