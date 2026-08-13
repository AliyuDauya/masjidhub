import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/server.js';

const suffix = Date.now().toString(36);
const slug = `test-${suffix}`;
const adminEmail = `admin-${suffix}@example.test`;
let app: FastifyInstance;
let platformToken = '';
let adminToken = '';
let mosqueId = 0;

describe('proposal-aligned tenant lifecycle and isolation', () => {
  beforeAll(async () => { app = buildServer(); await app.ready(); });
  afterAll(async () => {
    if (mosqueId) await app.prisma.mosque.deleteMany({ where: { mosque_id: mosqueId } });
    await app.prisma.user.deleteMany({ where: { email: adminEmail } });
    await app.prisma.auditEvent.deleteMany({ where: { target_id: String(mosqueId) } });
    await app.close();
  });

  it('creates a pending tenant with a tenant administrator membership', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/mosques', payload: {
      name: 'Isolation Test Mosque', slug, admin_name: 'Test Administrator', admin_email: adminEmail, admin_password: 'securePass123'
    } });
    expect(response.statusCode).toBe(201);
    expect(response.json().status).toBe('Pending');
    mosqueId = response.json().mosque_id;
    const membership = await app.prisma.membership.findFirst({ where: { mosque_id: mosqueId }, include: { user: true } });
    expect(membership?.role).toBe('tenant_admin');
    expect(membership?.user.email).toBe(adminEmail);
  });

  it('blocks tenant operations until a platform administrator activates it', async () => {
    const blocked = await app.inject({ method: 'GET', url: '/api/programs', headers: { 'x-mosque-slug': slug } });
    expect(blocked.statusCode).toBe(423);
    const login = await app.inject({ method: 'POST', url: '/api/platform/auth/login', payload: { email: 'platform@masjidhub.local', password: 'platformPass123' } });
    expect(login.statusCode).toBe(200);
    platformToken = login.json().token;
    const activated = await app.inject({ method: 'PATCH', url: `/api/platform/tenants/${mosqueId}/status`, headers: { authorization: `Bearer ${platformToken}` }, payload: { status: 'Active' } });
    expect(activated.statusCode).toBe(200);
  });

  it('authenticates through the active tenant membership', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { 'x-mosque-slug': slug }, payload: { email: adminEmail, password: 'securePass123' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().membership.role).toBe('tenant_admin');
    adminToken = response.json().token;
  });

  it('denies a valid token when used against another tenant', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/admin/memberships', headers: { 'x-mosque-slug': 'al-noor', authorization: `Bearer ${adminToken}` } });
    expect(response.statusCode).toBe(403);
  });

  it('never accepts a privileged role from public registration', async () => {
    const email = `member-${suffix}@example.test`;
    const response = await app.inject({ method: 'POST', url: '/api/auth/register', headers: { 'x-mosque-slug': slug }, payload: { name: 'Public Member', email, password: 'memberPass123', role: 'tenant_admin' } });
    expect(response.statusCode).toBe(201);
    expect(response.json().membership.role).toBe('member');
    await app.prisma.user.delete({ where: { email } });
  });

  it('records integer-minor-unit donations and issues receipts', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/donations', headers: { 'x-mosque-slug': slug }, payload: { amount: 1250.55, category: 'Sadaqah', method: 'Transfer' } });
    expect(response.statusCode).toBe(201);
    expect(response.json().amount).toBe(1250.55);
    expect(response.json().receipt_number).toMatch(/^MH-/);
    await app.prisma.donation.delete({ where: { donation_id: response.json().donation_id } });
  });
});
