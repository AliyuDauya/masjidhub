import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient(
  process.env.DATABASE_URL
    ? { datasources: { db: { url: process.env.DATABASE_URL } } }
    : undefined
);

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Clean existing records in reverse dependency order for idempotency
  await prisma.auditEvent.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.program.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.donation.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.mosque.deleteMany();

  // 2. Pre-hash passwords for performance
  const [adminHash, financeHash, programHash, commsHash, memberHash, platformHash] = await Promise.all([
    bcrypt.hash('adminPass123', 10),
    bcrypt.hash('financePass123', 10),
    bcrypt.hash('programPass123', 10),
    bcrypt.hash('commsPass123', 10),
    bcrypt.hash('memberPass123', 10),
    bcrypt.hash('platformPass123', 10)
  ]);

  // 3. Create Platform Super Admin
  const platformAdmin = await prisma.user.create({
    data: {
      name: 'Platform Administrator',
      email: 'platform@masjidhub.local',
      password_hash: platformHash,
      platform_role: 'super_admin'
    }
  });

  // 4. Create Demo Mosques (3 tenants for full multi-tenant isolation testing)
  const alNoor = await prisma.mosque.create({
    data: {
      name: 'Al-Noor Central Masjid',
      slug: 'al-noor',
      status: 'Active',
      address: '123 Islamic Center Ave, Cityville',
      phone: '+2348031234567',
      email: 'contact@alnoormasjid.org',
      brand_color: '#087f5b',
      timezone: 'Africa/Lagos'
    }
  });

  const alHuda = await prisma.mosque.create({
    data: {
      name: 'Masjid Al-Huda',
      slug: 'al-huda',
      status: 'Active',
      address: '456 Guidance Road, Green Valley',
      phone: '+2348039876543',
      email: 'info@alhuda.org',
      brand_color: '#1d4ed8',
      timezone: 'Africa/Lagos'
    }
  });

  const alIman = await prisma.mosque.create({
    data: {
      name: 'Al-Iman Islamic Center',
      slug: 'al-iman',
      status: 'Active',
      address: '789 Peace Blvd, Lakeside',
      phone: '+2348031122334',
      email: 'admin@aliman.org',
      brand_color: '#7c3aed',
      timezone: 'Africa/Lagos'
    }
  });

  // 5. Create Users representing all 5 roles
  const ahmad = await prisma.user.create({
    data: {
      name: 'Imam Ahmad',
      email: 'ahmad@alnoor.org',
      password_hash: adminHash,
      phone: '+2348055555551'
    }
  });

  const yusuf = await prisma.user.create({
    data: {
      name: 'Imam Yusuf',
      email: 'yusuf@alhuda.org',
      password_hash: adminHash,
      phone: '+2348055555552'
    }
  });

  const omar = await prisma.user.create({
    data: {
      name: 'Imam Omar',
      email: 'omar@aliman.org',
      password_hash: adminHash,
      phone: '+2348055555553'
    }
  });

  const financeOfficer = await prisma.user.create({
    data: {
      name: 'Fatima Finance',
      email: 'finance@alnoor.org',
      password_hash: financeHash,
      phone: '+2348055555554'
    }
  });

  const programOfficer = await prisma.user.create({
    data: {
      name: 'Tariq Programs',
      email: 'programs@alnoor.org',
      password_hash: programHash,
      phone: '+2348055555555'
    }
  });

  const commsOfficer = await prisma.user.create({
    data: {
      name: 'Zainab Comms',
      email: 'comms@alnoor.org',
      password_hash: commsHash,
      phone: '+2348055555556'
    }
  });

  const ali = await prisma.user.create({
    data: {
      name: 'Ali Bello',
      email: 'ali@example.org',
      password_hash: memberHash,
      phone: '+2348055555557'
    }
  });

  const zayd = await prisma.user.create({
    data: {
      name: 'Zayd Ibrahim',
      email: 'zayd@example.org',
      password_hash: memberHash,
      phone: '+2348055555558'
    }
  });

  // 6. Create Memberships mapping all 5 roles across tenants
  await prisma.membership.createMany({
    data: [
      // Al-Noor Memberships (Complete 5-role coverage)
      { mosque_id: alNoor.mosque_id, user_id: ahmad.user_id, role: 'tenant_admin', status: 'Active' },
      { mosque_id: alNoor.mosque_id, user_id: financeOfficer.user_id, role: 'finance_officer', status: 'Active' },
      { mosque_id: alNoor.mosque_id, user_id: programOfficer.user_id, role: 'programme_officer', status: 'Active' },
      { mosque_id: alNoor.mosque_id, user_id: commsOfficer.user_id, role: 'communications_officer', status: 'Active' },
      { mosque_id: alNoor.mosque_id, user_id: ali.user_id, role: 'member', status: 'Active' },
      { mosque_id: alNoor.mosque_id, user_id: zayd.user_id, role: 'member', status: 'Active' },

      // Al-Huda Memberships (Admin + Multi-mosque Member)
      { mosque_id: alHuda.mosque_id, user_id: yusuf.user_id, role: 'tenant_admin', status: 'Active' },
      { mosque_id: alHuda.mosque_id, user_id: ali.user_id, role: 'member', status: 'Active' },

      // Al-Iman Memberships (Admin for Tenant 3)
      { mosque_id: alIman.mosque_id, user_id: omar.user_id, role: 'tenant_admin', status: 'Active' }
    ]
  });

  // 7. Create Announcements
  await prisma.announcement.createMany({
    data: [
      {
        mosque_id: alNoor.mosque_id,
        author_id: ahmad.user_id,
        title: 'Community food drive',
        content: 'Bring shelf-stable food to the collection point before Friday prayer.',
        category: 'Event',
        audience: 'Public',
        status: 'Published'
      },
      {
        mosque_id: alNoor.mosque_id,
        author_id: commsOfficer.user_id,
        title: 'Weekly Tajweed class',
        content: 'The class meets every Saturday after Asr in the learning hall.',
        category: 'Event',
        audience: 'Public',
        status: 'Published'
      },
      {
        mosque_id: alNoor.mosque_id,
        author_id: commsOfficer.user_id,
        title: 'Ramadan Volunteer Orientation',
        content: 'Orientation session for all registered volunteers will take place this Sunday.',
        category: 'General',
        audience: 'Members',
        status: 'Published'
      },
      {
        mosque_id: alHuda.mosque_id,
        author_id: yusuf.user_id,
        title: 'Updated prayer timetable',
        content: 'The new monthly timetable is available from the mosque office.',
        category: 'General',
        audience: 'Public',
        status: 'Published'
      },
      {
        mosque_id: alIman.mosque_id,
        author_id: omar.user_id,
        title: 'Welcome to Al-Iman Center',
        content: 'Daily congregational prayers and weekend learning circles are open to everyone.',
        category: 'General',
        audience: 'Public',
        status: 'Published'
      }
    ]
  });

  // 8. Create Programmes
  const tajweedProg = await prisma.program.create({
    data: {
      mosque_id: alNoor.mosque_id,
      title: 'Foundations of Tajweed',
      description: 'A four-week practical course for adult learners.',
      category: 'General',
      start_date: new Date('2026-09-05T16:00:00Z'),
      end_date: new Date('2026-09-26T18:00:00Z'),
      location: 'Learning Hall',
      max_capacity: 30,
      visibility: 'Public',
      status: 'Published'
    }
  });

  const youthProg = await prisma.program.create({
    data: {
      mosque_id: alNoor.mosque_id,
      title: 'Youth Leadership & Mentorship Workshop',
      description: 'Interactive skills development workshop for teenagers and young adults.',
      category: 'Workshop',
      start_date: new Date('2026-10-10T10:00:00Z'),
      end_date: new Date('2026-10-10T15:00:00Z'),
      location: 'Conference Room B',
      max_capacity: 20,
      visibility: 'Public',
      status: 'Published'
    }
  });

  const healthProg = await prisma.program.create({
    data: {
      mosque_id: alNoor.mosque_id,
      title: 'Community Health & CPR Seminar',
      description: 'Certified basic first aid and emergency response training.',
      category: 'Health',
      start_date: new Date('2026-08-01T09:00:00Z'),
      end_date: new Date('2026-08-01T12:00:00Z'),
      location: 'Main Hall',
      max_capacity: 50,
      visibility: 'Public',
      status: 'Completed'
    }
  });

  const familyProgHuda = await prisma.program.create({
    data: {
      mosque_id: alHuda.mosque_id,
      title: 'Family & Parenting in Islam',
      description: 'Navigating contemporary challenges in Islamic parenting.',
      category: 'Seminar',
      start_date: new Date('2026-09-20T14:00:00Z'),
      end_date: new Date('2026-09-20T17:00:00Z'),
      location: 'Auditorium',
      max_capacity: 40,
      visibility: 'Public',
      status: 'Published'
    }
  });

  // 9. Create Registrations & Attendance
  await prisma.registration.createMany({
    data: [
      {
        mosque_id: alNoor.mosque_id,
        user_id: ali.user_id,
        program_id: tajweedProg.program_id,
        status: 'Registered',
        reg_date: new Date('2026-08-15T10:00:00Z')
      },
      {
        mosque_id: alNoor.mosque_id,
        user_id: zayd.user_id,
        program_id: tajweedProg.program_id,
        status: 'Registered',
        reg_date: new Date('2026-08-15T11:30:00Z')
      },
      {
        mosque_id: alNoor.mosque_id,
        user_id: ali.user_id,
        program_id: healthProg.program_id,
        status: 'Attended',
        attended_at: new Date('2026-08-01T09:15:00Z'),
        reg_date: new Date('2026-07-25T12:00:00Z')
      },
      {
        mosque_id: alHuda.mosque_id,
        user_id: ali.user_id,
        program_id: familyProgHuda.program_id,
        status: 'Registered',
        reg_date: new Date('2026-08-14T09:00:00Z')
      }
    ]
  });

  // 10. Create Donations (Online, Offline Cash, Reconciled, Unreconciled)
  const donation1 = await prisma.donation.create({
    data: {
      mosque_id: alNoor.mosque_id,
      user_id: ali.user_id,
      amount_minor: 2500000, // 25,000 NGN
      currency: 'NGN',
      category: 'Sadaqah',
      method: 'Transfer',
      status: 'Completed',
      reconciliation_status: 'Unreconciled',
      receipt_number: 'MH-SEED-001',
      date: new Date('2026-08-10T11:00:00Z')
    }
  });

  const donation2 = await prisma.donation.create({
    data: {
      mosque_id: alNoor.mosque_id,
      user_id: ali.user_id,
      amount_minor: 10000000, // 100,000 NGN
      currency: 'NGN',
      category: 'Zakat',
      method: 'Card',
      status: 'Completed',
      reconciliation_status: 'Reconciled',
      verified_by: financeOfficer.user_id,
      receipt_number: 'MH-SEED-002',
      date: new Date('2026-08-05T14:30:00Z')
    }
  });

  const donation3 = await prisma.donation.create({
    data: {
      mosque_id: alNoor.mosque_id,
      user_id: zayd.user_id,
      amount_minor: 1500000, // 15,000 NGN
      currency: 'NGN',
      category: 'General',
      method: 'Cash',
      status: 'Completed',
      reconciliation_status: 'Unreconciled',
      recorded_by: financeOfficer.user_id,
      receipt_number: 'MH-SEED-003',
      date: new Date('2026-08-12T16:00:00Z')
    }
  });

  const donation4 = await prisma.donation.create({
    data: {
      mosque_id: alNoor.mosque_id,
      user_id: null, // Anonymous donation
      amount_minor: 5000000, // 50,000 NGN
      currency: 'NGN',
      category: 'Waqf',
      method: 'Transfer',
      status: 'Completed',
      reconciliation_status: 'Unreconciled',
      receipt_number: 'MH-SEED-004',
      date: new Date('2026-08-14T08:45:00Z')
    }
  });

  const donation5 = await prisma.donation.create({
    data: {
      mosque_id: alHuda.mosque_id,
      user_id: ali.user_id,
      amount_minor: 3000000, // 30,000 NGN
      currency: 'NGN',
      category: 'Sadaqah',
      method: 'Card',
      status: 'Completed',
      reconciliation_status: 'Reconciled',
      receipt_number: 'MH-SEED-005',
      date: new Date('2026-08-11T13:15:00Z')
    }
  });

  // 11. Create In-App Notifications
  await prisma.notification.createMany({
    data: [
      {
        mosque_id: alNoor.mosque_id,
        user_id: ali.user_id,
        message: 'Welcome to Al-Noor Central Masjid! Your membership is active.',
        type: 'In-App',
        status: 'Sent',
        is_read: true,
        created_at: new Date('2026-08-01T10:00:00Z'),
        sent_at: new Date('2026-08-01T10:00:00Z')
      },
      {
        mosque_id: alNoor.mosque_id,
        user_id: ali.user_id,
        message: 'Reminder: Foundations of Tajweed starts Saturday at 16:00.',
        type: 'In-App',
        status: 'Sent',
        is_read: false,
        related_type: 'Program',
        related_id: tajweedProg.program_id,
        created_at: new Date('2026-08-15T09:00:00Z'),
        sent_at: new Date('2026-08-15T09:00:00Z')
      },
      {
        mosque_id: alNoor.mosque_id,
        user_id: ali.user_id,
        message: 'Donation receipt MH-SEED-001 has been issued for your Sadaqah contribution.',
        type: 'In-App',
        status: 'Sent',
        is_read: false,
        related_type: 'Donation',
        related_id: donation1.donation_id,
        created_at: new Date('2026-08-10T11:05:00Z'),
        sent_at: new Date('2026-08-10T11:05:00Z')
      },
      {
        mosque_id: alNoor.mosque_id,
        user_id: financeOfficer.user_id,
        message: 'New offline cash donation (MH-SEED-003) recorded and ready for reconciliation.',
        type: 'In-App',
        status: 'Sent',
        is_read: false,
        related_type: 'Donation',
        related_id: donation3.donation_id,
        created_at: new Date('2026-08-12T16:05:00Z'),
        sent_at: new Date('2026-08-12T16:05:00Z')
      },
      {
        mosque_id: alHuda.mosque_id,
        user_id: ali.user_id,
        message: 'Your registration for Family & Parenting in Islam is confirmed.',
        type: 'In-App',
        status: 'Sent',
        is_read: false,
        related_type: 'Program',
        related_id: familyProgHuda.program_id,
        created_at: new Date('2026-08-14T09:05:00Z'),
        sent_at: new Date('2026-08-14T09:05:00Z')
      }
    ]
  });

  // 12. Create Structured Audit Events
  await prisma.auditEvent.createMany({
    data: [
      {
        actor_id: platformAdmin.user_id,
        action: 'seed.completed',
        target_type: 'Platform',
        summary: 'Demonstration environment seeded with 5-role coverage across 3 tenants.',
        created_at: new Date('2026-08-16T12:00:00Z')
      },
      {
        mosque_id: alNoor.mosque_id,
        actor_id: ahmad.user_id,
        action: 'program.created',
        target_type: 'Program',
        target_id: String(tajweedProg.program_id),
        summary: 'Foundations of Tajweed programme created.',
        created_at: new Date('2026-08-02T10:00:00Z')
      },
      {
        mosque_id: alNoor.mosque_id,
        actor_id: financeOfficer.user_id,
        action: 'donation.recorded',
        target_type: 'Donation',
        target_id: String(donation3.donation_id),
        summary: 'Offline cash donation MH-SEED-003 recorded.',
        created_at: new Date('2026-08-12T16:00:00Z')
      },
      {
        mosque_id: alNoor.mosque_id,
        actor_id: financeOfficer.user_id,
        action: 'donation.reconciled',
        target_type: 'Donation',
        target_id: String(donation2.donation_id),
        summary: 'Donation MH-SEED-002 marked as reconciled.',
        created_at: new Date('2026-08-06T09:00:00Z')
      },
      {
        mosque_id: alNoor.mosque_id,
        actor_id: commsOfficer.user_id,
        action: 'announcement.created',
        target_type: 'Announcement',
        summary: 'Announcement published.',
        created_at: new Date('2026-08-03T11:00:00Z')
      },
      {
        mosque_id: alNoor.mosque_id,
        actor_id: programOfficer.user_id,
        action: 'attendance.recorded',
        target_type: 'Registration',
        summary: 'Programme attendance recorded for Ali Bello.',
        created_at: new Date('2026-08-01T09:20:00Z')
      }
    ]
  });

  console.log('✅ Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
