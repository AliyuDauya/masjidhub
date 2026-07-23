import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify from 'fastify';
import bcrypt from 'bcryptjs';
import fastifyJwt from '@fastify/jwt';
import authRoutes from '../../src/routes/auth.js';

// Setup Mocks
const mockFindFirstUser = vi.fn();
const mockCreateUser = vi.fn();
const mockFindUniqueMosque = vi.fn();

const mockPrisma = {
  user: {
    findFirst: mockFindFirstUser,
    create: mockCreateUser
  },
  mosque: {
    findUnique: mockFindUniqueMosque
  }
};

describe('Auth Route Handlers', () => {
  let app: any;
  const mockTenant = { mosque_id: 10, name: 'Al-Huda', slug: 'al-huda' };

  beforeEach(() => {
    vi.clearAllMocks();

    app = fastify();
    app.decorate('prisma', mockPrisma);
    app.register(fastifyJwt, { secret: 'test-secret' });
    app.register(authRoutes);

    // Mock tenant lookup inside tenantHook prehandler
    mockFindUniqueMosque.mockResolvedValue(mockTenant);
  });

  describe('POST /api/auth/register', () => {
    it('should fail if missing required registration parameters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'x-mosque-slug': 'al-huda' },
        payload: { name: 'Ali' }
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('required');
    });

    it('should fail with 409 if user email already exists within current tenant', async () => {
      mockFindFirstUser.mockResolvedValue({ user_id: 1, email: 'ali@example.com' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'x-mosque-slug': 'al-huda' },
        payload: { name: 'Ali', email: 'ali@example.com', password: 'secure123', role: 'member' }
      });

      expect(mockFindFirstUser).toHaveBeenCalledWith({
        where: { mosque_id: 10, email: 'ali@example.com' }
      });
      expect(response.statusCode).toBe(409);
      expect(JSON.parse(response.body).error).toContain('already registered');
    });

    it('should successfully register and return user details (no password hash)', async () => {
      mockFindFirstUser.mockResolvedValue(null);
      
      const createdUser = {
        user_id: 5,
        mosque_id: 10,
        name: 'Ali',
        email: 'ali@example.com',
        password_hash: 'hashedpassword',
        role: 'member'
      };
      mockCreateUser.mockResolvedValue(createdUser);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'x-mosque-slug': 'al-huda' },
        payload: { name: 'Ali', email: 'ali@example.com', password: 'secure123', role: 'member' }
      });

      expect(response.statusCode).toBe(201);
      
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('user_id', 5);
      expect(data).not.toHaveProperty('password_hash');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should fail with 401 if user does not exist in target mosque', async () => {
      mockFindFirstUser.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'x-mosque-slug': 'al-huda' },
        payload: { email: 'wrong@example.com', password: 'password' }
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body).error).toContain('Invalid email or password');
    });

    it('should succeed and issue JWT on correct password validation', async () => {
      const plainPassword = 'my-password-123';
      const hash = await bcrypt.hash(plainPassword, 5);

      mockFindFirstUser.mockResolvedValue({
        user_id: 20,
        mosque_id: 10,
        name: 'Ahmad',
        email: 'ahmad@example.com',
        password_hash: hash,
        role: 'admin'
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'x-mosque-slug': 'al-huda' },
        payload: { email: 'ahmad@example.com', password: plainPassword }
      });

      expect(response.statusCode).toBe(200);
      
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('token');
      expect(data.user).toEqual({
        user_id: 20,
        name: 'Ahmad',
        email: 'ahmad@example.com',
        role: 'admin'
      });

      // Verify token contains tenant boundaries
      const decoded = app.jwt.verify(data.token);
      expect(decoded).toMatchObject({
        user_id: 20,
        email: 'ahmad@example.com',
        role: 'admin',
        mosque_id: 10
      });
    });
  });
});
