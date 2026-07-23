import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { tenantHook } from '../middleware/tenantHook.js';

interface RegisterBody {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'member';
  phone?: string;
}

interface LoginBody {
  email: string;
  password: string;
}

export default async function authRoutes(fastify: FastifyInstance) {
  // Apply tenantHook as a preHandler for all authentication routes
  fastify.addHook('preHandler', tenantHook);

  // POST /api/auth/register - Register a user under the current mosque tenant
  fastify.post('/api/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, email, password, role, phone } = request.body as RegisterBody;

    if (!name || !email || !password || !role) {
      reply.status(400).send({ error: 'Name, email, password, and role are required.' });
      return;
    }

    if (role !== 'admin' && role !== 'member') {
      reply.status(400).send({ error: 'Role must be either "admin" or "member".' });
      return;
    }

    try {
      // Check if email is already taken within this specific mosque
      const existingUser = await fastify.prisma.user.findFirst({
        where: {
          mosque_id: request.tenant.mosque_id,
          email: email.toLowerCase()
        }
      });

      if (existingUser) {
        reply.status(409).send({ error: 'Email already registered for this mosque.' });
        return;
      }

      // Hash password using bcrypt
      const passwordHash = await bcrypt.hash(password, 10);

      // Create new user in SQLite
      const user = await fastify.prisma.user.create({
        data: {
          mosque_id: request.tenant.mosque_id,
          name,
          email: email.toLowerCase(),
          password_hash: passwordHash,
          role,
          phone
        }
      });

      // Avoid returning password_hash in response
      const { password_hash, ...userResponse } = user;
      reply.status(201).send(userResponse);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ error: 'Internal server error during registration.' });
    }
  });

  // POST /api/auth/login - Log in a user under the current mosque tenant
  fastify.post('/api/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = request.body as LoginBody;

    if (!email || !password) {
      reply.status(400).send({ error: 'Email and password are required.' });
      return;
    }

    try {
      // Find the user inside the current mosque tenant
      const user = await fastify.prisma.user.findFirst({
        where: {
          mosque_id: request.tenant.mosque_id,
          email: email.toLowerCase()
        }
      });

      if (!user) {
        reply.status(401).send({ error: 'Invalid email or password.' });
        return;
      }

      // Compare password hashes
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        reply.status(401).send({ error: 'Invalid email or password.' });
        return;
      }

      // Sign the multi-tenant JWT payload
      const token = fastify.jwt.sign({
        user_id: user.user_id,
        email: user.email,
        role: user.role,
        mosque_id: user.mosque_id
      });

      reply.send({
        token,
        user: {
          user_id: user.user_id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ error: 'Internal server error during login.' });
    }
  });
}
