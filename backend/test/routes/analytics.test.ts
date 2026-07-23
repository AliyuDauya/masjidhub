import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import analyticsRoutes from '../../src/routes/analytics.js';

// Setup Mocks
const mockFindManyDonations = vi.fn();
const mockFindManyPrograms = vi.fn();
const mockFindUniqueMosque = vi.fn();

const mockPrisma = {
  donation: {
    findMany: mockFindManyDonations
  },
  program: {
    findMany: mockFindManyPrograms
  },
  mosque: {
    findUnique: mockFindUniqueMosque
  }
};

describe('Analytics Route Handlers', () => {
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

    app.register(analyticsRoutes);
    mockFindUniqueMosque.mockResolvedValue(mockTenant);
    await app.ready();
  });

  describe('GET /api/admin/analytics/donations', () => {
    it('should aggregate donation totals and category allocations correctly', async () => {
      const adminToken = app.jwt.sign({ user_id: 1, role: 'admin', mosque_id: 1 });
      const mockDonations = [
        { donation_id: 1, amount: 200, category: 'Zakat', method: 'Card' },
        { donation_id: 2, amount: 300, category: 'Sadaqah', method: 'Cash' },
        { donation_id: 3, amount: 500, category: 'Zakat', method: 'Transfer' }
      ];
      mockFindManyDonations.mockResolvedValue(mockDonations);

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/analytics/donations',
        headers: {
          'x-mosque-slug': 'al-noor',
          'Authorization': `Bearer ${adminToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.totalDonated).toBe(1000);
      expect(data.totalDonationsCount).toBe(3);
      expect(data.byCategory.Zakat).toBe(700);
      expect(data.byCategory.Sadaqah).toBe(300);
    });
  });

  describe('GET /api/admin/analytics/registrations', () => {
    it('should calculate registration capacities and fill rates correctly', async () => {
      const adminToken = app.jwt.sign({ user_id: 1, role: 'admin', mosque_id: 1 });
      const mockPrograms = [
        {
          program_id: 1,
          title: 'Class A',
          max_capacity: 50,
          registrations: [
            { reg_id: 1, status: 'Registered' },
            { reg_id: 2, status: 'Registered' }
          ]
        },
        {
          program_id: 2,
          title: 'Class B',
          max_capacity: 0,
          registrations: [
            { reg_id: 3, status: 'Registered' }
          ]
        }
      ];
      mockFindManyPrograms.mockResolvedValue(mockPrograms);

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/analytics/registrations',
        headers: {
          'x-mosque-slug': 'al-noor',
          'Authorization': `Bearer ${adminToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data[0].activeRegistrations).toBe(2);
      expect(data[0].fillRate).toBe(4.00); // 2/50 * 100
      expect(data[1].fillRate).toBe(100.00); // Unlimited fallback
    });
  });
});
