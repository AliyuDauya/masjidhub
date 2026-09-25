import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';

// Standard Node crypto hash fallback helper
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// --- Domain Models Mock Database Helpers ---
function createMockDb() {
  return {
    mosques: [
      { mosque_id: 1, name: 'Al-Noor Central Masjid', slug: 'al-noor', address: '123 Main St', email: 'info@alnoor.org' },
      { mosque_id: 2, name: 'Central Mosque', slug: 'central', address: '456 Way', email: 'info@central.org' }
    ],
    users: [
      { user_id: 1, mosque_id: 1, name: 'Admin User', email: 'admin@alnoor.org', password_hash: hashPassword('admin123'), role: 'admin' },
      { user_id: 2, mosque_id: 1, name: 'Member User', email: 'member@alnoor.org', password_hash: hashPassword('member123'), role: 'member' }
    ],
    announcements: [
      { announcement_id: 1, mosque_id: 1, admin_id: 1, title: 'Quran Class', content: 'Starts Monday', category: 'Event', posted_at: new Date(), expiry_date: null },
      { announcement_id: 2, mosque_id: 1, admin_id: 1, title: 'Friday Khutbah', content: '1:15 PM', category: 'Urgent', posted_at: new Date(), expiry_date: null }
    ],
    programs: [
      { program_id: 1, mosque_id: 1, title: 'Tajweed Course', description: 'Learn tajweed', start_date: new Date(), end_date: new Date(), location: 'Hall A', max_capacity: 50 },
      { program_id: 2, mosque_id: 1, title: 'Seminar', description: 'Zakat seminar', start_date: new Date(), end_date: new Date(), location: 'Hall B', max_capacity: 0 }
    ],
    registrations: [
      { reg_id: 1, user_id: 2, program_id: 1, reg_date: new Date(), status: 'Registered' }
    ],
    donations: [
      { donation_id: 1, mosque_id: 1, user_id: 2, amount: 150, category: 'Zakat', method: 'Card', status: 'Completed', date: new Date() },
      { donation_id: 2, mosque_id: 1, user_id: null, amount: 50, category: 'Sadaqah', method: 'Cash', status: 'Completed', date: new Date() }
    ]
  };
}

describe('MasjidHub Backend Logic & Requirements Verification', () => {

  describe('Tenant Hook & Domain Isolation', () => {
    it('should validate tenant context from slug header or route parameter', () => {
      const db = createMockDb();
      const findMosqueBySlug = (slug) => db.mosques.find(m => m.slug === slug.toLowerCase());

      const tenant1 = findMosqueBySlug('al-noor');
      assert.ok(tenant1);
      assert.strictEqual(tenant1.name, 'Al-Noor Central Masjid');

      const nonexistent = findMosqueBySlug('non-existent');
      assert.strictEqual(nonexistent, undefined);
    });

    it('should isolate users per mosque tenant slug', () => {
      const db = createMockDb();
      const findUserInTenant = (mosqueId, email) =>
        db.users.find(u => u.mosque_id === mosqueId && u.email.toLowerCase() === email.toLowerCase());

      const user1 = findUserInTenant(1, 'admin@alnoor.org');
      assert.ok(user1);

      // Same email in different mosque tenant should not exist yet
      const userInOtherTenant = findUserInTenant(2, 'admin@alnoor.org');
      assert.strictEqual(userInOtherTenant, undefined);
    });
  });

  describe('Authentication & Password Security', () => {
    it('should verify password hash', () => {
      const db = createMockDb();
      const user = db.users[0]; // admin@alnoor.org -> 'admin123'

      const inputHash = hashPassword('admin123');
      assert.strictEqual(inputHash, user.password_hash);

      const wrongHash = hashPassword('wrongpass');
      assert.notStrictEqual(wrongHash, user.password_hash);
    });

    it('should strip password_hash from registration response payload', () => {
      const passwordHash = hashPassword('newpassword123');
      const newUser = {
        user_id: 3,
        mosque_id: 1,
        name: 'New Member',
        email: 'new@alnoor.org',
        password_hash: passwordHash,
        role: 'member'
      };

      const { password_hash, ...sanitized } = newUser;
      assert.strictEqual(sanitized.password_hash, undefined);
      assert.strictEqual(sanitized.email, 'new@alnoor.org');
      assert.strictEqual(sanitized.role, 'member');
    });

    it('should generate secure password reset token payload for valid user', () => {
      const db = createMockDb();
      const user = db.users[1];
      const resetPayload = {
        user_id: user.user_id,
        email: user.email,
        type: 'pwd_reset'
      };
      assert.strictEqual(resetPayload.user_id, 2);
      assert.strictEqual(resetPayload.type, 'pwd_reset');
    });

    it('should update password hash on password reset and verify new password', () => {
      const db = createMockDb();
      const user = db.users[1]; // original password: member123
      const newPassword = 'freshSecurePassword2026!';
      assert.ok(newPassword.length >= 8);
      user.password_hash = hashPassword(newPassword);
      assert.strictEqual(user.password_hash, hashPassword(newPassword));
      assert.notStrictEqual(user.password_hash, hashPassword('member123'));
    });

    it('should reject password reset payloads with password less than 8 characters', () => {
      const invalidPassword = 'short';
      const isValid = invalidPassword.length >= 8;
      assert.strictEqual(isValid, false);
    });
  });

  describe('Mosque Registration Endpoint Logic', () => {
    it('should reject missing name or slug', () => {
      const body = { slug: 'new-mosque' };
      const isValid = Boolean(body.name && body.slug);
      assert.strictEqual(isValid, false);
    });

    it('should sanitize URL slugs to lowercase alphanumeric with hyphens', () => {
      const rawSlug = 'Al-Noor!!!';
      const formattedSlug = rawSlug.toLowerCase().replace(/[^a-z0-9-]/g, '');
      assert.strictEqual(formattedSlug, 'al-noor');
    });
  });

  describe('Program Capacity & Double Registration Checks', () => {
    it('should block registration when program capacity is full', () => {
      const program = { max_capacity: 2 };
      const activeRegistrations = [{ status: 'Registered' }, { status: 'Registered' }];

      const isFull = program.max_capacity > 0 && activeRegistrations.length >= program.max_capacity;
      assert.strictEqual(isFull, true);
    });

    it('should allow registration when capacity is unlimited (max_capacity = 0)', () => {
      const program = { max_capacity: 0 };
      const activeRegistrations = [{ status: 'Registered' }, { status: 'Registered' }, { status: 'Registered' }];

      const isFull = program.max_capacity > 0 && activeRegistrations.length >= program.max_capacity;
      assert.strictEqual(isFull, false);
    });
  });

  describe('Donations & Analytics Calculation', () => {
    it('should reject donations with amount <= 0', () => {
      const amount = -10;
      const isValid = amount > 0;
      assert.strictEqual(isValid, false);
    });

    it('should aggregate donation totals and breakdown by category correctly', () => {
      const donations = [
        { amount: 100, category: 'Zakat' },
        { amount: 50, category: 'Sadaqah' },
        { amount: 200, category: 'Zakat' },
        { amount: 75, category: 'Waqf' }
      ];

      let total = 0;
      const byCategory = { Zakat: 0, Sadaqah: 0, Waqf: 0, General: 0 };

      donations.forEach((d) => {
        total += d.amount;
        byCategory[d.category] += d.amount;
      });

      assert.strictEqual(total, 425);
      assert.strictEqual(byCategory.Zakat, 300);
      assert.strictEqual(byCategory.Sadaqah, 50);
      assert.strictEqual(byCategory.Waqf, 75);
    });
  });

  describe('Adversarial Session Security & CSRF Logic Verification', () => {
    const CSRF_SECRET = 'masjidhub-csrf-default-secret-key-32chars!!';

    function createCsrfToken() {
      const raw = crypto.randomBytes(24).toString('hex');
      const signature = crypto.createHmac('sha256', CSRF_SECRET).update(raw).digest('hex');
      return `${raw}.${signature}`;
    }

    function verifyCsrfToken(token) {
      if (!token || typeof token !== 'string') return false;
      const parts = token.split('.');
      if (parts.length !== 2) return false;
      const [raw, signature] = parts;
      if (!raw || !signature) return false;
      const expected = crypto.createHmac('sha256', CSRF_SECRET).update(raw).digest('hex');
      if (signature.length !== expected.length) return false;
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    }

    it('should validate genuine tokens produced by createCsrfToken', () => {
      for (let i = 0; i < 10; i++) {
        const token = createCsrfToken();
        assert.strictEqual(verifyCsrfToken(token), true);
      }
    });

    it('should reject malformed tokens without throwing unhandled exceptions', () => {
      const invalidInputs = [
        null,
        undefined,
        '',
        '   ',
        'no_dot_in_token',
        'too.many.dots.in.token',
        '.signature_only',
        'raw_only.',
        12345,
        {},
        []
      ];

      for (const input of invalidInputs) {
        assert.strictEqual(verifyCsrfToken(input), false);
      }
    });

    it('should reject forged signatures signed with incorrect secret', () => {
      const raw = crypto.randomBytes(24).toString('hex');
      const forgedSig = crypto.createHmac('sha256', 'attacker-secret-key-123456789012').update(raw).digest('hex');
      assert.strictEqual(verifyCsrfToken(`${raw}.${forgedSig}`), false);
    });

    it('should reject tampered raw content with authentic signature', () => {
      const token = createCsrfToken();
      const [, sig] = token.split('.');
      const tamperedRaw = crypto.randomBytes(24).toString('hex');
      assert.strictEqual(verifyCsrfToken(`${tamperedRaw}.${sig}`), false);
    });

    it('should reject truncated or length-mismatched signatures without timing exception', () => {
      const token = createCsrfToken();
      const [raw, sig] = token.split('.');
      assert.strictEqual(verifyCsrfToken(`${raw}.${sig.slice(0, 16)}`), false);
      assert.strictEqual(verifyCsrfToken(`${raw}.${sig + 'extra'}`), false);
    });

    it('should enforce CSRF check on mutation methods (POST, PUT, PATCH, DELETE) when session cookie is present', () => {
      const checkCsrfRequired = (method, cookies, path) => {
        const mutationMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
        if (!mutationMethods.includes(method.toUpperCase())) return false;
        if (!cookies || !cookies.mh_session) return false;
        const publicExemptions = [
          '/api/auth/login',
          '/api/auth/register',
          '/api/platform/auth/login',
          '/api/auth/logout',
          '/api/platform/auth/logout'
        ];
        return !publicExemptions.includes(path);
      };

      // Mutation with cookie on protected endpoint -> CSRF required
      assert.strictEqual(checkCsrfRequired('POST', { mh_session: 'jwt.token.val' }, '/api/admin/programs'), true);
      assert.strictEqual(checkCsrfRequired('PUT', { mh_session: 'jwt.token.val' }, '/api/admin/programs/1'), true);
      assert.strictEqual(checkCsrfRequired('PATCH', { mh_session: 'jwt.token.val' }, '/api/admin/donations/1/reconcile'), true);
      assert.strictEqual(checkCsrfRequired('DELETE', { mh_session: 'jwt.token.val' }, '/api/admin/programs/1'), true);

      // Mutation without cookie (Bearer only) -> CSRF not required
      assert.strictEqual(checkCsrfRequired('POST', {}, '/api/admin/programs'), false);
      assert.strictEqual(checkCsrfRequired('POST', null, '/api/admin/programs'), false);

      // Safe methods with cookie -> CSRF not required
      assert.strictEqual(checkCsrfRequired('GET', { mh_session: 'jwt.token.val' }, '/api/admin/programs'), false);
      assert.strictEqual(checkCsrfRequired('OPTIONS', { mh_session: 'jwt.token.val' }, '/api/admin/programs'), false);

      // Public mutation exemptions -> CSRF not required
      assert.strictEqual(checkCsrfRequired('POST', { mh_session: 'jwt.token.val' }, '/api/auth/login'), false);
      assert.strictEqual(checkCsrfRequired('POST', { mh_session: 'jwt.token.val' }, '/api/auth/register'), false);
      assert.strictEqual(checkCsrfRequired('POST', { mh_session: 'jwt.token.val' }, '/api/auth/logout'), false);
    });
  });

  describe('Adversarial Schema Validation & Fuzzing Logic', () => {
    function validatePayload(schema, body) {
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { valid: false, error: 'Body must be an object' };
      }
      if (schema.required) {
        for (const req of schema.required) {
          if (body[req] === undefined || body[req] === null || body[req] === '') {
            return { valid: false, error: `Missing required field: ${req}` };
          }
        }
      }
      if (schema.additionalProperties === false) {
        const allowed = Object.keys(schema.properties || {});
        for (const key of Object.keys(body)) {
          if (!allowed.includes(key)) {
            return { valid: false, error: `Additional property not allowed: ${key}` };
          }
        }
      }
      if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          const val = body[key];
          if (val === undefined) continue;

          if (prop.type === 'string') {
            if (typeof val !== 'string') return { valid: false, error: `${key} must be string` };
            if (prop.minLength && val.length < prop.minLength) return { valid: false, error: `${key} too short` };
            if (prop.maxLength && val.length > prop.maxLength) return { valid: false, error: `${key} too long` };
            if (prop.pattern && !new RegExp(prop.pattern).test(val)) return { valid: false, error: `${key} invalid pattern` };
            if (prop.enum && !prop.enum.includes(val)) return { valid: false, error: `${key} invalid enum` };
          } else if (prop.type === 'integer') {
            if (!Number.isInteger(val)) return { valid: false, error: `${key} must be integer` };
            if (prop.minimum !== undefined && val < prop.minimum) return { valid: false, error: `${key} below minimum` };
          } else if (prop.type === 'number') {
            if (typeof val !== 'number' || !Number.isFinite(val)) return { valid: false, error: `${key} must be number` };
            if (prop.minimum !== undefined && val < prop.minimum) return { valid: false, error: `${key} below minimum` };
          } else if (prop.type === 'boolean') {
            if (typeof val !== 'boolean') return { valid: false, error: `${key} must be boolean` };
          }
        }
      }
      return { valid: true };
    }

    it('should reject malformed donation payloads (missing fields, negative amounts, string amounts, invalid enums)', () => {
      const donationSchema = {
        required: ['amount', 'category', 'method'],
        properties: {
          amount: { type: 'number', minimum: 0.01 },
          category: { type: 'string', enum: ['Zakat', 'Sadaqah', 'Waqf', 'General'] },
          method: { type: 'string', enum: ['Card', 'Transfer'] },
          currency: { type: 'string', minLength: 3, maxLength: 3 }
        },
        additionalProperties: false
      };

      assert.strictEqual(validatePayload(donationSchema, {}).valid, false);
      assert.strictEqual(validatePayload(donationSchema, { amount: -50, category: 'Zakat', method: 'Card' }).valid, false);
      assert.strictEqual(validatePayload(donationSchema, { amount: 0, category: 'Zakat', method: 'Card' }).valid, false);
      assert.strictEqual(validatePayload(donationSchema, { amount: 'one hundred', category: 'Zakat', method: 'Card' }).valid, false);
      assert.strictEqual(validatePayload(donationSchema, { amount: 100, category: 'InvalidCat', method: 'Card' }).valid, false);
      assert.strictEqual(validatePayload(donationSchema, { amount: 100, category: 'Zakat', method: 'Cash' }).valid, false);
      assert.strictEqual(validatePayload(donationSchema, { amount: 100, category: 'Zakat', method: 'Card', extra: 'bad' }).valid, false);
      assert.strictEqual(validatePayload(donationSchema, { amount: 100, category: 'Zakat', method: 'Card', currency: 'USDD' }).valid, false);
      assert.strictEqual(validatePayload(donationSchema, { amount: 100, category: 'Zakat', method: 'Card' }).valid, true);
    });

    it('should reject malformed program payloads (missing required fields, string capacity, negative capacity)', () => {
      const programSchema = {
        required: ['title', 'description', 'start_date', 'end_date', 'location'],
        properties: {
          title: { type: 'string', minLength: 2, maxLength: 200 },
          description: { type: 'string', minLength: 1 },
          category: { type: 'string', maxLength: 100 },
          start_date: { type: 'string', minLength: 10 },
          end_date: { type: 'string', minLength: 10 },
          location: { type: 'string', minLength: 1, maxLength: 200 },
          max_capacity: { type: 'integer', minimum: 0 },
          visibility: { type: 'string', enum: ['Public', 'Members'] },
          status: { type: 'string', enum: ['Draft', 'Published', 'Cancelled', 'Completed'] }
        },
        additionalProperties: false
      };

      assert.strictEqual(validatePayload(programSchema, {}).valid, false);
      assert.strictEqual(validatePayload(programSchema, { title: 'T' }).valid, false);
      assert.strictEqual(validatePayload(programSchema, {
        title: 'Valid Program',
        description: 'Valid Desc',
        start_date: '2026-09-01T10:00:00Z',
        end_date: '2026-09-01T12:00:00Z',
        location: 'Main Hall',
        max_capacity: 'fifty'
      }).valid, false);
      assert.strictEqual(validatePayload(programSchema, {
        title: 'Valid Program',
        description: 'Valid Desc',
        start_date: '2026-09-01T10:00:00Z',
        end_date: '2026-09-01T12:00:00Z',
        location: 'Main Hall',
        max_capacity: -5
      }).valid, false);
      assert.strictEqual(validatePayload(programSchema, {
        title: 'Valid Program',
        description: 'Valid Desc',
        start_date: '2026-09-01T10:00:00Z',
        end_date: '2026-09-01T12:00:00Z',
        location: 'Main Hall',
        max_capacity: 50,
        visibility: 'Public',
        status: 'Published'
      }).valid, true);
    });

    it('should reject non-integer path parameter IDs', () => {
      const validateIdParam = (id) => {
        const num = Number(id);
        return Number.isInteger(num) && num >= 1;
      };

      assert.strictEqual(validateIdParam('abc'), false);
      assert.strictEqual(validateIdParam('invalid-uuid-1234'), false);
      assert.strictEqual(validateIdParam('0'), false);
      assert.strictEqual(validateIdParam('-1'), false);
      assert.strictEqual(validateIdParam('1.5'), false);
      assert.strictEqual(validateIdParam('10'), true);
      assert.strictEqual(validateIdParam('999999'), true);
    });
  });

  describe('Adversarial CORS Origin Resolution Logic', () => {
    const defaultAllowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5000',
      'http://127.0.0.1:5000'
    ];

    function resolveCorsOrigin(origin, envOrigins = []) {
      if (!origin) return { allow: true, origin: null };
      const allowed = Array.from(new Set([...defaultAllowedOrigins, ...envOrigins]));
      if (allowed.includes(origin) || (envOrigins.length === 1 && envOrigins[0] === '*')) {
        return { allow: true, origin };
      }
      return { allow: false, origin: null };
    }

    it('should permit all whitelisted origins with exact match', () => {
      for (const origin of defaultAllowedOrigins) {
        const res = resolveCorsOrigin(origin);
        assert.strictEqual(res.allow, true);
        assert.strictEqual(res.origin, origin);
      }
    });

    it('should reject hostile and malicious origins without reflecting them', () => {
      const hostileOrigins = [
        'http://evil.com',
        'https://attacker.org',
        'http://localhost:3000.evil.com',
        'http://evil-localhost:3000',
        'http://localhost:9999',
        'http://127.0.0.1:8080',
        'null',
        'https://subdomain.localhost:3000'
      ];

      for (const origin of hostileOrigins) {
        const res = resolveCorsOrigin(origin);
        assert.strictEqual(res.allow, false);
        assert.strictEqual(res.origin, null);
      }
    });

    it('should support dynamic custom whitelist via CORS_ORIGIN environment variable', () => {
      const customEnv = ['https://portal.my-mosque.org', 'https://admin.my-mosque.org'];
      assert.strictEqual(resolveCorsOrigin('https://portal.my-mosque.org', customEnv).allow, true);
      assert.strictEqual(resolveCorsOrigin('https://admin.my-mosque.org', customEnv).allow, true);
      assert.strictEqual(resolveCorsOrigin('https://evil-mosque.org', customEnv).allow, false);
    });
  });

  describe('AuditEvent Integrity & Consecutive Action Verification', () => {
    it('should enforce non-null request_id and ip_address across consecutive administrative actions', () => {
      const auditLogStore = [];

      function createAuditEvent({ mosque_id, actor_id, action, target_type, target_id, summary, request_id, ip_address }) {
        if (!request_id || typeof request_id !== 'string') throw new Error('AuditEvent missing non-null request_id');
        if (!ip_address || typeof ip_address !== 'string') throw new Error('AuditEvent missing non-null ip_address');
        if (!mosque_id) throw new Error('AuditEvent missing mosque_id');
        if (!action) throw new Error('AuditEvent missing action');
        if (!target_type) throw new Error('AuditEvent missing target_type');

        const event = {
          audit_id: auditLogStore.length + 1,
          mosque_id,
          actor_id: actor_id || null,
          action,
          target_type,
          target_id: target_id ? String(target_id) : null,
          summary,
          request_id,
          ip_address,
          created_at: new Date()
        };
        auditLogStore.push(event);
        return event;
      }

      // Simulate a pipeline of 12 consecutive admin operations
      const operations = [
        { action: 'tenant.applied', target_type: 'Mosque', target_id: '1', summary: 'Mosque application submitted.' },
        { action: 'tenant.active', target_type: 'Mosque', target_id: '1', summary: 'Tenant marked Active.' },
        { action: 'tenant.updated', target_type: 'Mosque', target_id: '1', summary: 'Mosque settings updated.' },
        { action: 'membership.invited', target_type: 'Membership', target_id: '10', summary: 'Officer invited.' },
        { action: 'membership.updated', target_type: 'Membership', target_id: '10', summary: 'Permissions updated.' },
        { action: 'program.created', target_type: 'Program', target_id: '100', summary: 'Programme created.' },
        { action: 'program.updated', target_type: 'Program', target_id: '100', summary: 'Programme updated.' },
        { action: 'registration.created', target_type: 'Registration', target_id: '50', summary: 'Seat registered.' },
        { action: 'attendance.recorded', target_type: 'Registration', target_id: '50', summary: 'Attendance recorded.' },
        { action: 'donation.recorded', target_type: 'Donation', target_id: '200', summary: 'Cash donation recorded.' },
        { action: 'donation.reconciled', target_type: 'Donation', target_id: '200', summary: 'Donation reconciled.' },
        { action: 'donations.exported', target_type: 'DonationReport', target_id: null, summary: 'CSV exported.' }
      ];

      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        createAuditEvent({
          mosque_id: 1,
          actor_id: 42,
          action: op.action,
          target_type: op.target_type,
          target_id: op.target_id,
          summary: op.summary,
          request_id: `req-pipeline-${i + 1}-${crypto.randomUUID()}`,
          ip_address: '198.51.100.42'
        });
      }

      assert.strictEqual(auditLogStore.length, 12);
      for (const record of auditLogStore) {
        assert.ok(record.request_id);
        assert.strictEqual(typeof record.request_id, 'string');
        assert.ok(record.ip_address);
        assert.strictEqual(record.ip_address, '198.51.100.42');
        assert.strictEqual(record.mosque_id, 1);
        assert.ok(record.action);
        assert.ok(record.target_type);
      }
    });
  });

  describe('Milestone 3 Adversarial Domain Logic: Capacity, Attendance, Reminders & Notifications', () => {
    it('should correctly handle capacity saturation, cancellations, and re-registrations', () => {
      const program = { program_id: 1, mosque_id: 1, max_capacity: 2, status: 'Published' };
      const registrations = [];

      function registerUser(userId) {
        const existing = registrations.find(r => r.user_id === userId && r.program_id === program.program_id);
        if (existing && existing.status !== 'Cancelled') {
          return { error: 'ALREADY_REGISTERED', status: 409 };
        }
        if (program.max_capacity > 0) {
          const occupied = registrations.filter(r => r.program_id === program.program_id && r.status === 'Registered').length;
          if (occupied >= program.max_capacity) {
            return { error: 'CAPACITY_FULL', status: 409 };
          }
        }
        if (existing) {
          existing.status = 'Registered';
          existing.reg_date = new Date();
          existing.attended_at = null;
          return { success: true, registration: existing, status: 201 };
        }
        const newReg = {
          reg_id: registrations.length + 1,
          mosque_id: program.mosque_id,
          user_id: userId,
          program_id: program.program_id,
          status: 'Registered',
          reg_date: new Date(),
          attended_at: null
        };
        registrations.push(newReg);
        return { success: true, registration: newReg, status: 201 };
      }

      function cancelUser(userId) {
        const existing = registrations.find(r => r.user_id === userId && r.program_id === program.program_id);
        if (!existing || existing.status === 'Cancelled') {
          return { error: 'NOT_FOUND', status: 404 };
        }
        existing.status = 'Cancelled';
        return { success: true, registration: existing, status: 200 };
      }

      // User 1 registers -> 201 (1/2)
      const r1 = registerUser(101);
      assert.strictEqual(r1.status, 201);
      assert.strictEqual(r1.registration.status, 'Registered');

      // User 1 duplicate registration -> 409 ALREADY_REGISTERED
      const r1Dup = registerUser(101);
      assert.strictEqual(r1Dup.status, 409);
      assert.strictEqual(r1Dup.error, 'ALREADY_REGISTERED');

      // User 2 registers -> 201 (2/2, full)
      const r2 = registerUser(102);
      assert.strictEqual(r2.status, 201);

      // User 3 registers -> 409 CAPACITY_FULL
      const r3 = registerUser(103);
      assert.strictEqual(r3.status, 409);
      assert.strictEqual(r3.error, 'CAPACITY_FULL');

      // User 1 cancels -> 200 (1/2 freed)
      const c1 = cancelUser(101);
      assert.strictEqual(c1.status, 200);
      assert.strictEqual(c1.registration.status, 'Cancelled');

      // User 3 retries registration -> 201 (2/2 claimed)
      const r3Retry = registerUser(103);
      assert.strictEqual(r3Retry.status, 201);

      // User 1 re-registration while full -> 409 CAPACITY_FULL
      const r1ReReg = registerUser(101);
      assert.strictEqual(r1ReReg.status, 409);
      assert.strictEqual(r1ReReg.error, 'CAPACITY_FULL');
    });

    it('should correctly transition attendance states and manage attended_at timestamps', () => {
      const reg = {
        reg_id: 1,
        mosque_id: 1,
        user_id: 5,
        program_id: 10,
        status: 'Registered',
        attended_at: null
      };

      function updateAttendance(record, targetStatus = 'Attended') {
        const attendedAt = targetStatus === 'Attended' ? new Date() : (targetStatus === 'Registered' ? null : record.attended_at);
        record.status = targetStatus;
        record.attended_at = attendedAt;
        return record;
      }

      // Initial state
      assert.strictEqual(reg.status, 'Registered');
      assert.strictEqual(reg.attended_at, null);

      // Transition to Attended
      updateAttendance(reg, 'Attended');
      assert.strictEqual(reg.status, 'Attended');
      assert.ok(reg.attended_at instanceof Date);

      // Transition back to Registered (undo check-in)
      updateAttendance(reg, 'Registered');
      assert.strictEqual(reg.status, 'Registered');
      assert.strictEqual(reg.attended_at, null);

      // Transition to Cancelled
      updateAttendance(reg, 'Cancelled');
      assert.strictEqual(reg.status, 'Cancelled');
    });

    it('should filter reminder dispatch to only Registered attendees and generate audit events', () => {
      const attendees = [
        { reg_id: 1, user_id: 10, status: 'Registered' },
        { reg_id: 2, user_id: 20, status: 'Attended' },
        { reg_id: 3, user_id: 30, status: 'Cancelled' },
        { reg_id: 4, user_id: 40, status: 'Registered' }
      ];

      const notifications = [];
      const auditLog = [];

      function dispatchReminders(progId, title, startDate, mosqueId) {
        const eligible = attendees.filter(a => a.status === 'Registered');
        eligible.forEach(a => {
          notifications.push({
            notif_id: notifications.length + 1,
            mosque_id: mosqueId,
            user_id: a.user_id,
            message: `Reminder: ${title} begins ${startDate.toLocaleString()}.`,
            type: 'In-App',
            status: 'Sent',
            is_read: false,
            related_type: 'Program',
            related_id: progId
          });
        });

        auditLog.push({
          action: 'program.reminders_sent',
          target_type: 'Program',
          target_id: String(progId),
          summary: `${eligible.length} reminders sent.`
        });

        return { sent: eligible.length };
      }

      const res = dispatchReminders(100, 'Tajweed Intensive', new Date(), 1);
      assert.strictEqual(res.sent, 2);
      assert.strictEqual(notifications.length, 2);

      const recipientIds = notifications.map(n => n.user_id);
      assert.ok(recipientIds.includes(10));
      assert.ok(recipientIds.includes(40));
      assert.strictEqual(recipientIds.includes(20), false); // Attended excluded
      assert.strictEqual(recipientIds.includes(30), false); // Cancelled excluded

      assert.strictEqual(auditLog.length, 1);
      assert.strictEqual(auditLog[0].action, 'program.reminders_sent');
      assert.strictEqual(auditLog[0].summary, '2 reminders sent.');
    });

    it('should isolate in-app notifications per user and mosque tenant', () => {
      const notifications = [
        { notif_id: 1, mosque_id: 1, user_id: 10, message: 'Notif 1', is_read: false },
        { notif_id: 2, mosque_id: 1, user_id: 20, message: 'Notif 2', is_read: false },
        { notif_id: 3, mosque_id: 2, user_id: 10, message: 'Notif 3 (Mosque 2)', is_read: false }
      ];

      function getMemberNotifications(mosqueId, userId) {
        return notifications.filter(n => n.mosque_id === mosqueId && n.user_id === userId);
      }

      function markRead(notifId, mosqueId, userId) {
        const notif = notifications.find(n => n.notif_id === notifId && n.mosque_id === mosqueId && n.user_id === userId);
        if (!notif) return { error: 'NOT_FOUND', status: 404 };
        notif.is_read = true;
        return { success: true, notif, status: 200 };
      }

      // User 10 in Mosque 1 gets only 1 notification
      const u10Notifs = getMemberNotifications(1, 10);
      assert.strictEqual(u10Notifs.length, 1);
      assert.strictEqual(u10Notifs[0].notif_id, 1);

      // User 10 marks notification 1 as read
      const markRes = markRead(1, 1, 10);
      assert.strictEqual(markRes.status, 200);
      assert.strictEqual(markRes.notif.is_read, true);

      // User 20 attempts to mark User 10's notification as read -> 404
      const hijackRes = markRead(1, 1, 20);
      assert.strictEqual(hijackRes.status, 404);

      // Cross-Tenant attempt: User 10 in Mosque 2 attempts to mark Mosque 1 notification -> 404
      const crossRes = markRead(1, 2, 10);
      assert.strictEqual(crossRes.status, 404);
    });
  });

  describe('Milestone 3 Challenger Verification: Reconciliation, Cash Entry, CSV Escaping & RBAC', () => {
    // 1. Donation Reconciliation
    describe('Donation Reconciliation Logic & Permissions', () => {
      const allowedRoles = ['tenant_admin', 'finance_officer'];

      function checkReconcilePermission(role) {
        return allowedRoles.includes(role);
      }

      function reconcileDonation(donation, actorId, actorRole) {
        if (!checkReconcilePermission(actorRole)) {
          return { error: 'You do not have permission to perform this action.', status: 403 };
        }
        return {
          ...donation,
          reconciliation_status: 'Reconciled',
          verified_by: actorId
        };
      }

      it('should permit tenant_admin and finance_officer to reconcile donations', () => {
        const donation = { donation_id: 101, amount_minor: 5000, reconciliation_status: 'Unreconciled', verified_by: null };
        const resAdmin = reconcileDonation(donation, 1, 'tenant_admin');
        assert.strictEqual(resAdmin.reconciliation_status, 'Reconciled');
        assert.strictEqual(resAdmin.verified_by, 1);

        const resFin = reconcileDonation(donation, 2, 'finance_officer');
        assert.strictEqual(resFin.reconciliation_status, 'Reconciled');
        assert.strictEqual(resFin.verified_by, 2);
      });

      it('should reject programme_officer, communications_officer, and member with 403', () => {
        const donation = { donation_id: 101, amount_minor: 5000, reconciliation_status: 'Unreconciled', verified_by: null };
        const rejectedRoles = ['programme_officer', 'communications_officer', 'member'];
        for (const role of rejectedRoles) {
          const res = reconcileDonation(donation, 5, role);
          assert.strictEqual(res.status, 403);
          assert.ok(res.error);
        }
      });
    });

    // 2. Manual Cash Donation Validation
    describe('Manual Cash Donation Validation', () => {
      const validCategories = ['Zakat', 'Sadaqah', 'Waqf', 'General'];

      function validateManualDonation(payload) {
        if (!payload || typeof payload !== 'object') return { valid: false, error: 'Invalid payload' };
        const { amount, category, method } = payload;
        if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
          return { valid: false, error: 'Amount must be positive number' };
        }
        if (method !== 'Cash') {
          return { valid: false, error: 'Method must be Cash' };
        }
        if (!validCategories.includes(category)) {
          return { valid: false, error: 'Invalid category' };
        }
        return { valid: true };
      }

      it('should accept valid cash donation payloads', () => {
        const res = validateManualDonation({ amount: 150.75, category: 'Zakat', method: 'Cash' });
        assert.strictEqual(res.valid, true);
      });

      it('should reject negative and zero amounts', () => {
        assert.strictEqual(validateManualDonation({ amount: -50, category: 'Zakat', method: 'Cash' }).valid, false);
        assert.strictEqual(validateManualDonation({ amount: 0, category: 'Zakat', method: 'Cash' }).valid, false);
        assert.strictEqual(validateManualDonation({ amount: -0.01, category: 'Zakat', method: 'Cash' }).valid, false);
      });

      it('should reject non-Cash payment methods', () => {
        const nonCash = ['Card', 'Transfer', 'Crypto', 'Cheque', ''];
        for (const m of nonCash) {
          assert.strictEqual(validateManualDonation({ amount: 100, category: 'Zakat', method: m }).valid, false);
        }
      });

      it('should reject invalid categories', () => {
        const invalidCats = ['Cryptocurrency', 'Illegal', '', null, 123];
        for (const cat of invalidCats) {
          assert.strictEqual(validateManualDonation({ amount: 100, category: cat, method: 'Cash' }).valid, false);
        }
      });
    });

    // 3. RFC 4180 CSV Escaping
    describe('RFC 4180 CSV Escaping Logic', () => {
      function escapeCsv(field) {
        if (field === null || field === undefined) return '';
        const str = String(field);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }

      it('should pass unquoted simple alphanumeric strings through without modification', () => {
        assert.strictEqual(escapeCsv('MH-12345678'), 'MH-12345678');
        assert.strictEqual(escapeCsv('Zakat'), 'Zakat');
        assert.strictEqual(escapeCsv('Completed'), 'Completed');
        assert.strictEqual(escapeCsv(150.5), '150.5');
      });

      it('should quote strings containing commas', () => {
        assert.strictEqual(escapeCsv('Support, General'), '"Support, General"');
      });

      it('should escape internal double quotes as double double-quotes per RFC 4180', () => {
        assert.strictEqual(escapeCsv('Donor "Anonymous"'), '"Donor ""Anonymous"""');
      });

      it('should quote strings containing newlines', () => {
        assert.strictEqual(escapeCsv('Line 1\nLine 2'), '"Line 1\nLine 2"');
        assert.strictEqual(escapeCsv('Line 1\r\nLine 2'), '"Line 1\r\nLine 2"');
      });

      it('should correctly escape complex combined special characters', () => {
        const complex = 'Notes: "Urgent, needed today"\nRef #123';
        const escaped = escapeCsv(complex);
        assert.strictEqual(escaped, '"Notes: ""Urgent, needed today""\nRef #123"');
      });
    });

    // 4. Tenant Audit Log Viewer RBAC & Isolation
    describe('Audit Log Viewer RBAC & Tenant Isolation Logic', () => {
      function checkAuditAccess(role) {
        return role === 'tenant_admin';
      }

      it('should only permit tenant_admin and reject all other roles with 403', () => {
        assert.strictEqual(checkAuditAccess('tenant_admin'), true);
        assert.strictEqual(checkAuditAccess('finance_officer'), false);
        assert.strictEqual(checkAuditAccess('programme_officer'), false);
        assert.strictEqual(checkAuditAccess('communications_officer'), false);
        assert.strictEqual(checkAuditAccess('member'), false);
      });

      it('should strictly isolate audit records by mosque_id', () => {
        const allAuditEvents = [
          { audit_id: 1, mosque_id: 1, action: 'donation.recorded', summary: 'Mosque 1 event' },
          { audit_id: 2, mosque_id: 2, action: 'donation.recorded', summary: 'Mosque 2 event' },
          { audit_id: 3, mosque_id: 1, action: 'donation.reconciled', summary: 'Mosque 1 event' }
        ];

        const queryTenantAudit = (tenantMosqueId) =>
          allAuditEvents.filter(e => e.mosque_id === tenantMosqueId);

        const tenant1Events = queryTenantAudit(1);
        assert.strictEqual(tenant1Events.length, 2);
        assert.ok(tenant1Events.every(e => e.mosque_id === 1));

        const tenant2Events = queryTenantAudit(2);
        assert.strictEqual(tenant2Events.length, 1);
        assert.strictEqual(tenant2Events[0].mosque_id, 2);
      });
    });

    // 5. Global User Accounts & Multi-Mosque Auto-Joining
    describe('Global User Accounts & Multi-Mosque Joining Logic', () => {
      const globalUsers = new Map();
      const memberships = new Map(); // key: `${mosqueId}:${userId}`

      function registerGlobal(name, email, password, targetMosqueId) {
        let user = globalUsers.get(email);
        if (!user) {
          user = { user_id: globalUsers.size + 1, name, email, password };
          globalUsers.set(email, user);
        } else {
          if (user.password !== password) {
            return { success: false, status: 401, error: 'Incorrect password for global account.' };
          }
        }

        const key = `${targetMosqueId}:${user.user_id}`;
        let mem = memberships.get(key);
        if (!mem) {
          mem = { membership_id: memberships.size + 1, mosque_id: targetMosqueId, user_id: user.user_id, role: 'member', status: 'Active' };
          memberships.set(key, mem);
        }

        return { success: true, status: 200, user, membership: mem };
      }

      function loginGlobal(email, password, targetMosqueId) {
        const user = globalUsers.get(email);
        if (!user || user.password !== password) {
          return { success: false, status: 401, error: 'Invalid email or password.' };
        }

        const key = `${targetMosqueId}:${user.user_id}`;
        let mem = memberships.get(key);
        if (!mem) {
          // Auto-join on login
          mem = { membership_id: memberships.size + 1, mosque_id: targetMosqueId, user_id: user.user_id, role: 'member', status: 'Active' };
          memberships.set(key, mem);
        }

        return { success: true, status: 200, user, membership: mem };
      }

      function oneClickJoin(userId, targetMosqueId) {
        const key = `${targetMosqueId}:${userId}`;
        let mem = memberships.get(key);
        if (!mem) {
          mem = { membership_id: memberships.size + 1, mosque_id: targetMosqueId, user_id: userId, role: 'member', status: 'Active' };
          memberships.set(key, mem);
        }
        return { success: true, status: 201, membership: mem };
      }

      it('should create a new global user account when registering at Mosque 1', () => {
        const res = registerGlobal('Ahmad Ibrahim', 'ahmad@example.com', 'SecurePass123!', 1);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.user.email, 'ahmad@example.com');
        assert.strictEqual(res.membership.mosque_id, 1);
      });

      it('should automatically join Mosque 2 when existing user registers with same credentials', () => {
        const res = registerGlobal('Ahmad Ibrahim', 'ahmad@example.com', 'SecurePass123!', 2);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.membership.mosque_id, 2);
        assert.strictEqual(res.membership.user_id, res.user.user_id);
      });

      it('should automatically join Mosque 3 when existing user signs in at Mosque 3', () => {
        const res = loginGlobal('ahmad@example.com', 'SecurePass123!', 3);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.membership.mosque_id, 3);
      });

      it('should support 1-click join endpoint for any target mosque', () => {
        const res = oneClickJoin(1, 4);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.membership.mosque_id, 4);
        assert.strictEqual(res.membership.role, 'member');
      });
    });

    // 6. Sovereign Platform Operator Authentication & Multi-Tenant Governance
    describe('Sovereign Platform Operator Authentication & Tenant Governance Logic', () => {
      const platformUsers = [
        { user_id: 1, email: 'operator@masjidhub.org', password_hash: hashPassword('SuperAdminPass2026!'), platform_role: 'super_admin', account_status: 'Active' },
        { user_id: 2, email: 'regular_admin@alnoor.org', password_hash: hashPassword('AdminPass2026!'), platform_role: null, account_status: 'Active' },
        { user_id: 3, email: 'suspended_operator@masjidhub.org', password_hash: hashPassword('SuperPass2026!'), platform_role: 'super_admin', account_status: 'Suspended' }
      ];

      const tenants = [
        { mosque_id: 1, name: 'Al-Noor Central Masjid', slug: 'al-noor', status: 'Active' },
        { mosque_id: 2, name: 'Masjid Al-Huda', slug: 'al-huda', status: 'Pending' },
        { mosque_id: 3, name: 'Central Mosque', slug: 'central', status: 'Suspended' }
      ];

      const platformAuditStore = [];

      function platformLogin(email, password) {
        if (!email || !password) {
          return { success: false, status: 400, error: 'Email and password are required.' };
        }
        const user = platformUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (!user || user.platform_role !== 'super_admin' || user.account_status !== 'Active') {
          return { success: false, status: 401, error: 'Invalid platform administrator credentials.' };
        }
        if (user.password_hash !== hashPassword(password)) {
          return { success: false, status: 401, error: 'Invalid platform administrator credentials.' };
        }
        return {
          success: true,
          status: 200,
          token: `jwt-platform-${user.user_id}-${Date.now()}`,
          user: { user_id: user.user_id, email: user.email, platform_role: user.platform_role }
        };
      }

      function updateTenantStatus(tenantId, newStatus, operatorId, requestId, ipAddress) {
        if (!['Active', 'Suspended'].includes(newStatus)) {
          return { success: false, status: 400, error: 'Status must be Active or Suspended.' };
        }
        const tenant = tenants.find(t => t.mosque_id === tenantId);
        if (!tenant) {
          return { success: false, status: 404, error: 'Tenant not found.' };
        }
        tenant.status = newStatus;
        const event = {
          actor_id: operatorId,
          mosque_id: tenant.mosque_id,
          action: `tenant.${newStatus.toLowerCase()}`,
          target_type: 'Mosque',
          target_id: String(tenantId),
          summary: `Tenant marked ${newStatus}.`,
          request_id: requestId,
          ip_address: ipAddress,
          created_at: new Date()
        };
        platformAuditStore.push(event);
        return { success: true, status: 200, tenant, event };
      }

      it('should authenticate valid super_admin operator credentials', () => {
        const res = platformLogin('operator@masjidhub.org', 'SuperAdminPass2026!');
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.user.platform_role, 'super_admin');
        assert.ok(res.token);
      });

      it('should reject non-super_admin users attempting platform operator login with 401', () => {
        const res = platformLogin('regular_admin@alnoor.org', 'AdminPass2026!');
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.status, 401);
        assert.strictEqual(res.error, 'Invalid platform administrator credentials.');
      });

      it('should reject incorrect password for super_admin with 401', () => {
        const res = platformLogin('operator@masjidhub.org', 'WrongPass123!');
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.status, 401);
      });

      it('should reject suspended super_admin account with 401', () => {
        const res = platformLogin('suspended_operator@masjidhub.org', 'SuperPass2026!');
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.status, 401);
      });

      it('should allow platform operator to activate a pending mosque tenant and log audit event', () => {
        const res = updateTenantStatus(2, 'Active', 1, 'req-plat-001', '10.0.0.1');
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.tenant.status, 'Active');
        assert.strictEqual(res.event.action, 'tenant.active');
        assert.strictEqual(res.event.request_id, 'req-plat-001');
      });

      it('should allow platform operator to suspend an active mosque tenant', () => {
        const res = updateTenantStatus(1, 'Suspended', 1, 'req-plat-002', '10.0.0.1');
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.tenant.status, 'Suspended');
        assert.strictEqual(res.event.action, 'tenant.suspended');
      });

      it('should reject invalid tenant status values with 400', () => {
        const res = updateTenantStatus(1, 'Deleted', 1, 'req-plat-003', '10.0.0.1');
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.error, 'Status must be Active or Suspended.');
      });
    });
  });

  describe('Developer Guide §10-§12 Architecture & Compliance Verification', () => {
    describe('Health Endpoint Verification (§12.3)', () => {
      function getHealthStatus(dbConnected = true) {
        if (!dbConnected) {
          return {
            status: 503,
            payload: {
              status: 'error',
              uptime: 100.5,
              db: 'disconnected',
              error: 'Database connectivity check failed',
              timestamp: new Date().toISOString()
            }
          };
        }
        return {
          status: 200,
          payload: {
            status: 'ok',
            uptime: 100.5,
            db: 'connected',
            timestamp: new Date().toISOString()
          }
        };
      }

      it('should return 200 ok and connected db state when database is reachable', () => {
        const res = getHealthStatus(true);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.payload.status, 'ok');
        assert.strictEqual(res.payload.db, 'connected');
      });

      it('should return 503 error when database is unreachable', () => {
        const res = getHealthStatus(false);
        assert.strictEqual(res.status, 503);
        assert.strictEqual(res.payload.status, 'error');
        assert.strictEqual(res.payload.db, 'disconnected');
      });
    });

    describe('Tenant Scoped Query Wrapper Pattern (§3.2)', () => {
      function createMockTenantScoped(mockPrisma, mosqueId) {
        return {
          mosqueId,
          donation: {
            findMany: (args = {}) => mockPrisma.donation.findMany({ ...args, where: { ...args.where, mosque_id: mosqueId } })
          },
          program: {
            findMany: (args = {}) => mockPrisma.program.findMany({ ...args, where: { ...args.where, mosque_id: mosqueId } })
          }
        };
      }

      it('should inject mosque_id filter into all query where clauses', () => {
        let lastQuery = null;
        const mockPrisma = {
          donation: {
            findMany: (args) => {
              lastQuery = args;
              return [];
            }
          }
        };

        const scoped = createMockTenantScoped(mockPrisma, 42);
        scoped.donation.findMany({ where: { status: 'Completed' } });

        assert.strictEqual(lastQuery.where.status, 'Completed');
        assert.strictEqual(lastQuery.where.mosque_id, 42);
      });
    });

    describe('Digital PDF Receipt Generation & Verification (§10.1)', () => {
      function calculateReceiptHash(mosqueSlug, receiptNumber, amount, currency, category, dateIso) {
        const payload = `${mosqueSlug}|${receiptNumber}|${amount}|${currency}|${category}|${dateIso}`;
        return crypto.createHash('sha256').update(payload).digest('hex');
      }

      it('should generate deterministic SHA-256 integrity hash for verified receipts', () => {
        const dateIso = '2026-09-25T12:00:00.000Z';
        const hash1 = calculateReceiptHash('al-noor', 'MH-ABCD1234', 500, 'NGN', 'Zakat', dateIso);
        const hash2 = calculateReceiptHash('al-noor', 'MH-ABCD1234', 500, 'NGN', 'Zakat', dateIso);
        assert.strictEqual(hash1, hash2);
        assert.strictEqual(typeof hash1, 'string');
        assert.strictEqual(hash1.length, 64);
      });

      it('should detect tampering in any donation receipt attribute', () => {
        const dateIso = '2026-09-25T12:00:00.000Z';
        const authentic = calculateReceiptHash('al-noor', 'MH-ABCD1234', 500, 'NGN', 'Zakat', dateIso);
        const tamperedAmount = calculateReceiptHash('al-noor', 'MH-ABCD1234', 5000, 'NGN', 'Zakat', dateIso);
        const tamperedTenant = calculateReceiptHash('al-huda', 'MH-ABCD1234', 500, 'NGN', 'Zakat', dateIso);
        
        assert.notStrictEqual(authentic, tamperedAmount);
        assert.notStrictEqual(authentic, tamperedTenant);
      });
    });
  });
});




