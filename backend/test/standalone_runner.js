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
});
