import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { tenantHook } from '../middleware/tenantHook.js';
import type { JWTPayload } from '../plugins/auth.js';
import { setAuthCookies, clearAuthCookies, createCsrfToken } from '../plugins/security.js';
import { registerSchema, loginSchema, switchTenantSchema } from '../schemas/index.js';

interface RegisterBody {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role?: string;
}

interface LoginBody {
  email: string;
  password: string;
}

function tokenFor(
  fastify: FastifyInstance,
  user: { user_id: number; email: string; platform_role: string | null },
  membership?: { membership_id: number; mosque_id: number; role: string }
) {
  return fastify.jwt.sign({
    user_id: user.user_id,
    email: user.email,
    platform_role: user.platform_role || undefined,
    membership_id: membership?.membership_id,
    mosque_id: membership?.mosque_id,
    role: membership?.role
  });
}

export default async function authRoutes(fastify: FastifyInstance) {
  // GET /api/auth/csrf - Retrieve CSRF token for browser sessions
  fastify.get('/api/auth/csrf', async (_request: FastifyRequest, reply: FastifyReply) => {
    const csrfToken = createCsrfToken();
    reply.setCookie('mh_csrf', csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60
    });
    reply.send({ csrfToken });
  });

  // POST /api/auth/logout - Clear session & CSRF cookies
  fastify.post('/api/auth/logout', async (_request: FastifyRequest, reply: FastifyReply) => {
    clearAuthCookies(reply);
    reply.send({ success: true, message: 'Logged out successfully.' });
  });

  // POST /api/auth/register - Global User Account Creation & Mosque Joining
  fastify.post('/api/auth/register', {
    schema: registerSchema,
    preHandler: [tenantHook]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, email, password, phone } = request.body as RegisterBody;
    if (!name?.trim() || !email?.trim() || !password) {
      reply.status(400).send({ error: 'Name, email, and password are required.' });
      return;
    }
    if (password.length < 8) {
      reply.status(400).send({ error: 'Password must contain at least 8 characters.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    let user = await fastify.prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (user) {
      // User exists globally. Verify password to link to this mosque
      const passwordMatches = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatches) {
        reply.status(401).send({
          error: 'An account with this email already exists. Please enter your existing password to join this mosque.'
        });
        return;
      }

      // Check existing membership for this specific mosque
      let membership = await fastify.prisma.membership.findUnique({
        where: { mosque_id_user_id: { mosque_id: request.tenant.mosque_id, user_id: user.user_id } }
      });

      if (!membership) {
        // Automatically create active membership in this mosque
        membership = await fastify.prisma.membership.create({
          data: {
            mosque_id: request.tenant.mosque_id,
            user_id: user.user_id,
            role: 'member',
            status: 'Active'
          }
        });
        await fastify.audit(
          request,
          'membership.joined',
          'Membership',
          membership.membership_id,
          `Global user ${user.email} joined ${request.tenant.name} as a member.`
        );
      } else if (membership.status === 'Suspended') {
        reply.status(403).send({ error: 'Your membership in this mosque is currently suspended.' });
        return;
      }

      const token = tokenFor(fastify, user, membership);
      const csrfToken = createCsrfToken();
      setAuthCookies(reply, token, csrfToken);

      reply.status(200).send({
        user: { user_id: user.user_id, name: user.name, email: user.email },
        membership,
        token,
        csrfToken,
        message: 'Account linked and joined mosque successfully.'
      });
      return;
    }

    // New Global User Creation
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await fastify.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          password_hash: passwordHash,
          phone
        }
      });
      const newMembership = await tx.membership.create({
        data: {
          mosque_id: request.tenant.mosque_id,
          user_id: newUser.user_id,
          role: 'member',
          status: 'Active'
        }
      });
      return { user: newUser, membership: newMembership };
    });

    await fastify.audit(
      request,
      'membership.registered',
      'Membership',
      result.membership.membership_id,
      `${result.user.email} created global account and joined as a member.`
    );

    const token = tokenFor(fastify, result.user, result.membership);
    const csrfToken = createCsrfToken();
    setAuthCookies(reply, token, csrfToken);

    reply.status(201).send({
      user: { user_id: result.user.user_id, name: result.user.name, email: result.user.email },
      membership: result.membership,
      token,
      csrfToken
    });
  });

  // POST /api/auth/login - Global User Sign In & Auto-Joining
  fastify.post('/api/auth/login', {
    schema: loginSchema,
    preHandler: [tenantHook]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = request.body as LoginBody;
    if (!email || !password) {
      reply.status(400).send({ error: 'Email and password are required.' });
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    const user = await fastify.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || user.account_status !== 'Active' || !(await bcrypt.compare(password, user.password_hash))) {
      reply.status(401).send({ error: 'Invalid email or password.' });
      return;
    }

    let membership = await fastify.prisma.membership.findUnique({
      where: { mosque_id_user_id: { mosque_id: request.tenant.mosque_id, user_id: user.user_id } }
    });

    // If user has a valid global account but no membership in this mosque, automatically join them
    if (!membership) {
      membership = await fastify.prisma.membership.create({
        data: {
          mosque_id: request.tenant.mosque_id,
          user_id: user.user_id,
          role: 'member',
          status: 'Active'
        }
      });
      await fastify.audit(
        request,
        'membership.joined',
        'Membership',
        membership.membership_id,
        `Global user ${user.email} signed in and joined ${request.tenant.name}.`
      );
    } else if (membership.status !== 'Active') {
      reply.status(403).send({ error: 'Your membership in this mosque is currently suspended.' });
      return;
    }

    const token = tokenFor(fastify, user, membership);
    const csrfToken = createCsrfToken();
    setAuthCookies(reply, token, csrfToken);

    reply.send({
      token,
      csrfToken,
      user: { user_id: user.user_id, name: user.name, email: user.email, platform_role: user.platform_role },
      membership: { membership_id: membership.membership_id, mosque_id: membership.mosque_id, role: membership.role }
    });
  });

  // POST /api/members/join - Explicit 1-Click Join for Authenticated Users
  fastify.post('/api/members/join', {
    preHandler: [tenantHook, fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.user as JWTPayload;
    const user = await fastify.prisma.user.findUnique({ where: { user_id: payload.user_id } });
    if (!user || user.account_status !== 'Active') {
      reply.status(401).send({ error: 'User account not found or suspended.' });
      return;
    }

    let membership = await fastify.prisma.membership.findUnique({
      where: { mosque_id_user_id: { mosque_id: request.tenant.mosque_id, user_id: user.user_id } }
    });

    if (membership && membership.status === 'Active') {
      const token = tokenFor(fastify, user, membership);
      const csrfToken = createCsrfToken();
      setAuthCookies(reply, token, csrfToken);
      reply.send({
        success: true,
        message: `You are already an active member of ${request.tenant.name}.`,
        membership,
        token,
        csrfToken
      });
      return;
    }

    if (membership && membership.status === 'Suspended') {
      reply.status(403).send({ error: 'Your membership in this mosque is suspended.' });
      return;
    }

    // Create new active membership
    membership = await fastify.prisma.membership.create({
      data: {
        mosque_id: request.tenant.mosque_id,
        user_id: user.user_id,
        role: 'member',
        status: 'Active'
      }
    });

    await fastify.audit(
      request,
      'membership.joined',
      'Membership',
      membership.membership_id,
      `Global user ${user.email} joined ${request.tenant.name} via 1-click join.`
    );

    const token = tokenFor(fastify, user, membership);
    const csrfToken = createCsrfToken();
    setAuthCookies(reply, token, csrfToken);

    reply.status(201).send({
      success: true,
      message: `Successfully joined ${request.tenant.name}!`,
      membership,
      token,
      csrfToken
    });
  });

  // GET /api/auth/me - Return user profile with all joined mosques
  fastify.get('/api/auth/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const payload = request.user as JWTPayload;
    const user = await fastify.prisma.user.findUnique({
      where: { user_id: payload.user_id },
      select: {
        user_id: true,
        name: true,
        email: true,
        phone: true,
        platform_role: true,
        account_status: true,
        memberships: {
          include: {
            mosque: {
              select: {
                mosque_id: true,
                name: true,
                slug: true,
                status: true,
                address: true,
                brand_color: true
              }
            }
          }
        }
      }
    });
    reply.send(user);
  });

  // POST /api/auth/switch-tenant/:slug - Switch active mosque context
  fastify.post('/api/auth/switch-tenant/:slug', {
    schema: switchTenantSchema,
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const payload = request.user as JWTPayload;
    const { slug } = request.params as { slug: string };
    const mosque = await fastify.prisma.mosque.findUnique({ where: { slug: slug.toLowerCase() } });
    if (!mosque || mosque.status !== 'Active') return reply.status(404).send({ error: 'Active mosque not found.' });
    
    let membership = await fastify.prisma.membership.findUnique({
      where: { mosque_id_user_id: { mosque_id: mosque.mosque_id, user_id: payload.user_id } }
    });

    // If not a member yet, automatically join
    if (!membership) {
      membership = await fastify.prisma.membership.create({
        data: {
          mosque_id: mosque.mosque_id,
          user_id: payload.user_id,
          role: 'member',
          status: 'Active'
        }
      });
    } else if (membership.status !== 'Active') {
      return reply.status(403).send({ error: 'Active membership required.' });
    }

    const user = await fastify.prisma.user.findUniqueOrThrow({ where: { user_id: payload.user_id } });

    const token = tokenFor(fastify, user, membership);
    const csrfToken = createCsrfToken();
    setAuthCookies(reply, token, csrfToken);

    reply.send({ token, csrfToken, mosque, role: membership.role });
  });
}
