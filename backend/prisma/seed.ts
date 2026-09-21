import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

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

  // 2. Pre-hash passwords
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

  // 4. Create Demo Mosques
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

  // 5. Create Users
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

  // 6. Create Memberships
  await prisma.membership.createMany({
    data: [
      { mosque_id: alNoor.mosque_id, user_id: ahmad.user_id, role: 'tenant_admin', status: 'Active' },
      { mosque_id: alNoor.mosque_id, user_id: financeOfficer.user_id, role: 'finance_officer', status: 'Active' },
      { mosque_id: alNoor.mosque_id, user_id: programOfficer.user_id, role: 'programme_officer', status: 'Active' },
      { mosque_id: alNoor.mosque_id, user_id: commsOfficer.user_id, role: 'communications_officer', status: 'Active' },
      { mosque_id: alNoor.mosque_id, user_id: ali.user_id, role: 'member', status: 'Active' },
      { mosque_id: alNoor.mosque_id, user_id: zayd.user_id, role: 'member', status: 'Active' },
      { mosque_id: alHuda.mosque_id, user_id: yusuf.user_id, role: 'tenant_admin', status: 'Active' },
      { mosque_id: alHuda.mosque_id, user_id: ali.user_id, role: 'member', status: 'Active' },
      { mosque_id: alIman.mosque_id, user_id: omar.user_id, role: 'tenant_admin', status: 'Active' }
    ]
  });

  // 7. Create Announcements
  await prisma.announcement.createMany({
    data: [
      {
        mosque_id: alNoor.mosque_id,
        author_id: ahmad.user_id,
        title: 'Community Food Drive',
        content: 'Bring shelf-stable food to the collection point before Friday prayer.',
        category: 'Event',
        audience: 'Public',
        status: 'Published'
      },
      {
        mosque_id: alNoor.mosque_id,
        author_id: commsOfficer.user_id,
        title: 'Weekly Tajweed Class',
        content: 'The class meets every Saturday after Asr in the learning hall.',
        category: 'Event',
        audience: 'Public',
        status: 'Published'
      },
      {
        mosque_id: alHuda.mosque_id,
        author_id: yusuf.user_id,
        title: 'Updated Prayer Timetable',
        content: 'The new monthly timetable is available from the mosque office.',
        category: 'General',
        audience: 'Public',
        status: 'Published'
      }
    ]
  });

  // 8. Create Programs
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

  // 9. Create Registrations
  await prisma.registration.createMany({
    data: [
      {
        mosque_id: alNoor.mosque_id,
        user_id: ali.user_id,
        program_id: tajweedProg.program_id,
        status: 'Registered'
      },
      {
        mosque_id: alNoor.mosque_id,
        user_id: zayd.user_id,
        program_id: tajweedProg.program_id,
        status: 'Registered'
      },
      {
        mosque_id: alHuda.mosque_id,
        user_id: ali.user_id,
        program_id: familyProgHuda.program_id,
        status: 'Registered'
      }
    ]
  });

  // 10. Create Donations
  const donation1 = await prisma.donation.create({
    data: {
      mosque_id: alNoor.mosque_id,
      user_id: ali.user_id,
      amount_minor: 2500000,
      currency: 'NGN',
      category: 'Sadaqah',
      method: 'Transfer',
      status: 'Completed',
      reconciliation_status: 'Unreconciled',
      receipt_number: 'MH-SEED-001'
    }
  });

  const donation2 = await prisma.donation.create({
    data: {
      mosque_id: alNoor.mosque_id,
      user_id: ali.user_id,
      amount_minor: 10000000,
      currency: 'NGN',
      category: 'Zakat',
      method: 'Card',
      status: 'Completed',
      reconciliation_status: 'Reconciled',
      receipt_number: 'MH-SEED-002'
    }
  });

  await prisma.donation.create({
    data: {
      mosque_id: alHuda.mosque_id,
      user_id: ali.user_id,
      amount_minor: 3000000,
      currency: 'NGN',
      category: 'Sadaqah',
      method: 'Card',
      status: 'Completed',
      reconciliation_status: 'Reconciled',
      receipt_number: 'MH-SEED-003'
    }
  });

  // 11. Create Notifications
  await prisma.notification.createMany({
    data: [
      {
        mosque_id: alNoor.mosque_id,
        user_id: ali.user_id,
        message: 'Welcome to Al-Noor Central Masjid! Your membership is active.',
        type: 'In-App',
        status: 'Sent',
        is_read: true
      },
      {
        mosque_id: alNoor.mosque_id,
        user_id: ali.user_id,
        message: 'Reminder: Foundations of Tajweed starts Saturday at 16:00.',
        type: 'In-App',
        status: 'Sent',
        is_read: false
      }
    ]
  });

  // 12. Create Audit Events
  await prisma.auditEvent.createMany({
    data: [
      {
        actor_id: platformAdmin.user_id,
        action: 'seed.completed',
        target_type: 'Platform',
        summary: 'Demonstration environment seeded with 3 tenants.'
      },
      {
        mosque_id: alNoor.mosque_id,
        actor_id: ahmad.user_id,
        action: 'program.created',
        target_type: 'Program',
        target_id: String(tajweedProg.program_id),
        summary: 'Foundations of Tajweed programme created.'
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
