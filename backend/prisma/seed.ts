import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // Clean existing tables (Order matters due to foreign key cascades)
  await prisma.notification.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.program.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.donation.deleteMany();
  await prisma.user.deleteMany();
  await prisma.mosque.deleteMany();

  // 1. Create Mosque Tenants
  const mosqueAlNoor = await prisma.mosque.create({
    data: {
      name: 'Al-Noor Central Masjid',
      slug: 'al-noor',
      address: '123 Islamic Center Ave, Cityville',
      phone: '+2348031234567',
      email: 'contact@alnoormasjid.org'
    }
  });

  const mosqueAlHuda = await prisma.mosque.create({
    data: {
      name: 'Masjid Al-Huda',
      slug: 'al-huda',
      address: '456 Guidance Road, Green Valley',
      phone: '+2348039876543',
      email: 'info@alhuda.org'
    }
  });

  console.log('Seeded Mosques.');

  // 2. Create Users (Admins and Members)
  const hashedAdminPassword = await bcrypt.hash('adminPass123', 10);
  const hashedMemberPassword = await bcrypt.hash('memberPass123', 10);

  // Al-Noor Users
  const adminAlNoor = await prisma.user.create({
    data: {
      mosque_id: mosqueAlNoor.mosque_id,
      name: 'Imam Ahmad',
      email: 'ahmad@alnoor.org',
      password_hash: hashedAdminPassword,
      role: 'admin',
      phone: '+2348055555551'
    }
  });

  const memberAlNoor = await prisma.user.create({
    data: {
      mosque_id: mosqueAlNoor.mosque_id,
      name: 'Ali Bello',
      email: 'ali@alnoor.org',
      password_hash: hashedMemberPassword,
      role: 'member',
      phone: '+2348055555552'
    }
  });

  // Al-Huda Users
  const adminAlHuda = await prisma.user.create({
    data: {
      mosque_id: mosqueAlHuda.mosque_id,
      name: 'Imam Yusuf',
      email: 'yusuf@alhuda.org',
      password_hash: hashedAdminPassword,
      role: 'admin',
      phone: '+2348055555553'
    }
  });

  console.log('Seeded Users.');

  // 3. Seed Announcements
  await prisma.announcement.createMany({
    data: [
      {
        mosque_id: mosqueAlNoor.mosque_id,
        admin_id: adminAlNoor.user_id,
        title: 'Ramadan 2026 Announcement',
        content: 'Taraweeh prayers will begin tonight immediately after Isha prayers at 8:45 PM.',
        category: 'Urgent',
        posted_at: new Date()
      },
      {
        mosque_id: mosqueAlNoor.mosque_id,
        admin_id: adminAlNoor.user_id,
        title: 'Weekly Tajweed Class',
        content: 'Join our Tajweed lessons every Saturday after Asr prayer in the main hall.',
        category: 'Event',
        posted_at: new Date()
      },
      {
        mosque_id: mosqueAlHuda.mosque_id,
        admin_id: adminAlHuda.user_id,
        title: 'New Prayer Times Configured',
        content: 'Please view the homepage for the updated prayer timetables for this month.',
        category: 'General',
        posted_at: new Date()
      }
    ]
  });

  console.log('Seeded Announcements.');
  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
