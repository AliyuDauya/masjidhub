import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import announcementRoutes from '../../src/routes/announcements.js';

// Mocks
const mockFindMany = vi.fn();
const mockCreate = vi.fn();
const mockFindUniqueMosque = vi.fn();
const mockFindUniqueAnnouncement = vi.fn();
const mockDelete = vi.fn();

const mockPrisma = {
  announcement: {
    findMany: mockFindMany,
    create: mockCreate,
    findUnique: mockFindUniqueAnnouncement,
    delete: mockDelete
  },
  mosque: {
    findUnique: mockFindUniqueMosque
  }
};

describe('Announcement Route Handlers', () => {
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

    app.register(announcementRoutes);

    mockFindUniqueMosque.mockResolvedValue(mockTenant);
    await app.ready();
  });

  describe('GET /api/announcements', () => {
    it('should return active announcements for tenant', async () => {
      const mockAnnouncementsList = [
        { announcement_id: 1, title: 'Event 1', category: 'Event' }
      ];
      mockFindMany.mockResolvedValue(mockAnnouncementsList);

      const response = await app.inject({
        method: 'GET',
        url: '/api/announcements',
        headers: { 'x-mosque-slug': 'al-noor' }
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual(mockAnnouncementsList);
    });
  });

  describe('POST /api/admin/announcements', () => {
    it('should fail with 400 if title, content or category missing', async () => {
      const adminToken = app.jwt.sign({ user_id: 1, role: 'admin', mosque_id: 1 });

      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/announcements',
        headers: {
          'x-mosque-slug': 'al-noor',
          'Authorization': `Bearer ${adminToken}`
        },
        payload: { title: 'Missing Content' }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should successfully post announcement for admin', async () => {
      const adminToken = app.jwt.sign({ user_id: 1, role: 'admin', mosque_id: 1 });
      const createdAnnouncement = { announcement_id: 10, title: 'New Event', content: 'Details', category: 'Urgent' };
      mockCreate.mockResolvedValue(createdAnnouncement);

      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/announcements',
        headers: {
          'x-mosque-slug': 'al-noor',
          'Authorization': `Bearer ${adminToken}`
        },
        payload: { title: 'New Event', content: 'Details', category: 'Urgent' }
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.body)).toEqual(createdAnnouncement);
    });
  });

  describe('DELETE /api/admin/announcements/:id', () => {
    it('should return 404 if announcement does not belong to target mosque tenant', async () => {
      const adminToken = app.jwt.sign({ user_id: 1, role: 'admin', mosque_id: 1 });
      // Announcement belongs to mosque_id 2
      mockFindUniqueAnnouncement.mockResolvedValue({ announcement_id: 5, mosque_id: 2 });

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/admin/announcements/5',
        headers: {
          'x-mosque-slug': 'al-noor',
          'Authorization': `Bearer ${adminToken}`
        }
      });

      expect(response.statusCode).toBe(404);
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('should delete successfully if announcement belongs to target mosque tenant', async () => {
      const adminToken = app.jwt.sign({ user_id: 1, role: 'admin', mosque_id: 1 });
      mockFindUniqueAnnouncement.mockResolvedValue({ announcement_id: 5, mosque_id: 1 });
      mockDelete.mockResolvedValue({ announcement_id: 5 });

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/admin/announcements/5',
        headers: {
          'x-mosque-slug': 'al-noor',
          'Authorization': `Bearer ${adminToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      expect(mockDelete).toHaveBeenCalledWith({ where: { announcement_id: 5 } });
    });
  });
});
