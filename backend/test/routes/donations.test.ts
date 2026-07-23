import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import donationRoutes from '../../src/routes/donations.js';

// Setup Mocks
const mockCreateDonation = vi.fn();
const mockFindManyDonations = vi.fn();
const mockFindFirstUser = vi.fn();
const mockFindUniqueMosque = vi.fn();

const mockPrisma = {
  donation: {
    create: mockCreateDonation,
    findMany: mockFindManyDonations
  },
  user: {
    findFirst: mockFindFirstUser
  },
  mosque: {
    findUnique: mockFindUniqueMosque
  }
};

describe('Donations Route Handlers', () => {
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

    app.register(donationRoutes);
    mockFindUniqueMosque.mockResolvedValue(mockTenant);
    await app.ready();
  });

  describe('POST /api/donations', () => {
    it('should fail with 400 for negative or zero donation amounts', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/donations',
        headers: { 'x-mosque-slug': 'al-noor' },
        payload: { amount: -50, category: 'Sadaqah', method: 'Card' }
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('must be greater than zero');
    });

    it('should register anonymous donations without authentication header', async () => {
      const mockSaved = { donation_id: 100, amount: 500, category: 'General', user_id: null };
      mockCreateDonation.mockResolvedValue(mockSaved);

      const response = await app.inject({
        method: 'POST',
        url: '/api/donations',
        headers: { 'x-mosque-slug': 'al-noor' },
        payload: { amount: 500, category: 'General', method: 'Transfer' }
      });

      expect(response.statusCode).toBe(201);
      expect(mockCreateDonation).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: 500,
          category: 'General',
          method: 'Transfer',
          user_id: null,
          status: 'Completed'
        })
      });
      expect(JSON.parse(response.body)).toEqual(mockSaved);
    });

    it('should associate user_id if valid auth header exists', async () => {
      const token = app.jwt.sign({ user_id: 15, role: 'member', mosque_id: 1 });
      const mockSaved = { donation_id: 101, amount: 150, category: 'Zakat', user_id: 15 };
      mockCreateDonation.mockResolvedValue(mockSaved);

      const response = await app.inject({
        method: 'POST',
        url: '/api/donations',
        headers: {
          'x-mosque-slug': 'al-noor',
          'Authorization': `Bearer ${token}`
        },
        payload: { amount: 150, category: 'Zakat', method: 'Card' }
      });

      expect(response.statusCode).toBe(201);
      expect(mockCreateDonation).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: 150,
          category: 'Zakat',
          method: 'Card',
          user_id: 15
        })
      });
    });
  });

  describe('POST /api/admin/donations/manual', () => {
    it('should fail with 403 if non-admin attempts offline logs entry', async () => {
      const token = app.jwt.sign({ user_id: 5, role: 'member', mosque_id: 1 });

      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': 'al-noor',
          'Authorization': `Bearer ${token}`
        },
        payload: { amount: 200, category: 'Sadaqah', method: 'Cash' }
      });

      expect(response.statusCode).toBe(403);
    });

    it('should log cash entry and search member link by email if supplied', async () => {
      const token = app.jwt.sign({ user_id: 1, role: 'admin', mosque_id: 1 });
      mockFindFirstUser.mockResolvedValue({ user_id: 25, email: 'member@test.com' });
      mockCreateDonation.mockResolvedValue({ donation_id: 50, user_id: 25 });

      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/donations/manual',
        headers: {
          'x-mosque-slug': 'al-noor',
          'Authorization': `Bearer ${token}`
        },
        payload: { amount: 1000, category: 'Waqf', method: 'Cash', donor_email: 'member@test.com' }
      });

      expect(response.statusCode).toBe(201);
      expect(mockFindFirstUser).toHaveBeenCalledWith({
        where: { mosque_id: 1, email: 'member@test.com' }
      });
      expect(mockCreateDonation).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: 1000,
          category: 'Waqf',
          method: 'Cash',
          user_id: 25
        })
      });
    });
  });
});
