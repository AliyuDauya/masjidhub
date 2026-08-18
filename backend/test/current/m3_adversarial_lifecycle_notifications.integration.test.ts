import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/server.js';

describe('Milestone 3 Adversarial Stress Tests: Programme Lifecycle, Attendance Check-In, Reminders & Notifications', () => {
  let app: FastifyInstance;
  const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  
  // Tenant A
  const slugA = `adv-m3-a-${suffix}`;
  const adminEmailA = `admin-a-${suffix}@example.test`;
  const progOfficerEmailA = `prog-a-${suffix}@example.test`;
  const finOfficerEmailA = `fin-a-${suffix}@example.test`;
  const commsOfficerEmailA = `comms-a-${suffix}@example.test`;
  const memberEmailA1 = `member-a1-${suffix}@example.test`;
  const memberEmailA2 = `member-a2-${suffix}@example.test`;
  const memberEmailA3 = `member-a3-${suffix}@example.test`;
  const memberEmailA4 = `member-a4-${suffix}@example.test`;
  const memberEmailA5 = `member-a5-${suffix}@example.test`;

  // Tenant B (for Cross-Tenant isolation attacks)
  const slugB = `adv-m3-b-${suffix}`;
  const adminEmailB = `admin-b-${suffix}@example.test`;
  const memberEmailB1 = `member-b1-${suffix}@example.test`;

  const password = 'AdversarialM3Pass123!';

  let mosqueIdA: number;
  let mosqueIdB: number;
  let adminTokenA: string;
  let progOfficerTokenA: string;
  let finOfficerTokenA: string;
  let commsOfficerTokenA: string;
  let memberTokenA1: string;
  let memberTokenA2: string;
  let memberTokenA3: string;
  let memberTokenA4: string;
  let memberTokenA5: string;

  let adminTokenB: string;
  let memberTokenB1: string;

  let memberUserIdA1: number;
  let memberUserIdA2: number;
  let memberUserIdA3: number;
  let memberUserIdA4: number;
  let memberUserIdA5: number;
  let memberUserIdB1: number;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    // 1. Setup Platform Admin Token for Mosque Activations
    const platLogin = await app.inject({
      method: 'POST',
      url: '/api/platform/auth/login',
      payload: { email: 'platform@masjidhub.local', password: 'platformPass123' }
    });
    expect(platLogin.statusCode).toBe(200);
    const platformToken = platLogin.json().token;

    // 2. Create and Activate Tenant A
    const mosqueARes = await app.inject({
      method: 'POST',
      url: '/api/mosques',
      payload: {
        name: 'Adversarial M3 Mosque A',
        slug: slugA,
        admin_name: 'Admin Officer A',
        admin_email: adminEmailA,
        admin_password: password
      }
    });
    expect(mosqueARes.statusCode).toBe(201);
    mosqueIdA = mosqueARes.json().mosque_id;

    await app.inject({
      method: 'PATCH',
      url: `/api/platform/tenants/${mosqueIdA}/status`,
      headers: { authorization: `Bearer ${platformToken}` },
      payload: { status: 'Active' }
    });

    const adminLoginA = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'x-mosque-slug': slugA },
      payload: { email: adminEmailA, password }
    });
    expect(adminLoginA.statusCode).toBe(200);
    adminTokenA = adminLoginA.json().token;

    // 3. Create and Activate Tenant B
    const mosqueBRes = await app.inject({
      method: 'POST',
      url: '/api/mosques',
      payload: {
        name: 'Adversarial M3 Mosque B',
        slug: slugB,
        admin_name: 'Admin Officer B',
        admin_email: adminEmailB,
        admin_password: password
      }
    });
    expect(mosqueBRes.statusCode).toBe(201);
    mosqueIdB = mosqueBRes.json().mosque_id;

    await app.inject({
      method: 'PATCH',
      url: `/api/platform/tenants/${mosqueIdB}/status`,
      headers: { authorization: `Bearer ${platformToken}` },
      payload: { status: 'Active' }
    });

    const adminLoginB = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'x-mosque-slug': slugB },
      payload: { email: adminEmailB, password }
    });
    expect(adminLoginB.statusCode).toBe(200);
    adminTokenB = adminLoginB.json().token;

    // 4. Create Officers for Tenant A
    const inviteOfficer = async (email: string, role: string, name: string) => {
      const inv = await app.inject({
        method: 'POST',
        url: '/api/admin/memberships/invite',
        headers: { 'x-mosque-slug': slugA, authorization: `Bearer ${adminTokenA}` },
        payload: { name, email, role, temporary_password: password }
      });
      expect(inv.statusCode).toBe(201);

      const login = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'x-mosque-slug': slugA },
        payload: { email, password }
      });
      expect(login.statusCode).toBe(200);
      return login.json().token;
    };

    progOfficerTokenA = await inviteOfficer(progOfficerEmailA, 'programme_officer', 'Prog Officer A');
    finOfficerTokenA = await inviteOfficer(finOfficerEmailA, 'finance_officer', 'Finance Officer A');
    commsOfficerTokenA = await inviteOfficer(commsOfficerEmailA, 'communications_officer', 'Comms Officer A');

    // 5. Register Members for Tenant A
    const registerMember = async (slug: string, email: string, name: string) => {
      const reg = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'x-mosque-slug': slug },
        payload: { name, email, password }
      });
      expect(reg.statusCode).toBe(201);
      return { token: reg.json().token, userId: reg.json().user.user_id };
    };

    const m1 = await registerMember(slugA, memberEmailA1, 'Member A1');
    memberTokenA1 = m1.token;
    memberUserIdA1 = m1.userId;

    const m2 = await registerMember(slugA, memberEmailA2, 'Member A2');
    memberTokenA2 = m2.token;
    memberUserIdA2 = m2.userId;

    const m3 = await registerMember(slugA, memberEmailA3, 'Member A3');
    memberTokenA3 = m3.token;
    memberUserIdA3 = m3.userId;

    const m4 = await registerMember(slugA, memberEmailA4, 'Member A4');
    memberTokenA4 = m4.token;
    memberUserIdA4 = m4.userId;

    const m5 = await registerMember(slugA, memberEmailA5, 'Member A5');
    memberTokenA5 = m5.token;
    memberUserIdA5 = m5.userId;

    // 6. Register Member for Tenant B
    const mb1 = await registerMember(slugB, memberEmailB1, 'Member B1');
    memberTokenB1 = mb1.token;
    memberUserIdB1 = mb1.userId;
  });

  afterAll(async () => {
    for (const mosqueId of [mosqueIdA, mosqueIdB]) {
      if (mosqueId) {
        await app.prisma.donation.deleteMany({ where: { mosque_id: mosqueId } });
        await app.prisma.registration.deleteMany({ where: { mosque_id: mosqueId } });
        await app.prisma.program.deleteMany({ where: { mosque_id: mosqueId } });
        await app.prisma.announcement.deleteMany({ where: { mosque_id: mosqueId } });
        await app.prisma.notification.deleteMany({ where: { mosque_id: mosqueId } });
        await app.prisma.membership.deleteMany({ where: { mosque_id: mosqueId } });
        await app.prisma.auditEvent.deleteMany({ where: { mosque_id: mosqueId } });
        await app.prisma.mosque.deleteMany({ where: { mosque_id: mosqueId } });
      }
    }
    await app.prisma.user.deleteMany({
      where: {
        email: {
          in: [
            adminEmailA, progOfficerEmailA, finOfficerEmailA, commsOfficerEmailA,
            memberEmailA1, memberEmailA2, memberEmailA3, memberEmailA4, memberEmailA5,
            adminEmailB, memberEmailB1
          ]
        }
      }
    });
    await app.close();
  });

  // =========================================================================
  // SECTION 1: Programme Capacity Saturation & Registration Boundary Tests
  // =========================================================================
  describe('Adversarial Capacity Saturation & Registration Boundaries', () => {
    let cappedProgramId: number;

    it('creates a capped programme with max_capacity = 2', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': slugA,
          authorization: `Bearer ${progOfficerTokenA}`
        },
        payload: {
          title: 'Tajweed Masterclass (Capacity 2)',
          description: 'Intensive tajweed workshop',
          start_date: new Date(Date.now() + 86400000).toISOString(),
          end_date: new Date(Date.now() + 90000000).toISOString(),
          location: 'Seminar Room A',
          max_capacity: 2,
          category: 'Education',
          visibility: 'Public',
          status: 'Published'
        }
      });
      expect(res.statusCode).toBe(201);
      cappedProgramId = res.json().program_id;
      expect(cappedProgramId).toBeDefined();
    });

    it('allows Member A1 to register (Seat 1/2 -> 201 Created)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/programs/${cappedProgramId}/register`,
        headers: {
          'x-mosque-slug': slugA,
          authorization: `Bearer ${memberTokenA1}`
        }
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().status).toBe('Registered');
    });

    it('blocks duplicate registration from Member A1 with HTTP 409 ALREADY_REGISTERED', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/programs/${cappedProgramId}/register`,
        headers: {
          'x-mosque-slug': slugA,
          authorization: `Bearer ${memberTokenA1}`
        }
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error).toContain('already registered');
    });

    it('allows Member A2 to register (Seat 2/2 -> 201 Created, Capacity Saturated)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/programs/${cappedProgramId}/register`,
        headers: {
          'x-mosque-slug': slugA,
          authorization: `Bearer ${memberTokenA2}`
        }
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().status).toBe('Registered');
    });

    it('strictly rejects Member A3 with HTTP 409 CAPACITY_FULL when capacity is reached', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/programs/${cappedProgramId}/register`,
        headers: {
          'x-mosque-slug': slugA,
          authorization: `Bearer ${memberTokenA3}`
        }
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error).toContain('capacity is full');
    });

    it('allows Member A1 to cancel their registration (freeing up 1 seat)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/programs/${cappedProgramId}/cancel`,
        headers: {
          'x-mosque-slug': slugA,
          authorization: `Bearer ${memberTokenA1}`
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('Cancelled');
    });

    it('allows Member A3 to claim the newly freed seat (Seat 2/2 -> 201 Created)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/programs/${cappedProgramId}/register`,
        headers: {
          'x-mosque-slug': slugA,
          authorization: `Bearer ${memberTokenA3}`
        }
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().status).toBe('Registered');
    });

    it('rejects Member A4 and cancelled Member A1 with HTTP 409 CAPACITY_FULL now that capacity is full again', async () => {
      // Member A4 attempt
      const res4 = await app.inject({
        method: 'POST',
        url: `/api/programs/${cappedProgramId}/register`,
        headers: {
          'x-mosque-slug': slugA,
          authorization: `Bearer ${memberTokenA4}`
        }
      });
      expect(res4.statusCode).toBe(409);
      expect(res4.json().error).toContain('capacity is full');

      // Member A1 re-registration attempt
      const res1 = await app.inject({
        method: 'POST',
        url: `/api/programs/${cappedProgramId}/register`,
        headers: {
          'x-mosque-slug': slugA,
          authorization: `Bearer ${memberTokenA1}`
        }
      });
      expect(res1.statusCode).toBe(409);
      expect(res1.json().error).toContain('capacity is full');
    });

    it('supports unlimited capacity (max_capacity = 0) without 409 rejection', async () => {
      const uncapRes = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: {
          'x-mosque-slug': slugA,
          authorization: `Bearer ${adminTokenA}`
        },
        payload: {
          title: 'Open Community Lecture',
          description: 'Unlimited seating lecture',
          start_date: new Date(Date.now() + 86400000).toISOString(),
          end_date: new Date(Date.now() + 90000000).toISOString(),
          location: 'Main Hall',
          max_capacity: 0,
          status: 'Published'
        }
      });
      expect(uncapRes.statusCode).toBe(201);
      const uncapId = uncapRes.json().program_id;

      // Register 5 members
      for (const token of [memberTokenA1, memberTokenA2, memberTokenA3, memberTokenA4, memberTokenA5]) {
        const regRes = await app.inject({
          method: 'POST',
          url: `/api/programs/${uncapId}/register`,
          headers: { 'x-mosque-slug': slugA, authorization: `Bearer ${token}` }
        });
        expect(regRes.statusCode).toBe(201);
      }
    });

    it('rejects registration on Draft and Cancelled programmes with HTTP 404', async () => {
      const draftRes = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: { 'x-mosque-slug': slugA, authorization: `Bearer ${adminTokenA}` },
        payload: {
          title: 'Draft Unreleased Workshop',
          description: 'Hidden from public',
          start_date: new Date(Date.now() + 86400000).toISOString(),
          end_date: new Date(Date.now() + 90000000).toISOString(),
          location: 'Hall C',
          status: 'Draft'
        }
      });
      expect(draftRes.statusCode).toBe(201);
      const draftId = draftRes.json().program_id;

      const regRes = await app.inject({
        method: 'POST',
        url: `/api/programs/${draftId}/register`,
        headers: { 'x-mosque-slug': slugA, authorization: `Bearer ${memberTokenA1}` }
      });
      expect(regRes.statusCode).toBe(404);
      expect(regRes.json().error).toContain('not found');
    });
  });

  // =========================================================================
  // SECTION 2: Attendance Status Transitions & RBAC Matrix
  // =========================================================================
  describe('Attendance Status State Machine & Role Security Matrix', () => {
    let attendanceProgramId: number;
    let regId: number;

    beforeAll(async () => {
      // Create programme
      const progRes = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: { 'x-mosque-slug': slugA, authorization: `Bearer ${progOfficerTokenA}` },
        payload: {
          title: 'Attendance State Machine Workshop',
          description: 'Testing full lifecycle transitions',
          start_date: new Date(Date.now() + 3600000).toISOString(),
          end_date: new Date(Date.now() + 7200000).toISOString(),
          location: 'Auditorium 1',
          status: 'Published'
        }
      });
      expect(progRes.statusCode).toBe(201);
      attendanceProgramId = progRes.json().program_id;

      // Member A1 registers
      const regRes = await app.inject({
        method: 'POST',
        url: `/api/programs/${attendanceProgramId}/register`,
        headers: { 'x-mosque-slug': slugA, authorization: `Bearer ${memberTokenA1}` }
      });
      expect(regRes.statusCode).toBe(201);
      regId = regRes.json().reg_id;
      expect(regRes.json().status).toBe('Registered');
      expect(regRes.json().attended_at).toBeNull();
    });

    it('Transition 1: Registered -> Attended sets attended_at timestamp and emits audit event', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/registrations/${regId}/attendance`,
        headers: {
          'x-mosque-slug': slugA,
          authorization: `Bearer ${progOfficerTokenA}`
        },
        payload: { status: 'Attended' }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('Attended');
      expect(res.json().attended_at).toBeDefined();
      expect(new Date(res.json().attended_at).getTime()).toBeGreaterThan(0);

      // Verify audit event
      const audit = await app.prisma.auditEvent.findFirst({
        where: {
          mosque_id: mosqueIdA,
          action: 'attendance.recorded',
          target_id: String(regId)
        },
        orderBy: { created_at: 'desc' }
      });
      expect(audit).not.toBeNull();
      expect(audit?.target_type).toBe('Registration');
    });

    it('Transition 2: Attended -> Registered clears attended_at to null', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/registrations/${regId}/attendance`,
        headers: {
          'x-mosque-slug': slugA,
          authorization: `Bearer ${progOfficerTokenA}`
        },
        payload: { status: 'Registered' }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('Registered');
      expect(res.json().attended_at).toBeNull();

      // Database check
      const dbRow = await app.prisma.registration.findUnique({ where: { reg_id: regId } });
      expect(dbRow?.status).toBe('Registered');
      expect(dbRow?.attended_at).toBeNull();
    });

    it('Transition 3: Registered -> Cancelled updates status to Cancelled', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/registrations/${regId}/attendance`,
        headers: {
          'x-mosque-slug': slugA,
          authorization: `Bearer ${adminTokenA}`
        },
        payload: { status: 'Cancelled' }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('Cancelled');
    });

    it('Default payload: omitting status in body defaults to Attended and sets attended_at', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/registrations/${regId}/attendance`,
        headers: {
          'x-mosque-slug': slugA,
          authorization: `Bearer ${progOfficerTokenA}`
        },
        payload: {}
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('Attended');
      expect(res.json().attended_at).not.toBeNull();
    });

    it('enforces RBAC on attendance check-in across all roles', async () => {
      // 1. tenant_admin -> 200 OK
      const adminRes = await app.inject({
        method: 'PATCH',
        url: `/api/admin/registrations/${regId}/attendance`,
        headers: { 'x-mosque-slug': slugA, authorization: `Bearer ${adminTokenA}` },
        payload: { status: 'Attended' }
      });
      expect(adminRes.statusCode).toBe(200);

      // 2. programme_officer -> 200 OK
      const progRes = await app.inject({
        method: 'PATCH',
        url: `/api/admin/registrations/${regId}/attendance`,
        headers: { 'x-mosque-slug': slugA, authorization: `Bearer ${progOfficerTokenA}` },
        payload: { status: 'Attended' }
      });
      expect(progRes.statusCode).toBe(200);

      // 3. finance_officer -> 403 Forbidden
      const finRes = await app.inject({
        method: 'PATCH',
        url: `/api/admin/registrations/${regId}/attendance`,
        headers: { 'x-mosque-slug': slugA, authorization: `Bearer ${finOfficerTokenA}` },
        payload: { status: 'Attended' }
      });
      expect(finRes.statusCode).toBe(403);

      // 4. communications_officer -> 403 Forbidden
      const commsRes = await app.inject({
        method: 'PATCH',
        url: `/api/admin/registrations/${regId}/attendance`,
        headers: { 'x-mosque-slug': slugA, authorization: `Bearer ${commsOfficerTokenA}` },
        payload: { status: 'Attended' }
      });
      expect(commsRes.statusCode).toBe(403);

      // 5. member -> 403 Forbidden
      const memRes = await app.inject({
        method: 'PATCH',
        url: `/api/admin/registrations/${regId}/attendance`,
        headers: { 'x-mosque-slug': slugA, authorization: `Bearer ${memberTokenA1}` },
        payload: { status: 'Attended' }
      });
      expect(memRes.statusCode).toBe(403);

      // 6. Unauthenticated -> 401 Unauthorized
      const unauthRes = await app.inject({
        method: 'PATCH',
        url: `/api/admin/registrations/${regId}/attendance`,
        headers: { 'x-mosque-slug': slugA },
        payload: { status: 'Attended' }
      });
      expect(unauthRes.statusCode).toBe(401);
    });

    it('Cross-tenant attack: Tenant B Admin cannot mutate attendance for Tenant A registration (returns 404)', async () => {
      const crossRes = await app.inject({
        method: 'PATCH',
        url: `/api/admin/registrations/${regId}/attendance`,
        headers: {
          'x-mosque-slug': slugB,
          authorization: `Bearer ${adminTokenB}`
        },
        payload: { status: 'Cancelled' }
      });
      expect(crossRes.statusCode).toBe(404);
      expect(crossRes.json().error).toContain('not found');
    });
  });

  // =========================================================================
  // SECTION 3: Targeted Reminder Dispatch & Notification Delivery
  // =========================================================================
  describe('Targeted Reminder Dispatch & Structured Audit Verification', () => {
    let reminderProgId: number;
    let regId1: number;
    let regId2: number;
    let regId3: number;
    let regId4: number;

    beforeAll(async () => {
      // Create programme
      const progRes = await app.inject({
        method: 'POST',
        url: '/api/admin/programs',
        headers: { 'x-mosque-slug': slugA, authorization: `Bearer ${progOfficerTokenA}` },
        payload: {
          title: 'Special Reminder Intensive',
          description: 'Testing reminder dispatch filtering',
          start_date: new Date(Date.now() + 7200000).toISOString(),
          end_date: new Date(Date.now() + 10800000).toISOString(),
          location: 'Hall B',
          status: 'Published'
        }
      });
      expect(progRes.statusCode).toBe(201);
      reminderProgId = progRes.json().program_id;

      // Register 4 members
      const r1 = await app.inject({
        method: 'POST',
        url: `/api/programs/${reminderProgId}/register`,
        headers: { 'x-mosque-slug': slugA, authorization: `Bearer ${memberTokenA1}` }
      });
      regId1 = r1.json().reg_id;

      const r2 = await app.inject({
        method: 'POST',
        url: `/api/programs/${reminderProgId}/register`,
        headers: { 'x-mosque-slug': slugA, authorization: `Bearer ${memberTokenA2}` }
      });
      regId2 = r2.json().reg_id;

      const r3 = await app.inject({
        method: 'POST',
        url: `/api/programs/${reminderProgId}/register`,
        headers: { 'x-mosque-slug': slugA, authorization: `Bearer ${memberTokenA3}` }
      });
      regId3 = r3.json().reg_id;

      const r4 = await app.inject({
        method: 'POST',
        url: `/api/programs/${reminderProgId}/register`,
        headers: { 'x-mosque-slug': slugA, authorization: `Bearer ${memberTokenA4}` }
      });
      regId4 = r4.json().reg_id;

      // Set member statuses:
      // Member A1: remains 'Registered'
      // Member A2: transition to 'Attended'
      await app.inject({
        method: 'PATCH',
        url: `/api/admin/registrations/${regId2}/attendance`,
        headers: { 'x-mosque-slug': slugA, authorization: `Bearer ${progOfficerTokenA}` },
        payload: { status: 'Attended' }
      });

      // Member A3: transition to 'Cancelled'
      await app.inject({
        method: 'POST',
        url: `/api/programs/${reminderProgId}/cancel`,
        headers: { 'x-mosque-slug': slugA, authorization: `Bearer ${memberTokenA3}` }
      });

      // Member A4: remains 'Registered'
    });

    it('POST /api/admin/programs/:id/reminders delivers notifications ONLY to active "Registered" attendees (Member A1 and A4)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/admin/programs/${reminderProgId}/reminders`,
        headers: {
          'x-mosque-slug': slugA,
          authorization: `Bearer ${progOfficerTokenA}`
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ sent: 2 });

      // Check database notifications for this program
      const notifs = await app.prisma.notification.findMany({
        where: {
          mosque_id: mosqueIdA,
          related_type: 'Program',
          related_id: reminderProgId
        }
      });
      expect(notifs.length).toBe(2);

      const recipientUserIds = notifs.map(n => n.user_id);
      expect(recipientUserIds).toContain(memberUserIdA1);
      expect(recipientUserIds).toContain(memberUserIdA4);
      expect(recipientUserIds).not.toContain(memberUserIdA2); // Attended -> excluded
      expect(recipientUserIds).not.toContain(memberUserIdA3); // Cancelled -> excluded

      // Verify notification details
      for (const n of notifs) {
        expect(n.type).toBe('In-App');
        expect(n.status).toBe('Sent');
        expect(n.is_read).toBe(false);
        expect(n.message).toContain('Special Reminder Intensive');
      }

      // Verify Audit Event
      const audit = await app.prisma.auditEvent.findFirst({
        where: {
          mosque_id: mosqueIdA,
          action: 'program.reminders_sent',
          target_id: String(reminderProgId)
        },
        orderBy: { created_at: 'desc' }
      });
      expect(audit).not.toBeNull();
      expect(audit?.target_type).toBe('Program');
      expect(audit?.summary).toContain('2 reminders sent');
    });

    it('enforces RBAC on reminder dispatch', async () => {
      // tenant_admin -> 200 OK
      const adminRes = await app.inject({
        method: 'POST',
        url: `/api/admin/programs/${reminderProgId}/reminders`,
        headers: { 'x-mosque-slug': slugA, authorization: `Bearer ${adminTokenA}` }
      });
      expect(adminRes.statusCode).toBe(200);

      // finance_officer -> 403 Forbidden
      const finRes = await app.inject({
        method: 'POST',
        url: `/api/admin/programs/${reminderProgId}/reminders`,
        headers: { 'x-mosque-slug': slugA, authorization: `Bearer ${finOfficerTokenA}` }
      });
      expect(finRes.statusCode).toBe(403);

      // communications_officer -> 403 Forbidden
      const commsRes = await app.inject({
        method: 'POST',
        url: `/api/admin/programs/${reminderProgId}/reminders`,
        headers: { 'x-mosque-slug': slugA, authorization: `Bearer ${commsOfficerTokenA}` }
      });
      expect(commsRes.statusCode).toBe(403);

      // member -> 403 Forbidden
      const memRes = await app.inject({
        method: 'POST',
        url: `/api/admin/programs/${reminderProgId}/reminders`,
        headers: { 'x-mosque-slug': slugA, authorization: `Bearer ${memberTokenA1}` }
      });
      expect(memRes.statusCode).toBe(403);
    });

    it('Cross-tenant attack: Tenant B Admin cannot dispatch reminders for Tenant A programme (returns 404)', async () => {
      const crossRes = await app.inject({
        method: 'POST',
        url: `/api/admin/programs/${reminderProgId}/reminders`,
        headers: {
          'x-mosque-slug': slugB,
          authorization: `Bearer ${adminTokenB}`
        }
      });
      expect(crossRes.statusCode).toBe(404);
      expect(crossRes.json().error).toContain('not found');
    });
  });

  // =========================================================================
  // SECTION 4: In-App Notification Center & Cross-Tenant Security
  // =========================================================================
  describe('In-App Notification Center & Cross-Tenant Isolation', () => {
    let notifA1Id: number;

    beforeAll(async () => {
      // Member A1 retrieves their inbox
      const inboxRes = await app.inject({
        method: 'GET',
        url: '/api/members/notifications',
        headers: {
          'x-mosque-slug': slugA,
          authorization: `Bearer ${memberTokenA1}`
        }
      });
      expect(inboxRes.statusCode).toBe(200);
      const notifications = inboxRes.json();
      expect(notifications.length).toBeGreaterThan(0);
      notifA1Id = notifications[0].notif_id;
      expect(notifications[0].is_read).toBe(false);
    });

    it('Member A1 marks their notification as read via PATCH /api/members/notifications/:id/read', async () => {
      const readRes = await app.inject({
        method: 'PATCH',
        url: `/api/members/notifications/${notifA1Id}/read`,
        headers: {
          'x-mosque-slug': slugA,
          authorization: `Bearer ${memberTokenA1}`
        }
      });
      expect(readRes.statusCode).toBe(200);
      expect(readRes.json().is_read).toBe(true);

      // Verify in DB
      const updated = await app.prisma.notification.findUnique({ where: { notif_id: notifA1Id } });
      expect(updated?.is_read).toBe(true);
    });

    it('Cross-User Attack: Member A2 cannot mark Member A1 notification as read (returns 404)', async () => {
      const hijackRes = await app.inject({
        method: 'PATCH',
        url: `/api/members/notifications/${notifA1Id}/read`,
        headers: {
          'x-mosque-slug': slugA,
          authorization: `Bearer ${memberTokenA2}`
        }
      });
      expect(hijackRes.statusCode).toBe(404);
      expect(hijackRes.json().error).toContain('not found');
    });

    it('Cross-Tenant Attack: Tenant B Member cannot mark Tenant A notification as read (returns 404)', async () => {
      const crossReadRes = await app.inject({
        method: 'PATCH',
        url: `/api/members/notifications/${notifA1Id}/read`,
        headers: {
          'x-mosque-slug': slugB,
          authorization: `Bearer ${memberTokenB1}`
        }
      });
      expect(crossReadRes.statusCode).toBe(404);
      expect(crossReadRes.json().error).toContain('not found');
    });

    it('Cross-Tenant Attack: Tenant B Member inbox returns zero notifications from Tenant A', async () => {
      const inboxBRes = await app.inject({
        method: 'GET',
        url: '/api/members/notifications',
        headers: {
          'x-mosque-slug': slugB,
          authorization: `Bearer ${memberTokenB1}`
        }
      });
      expect(inboxBRes.statusCode).toBe(200);
      const items = inboxBRes.json();
      expect(items.length).toBe(0);
    });

    it('rejects unauthenticated read requests with HTTP 401', async () => {
      const unauthRes = await app.inject({
        method: 'PATCH',
        url: `/api/members/notifications/${notifA1Id}/read`,
        headers: { 'x-mosque-slug': slugA }
      });
      expect(unauthRes.statusCode).toBe(401);
    });

    it('rejects non-integer notification ID with HTTP 400', async () => {
      const badIdRes = await app.inject({
        method: 'PATCH',
        url: '/api/members/notifications/not-an-integer/read',
        headers: {
          'x-mosque-slug': slugA,
          authorization: `Bearer ${memberTokenA1}`
        }
      });
      expect(badIdRes.statusCode).toBe(400);
    });
  });
});
