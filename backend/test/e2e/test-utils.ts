import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/server.js';
import bcrypt from 'bcryptjs';

export interface TestTenant {
  mosqueId: number;
  slug: string;
  name: string;
  adminUserId: number;
  adminEmail: string;
  adminPassword: string;
  adminSessionCookie: string;
  adminBearerToken: string;
  csrfToken: string;
}

export interface TestOfficer {
  userId: number;
  email: string;
  name: string;
  role: string;
  sessionCookie: string;
  bearerToken: string;
  csrfToken: string;
}

export function extractCookie(headers: Record<string, string | string[] | undefined>, name: string): string {
  const raw = headers['set-cookie'];
  if (!raw) return '';
  const array = Array.isArray(raw) ? raw : [raw];
  for (const cookie of array) {
    const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    if (match) return match[1];
  }
  return '';
}

export async function getCsrfToken(app: FastifyInstance): Promise<string> {
  const res = await app.inject({
    method: 'GET',
    url: '/api/auth/csrf'
  });
  return res.json().csrfToken;
}

export async function createActiveTenant(
  app: FastifyInstance,
  options?: { slugPrefix?: string; name?: string; password?: string }
): Promise<TestTenant> {
  const suffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const slug = `${options?.slugPrefix || 'mosque'}-${suffix}`;
  const name = options?.name || `Test Mosque ${suffix}`;
  const adminEmail = `admin-${suffix}@example.test`;
  const adminPassword = options?.password || 'TenantPass123!';

  // 1. Create Mosque & Tenant Admin via public registration
  const mosqueRes = await app.inject({
    method: 'POST',
    url: '/api/mosques',
    payload: {
      name,
      slug,
      admin_name: 'Super Admin Officer',
      admin_email: adminEmail,
      admin_password: adminPassword,
      address: '123 Test Street, Central District',
      phone: '+2348000000000',
      email: adminEmail
    }
  });

  if (mosqueRes.statusCode !== 201) {
    throw new Error(`Failed to create test mosque: ${mosqueRes.body}`);
  }
  const mosqueId = mosqueRes.json().mosque_id;

  // 2. Activate Mosque via Platform Admin
  const platLogin = await app.inject({
    method: 'POST',
    url: '/api/platform/auth/login',
    payload: { email: 'platform@masjidhub.local', password: 'platformPass123' }
  });

  if (platLogin.statusCode !== 200) {
    throw new Error(`Failed platform login: ${platLogin.body}`);
  }
  const platformBearerToken = platLogin.json().token;

  const activateRes = await app.inject({
    method: 'PATCH',
    url: `/api/platform/tenants/${mosqueId}/status`,
    headers: { authorization: `Bearer ${platformBearerToken}` },
    payload: { status: 'Active' }
  });

  if (activateRes.statusCode !== 200) {
    throw new Error(`Failed to activate mosque: ${activateRes.body}`);
  }

  // 3. Admin Login to obtain session cookie & bearer token
  const adminLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'x-mosque-slug': slug },
    payload: { email: adminEmail, password: adminPassword }
  });

  if (adminLogin.statusCode !== 200) {
    throw new Error(`Failed admin login: ${adminLogin.body}`);
  }

  const adminUserId = adminLogin.json().user.user_id;
  const adminBearerToken = adminLogin.json().token;
  const adminSessionCookie = extractCookie(adminLogin.headers, 'mh_session');
  const csrfToken = adminLogin.json().csrfToken || (await getCsrfToken(app));

  return {
    mosqueId,
    slug,
    name,
    adminUserId,
    adminEmail,
    adminPassword,
    adminSessionCookie,
    adminBearerToken,
    csrfToken
  };
}

export async function createMemberUser(
  app: FastifyInstance,
  tenant: TestTenant,
  role: 'tenant_admin' | 'finance_officer' | 'programme_officer' | 'communications_officer' | 'member' = 'member',
  options?: { email?: string; password?: string; name?: string }
): Promise<TestOfficer> {
  const suffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const email = options?.email || `${role}-${suffix}@example.test`;
  const name = options?.name || `${role.replace('_', ' ').toUpperCase()} User`;
  const password = options?.password || 'MemberPass123!';

  if (role === 'member') {
    // Register directly
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: { 'x-mosque-slug': tenant.slug },
      payload: { name, email, password, phone: '+2348000000001' }
    });
    if (regRes.statusCode !== 201) {
      throw new Error(`Failed to register member: ${regRes.body}`);
    }
    const userId = regRes.json().user.user_id;
    const bearerToken = regRes.json().token;
    const sessionCookie = extractCookie(regRes.headers, 'mh_session');
    const csrfToken = regRes.json().csrfToken || (await getCsrfToken(app));
    return { userId, email, name, role, sessionCookie, bearerToken, csrfToken };
  } else {
    // Invite as officer via Admin endpoint
    const inviteRes = await app.inject({
      method: 'POST',
      url: '/api/admin/memberships/invite',
      headers: {
        'x-mosque-slug': tenant.slug,
        authorization: `Bearer ${tenant.adminBearerToken}`
      },
      payload: { name, email, role, temporary_password: password }
    });

    if (inviteRes.statusCode !== 201) {
      throw new Error(`Failed to invite officer: ${inviteRes.body}`);
    }

    // Login as officer to obtain credentials
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'x-mosque-slug': tenant.slug },
      payload: { email, password }
    });

    if (loginRes.statusCode !== 200) {
      throw new Error(`Failed officer login: ${loginRes.body}`);
    }

    const userId = loginRes.json().user.user_id;
    const bearerToken = loginRes.json().token;
    const sessionCookie = extractCookie(loginRes.headers, 'mh_session');
    const csrfToken = loginRes.json().csrfToken || (await getCsrfToken(app));

    return { userId, email, name, role, sessionCookie, bearerToken, csrfToken };
  }
}

export async function cleanupTenant(app: FastifyInstance, mosqueId: number) {
  if (!mosqueId) return;
  try {
    await app.prisma.donation.deleteMany({ where: { mosque_id: mosqueId } });
    await app.prisma.registration.deleteMany({ where: { mosque_id: mosqueId } });
    await app.prisma.program.deleteMany({ where: { mosque_id: mosqueId } });
    await app.prisma.announcement.deleteMany({ where: { mosque_id: mosqueId } });
    await app.prisma.notification.deleteMany({ where: { mosque_id: mosqueId } });
    await app.prisma.membership.deleteMany({ where: { mosque_id: mosqueId } });
    await app.prisma.auditEvent.deleteMany({ where: { mosque_id: mosqueId } });
    await app.prisma.mosque.deleteMany({ where: { mosque_id: mosqueId } });
  } catch (err) {
    console.error(`Error cleaning up mosque ${mosqueId}:`, err);
  }
}
