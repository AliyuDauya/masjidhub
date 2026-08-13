import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient(
  process.env.DATABASE_URL
    ? { datasources: { db: { url: process.env.DATABASE_URL } } }
    : undefined
);

async function main() {
  await prisma.auditEvent.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.program.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.donation.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.mosque.deleteMany();

  const [adminHash, memberHash, platformHash] = await Promise.all([
    bcrypt.hash('adminPass123', 12), bcrypt.hash('memberPass123', 12), bcrypt.hash('platformPass123', 12)
  ]);
  const platformAdmin = await prisma.user.create({ data: { name: 'Platform Administrator', email: 'platform@masjidhub.local', password_hash: platformHash, platform_role: 'super_admin' } });
  const alNoor = await prisma.mosque.create({ data: { name: 'Al-Noor Central Masjid', slug: 'al-noor', status: 'Active', address: '123 Islamic Center Ave, Cityville', phone: '+2348031234567', email: 'contact@alnoormasjid.org' } });
  const alHuda = await prisma.mosque.create({ data: { name: 'Masjid Al-Huda', slug: 'al-huda', status: 'Active', address: '456 Guidance Road, Green Valley', phone: '+2348039876543', email: 'info@alhuda.org', brand_color: '#1d4ed8' } });

  const ahmad = await prisma.user.create({ data: { name: 'Imam Ahmad', email: 'ahmad@alnoor.org', password_hash: adminHash, phone: '+2348055555551' } });
  const ali = await prisma.user.create({ data: { name: 'Ali Bello', email: 'ali@example.org', password_hash: memberHash, phone: '+2348055555552' } });
  const yusuf = await prisma.user.create({ data: { name: 'Imam Yusuf', email: 'yusuf@alhuda.org', password_hash: adminHash } });
  await prisma.membership.createMany({ data: [
    { mosque_id: alNoor.mosque_id, user_id: ahmad.user_id, role: 'tenant_admin' },
    { mosque_id: alNoor.mosque_id, user_id: ali.user_id, role: 'member' },
    { mosque_id: alHuda.mosque_id, user_id: yusuf.user_id, role: 'tenant_admin' },
    { mosque_id: alHuda.mosque_id, user_id: ali.user_id, role: 'member' }
  ] });

  await prisma.announcement.createMany({ data: [
    { mosque_id: alNoor.mosque_id, author_id: ahmad.user_id, title: 'Community food drive', content: 'Bring shelf-stable food to the collection point before Friday prayer.', category: 'Event', audience: 'Public' },
    { mosque_id: alNoor.mosque_id, author_id: ahmad.user_id, title: 'Weekly Tajweed class', content: 'The class meets every Saturday after Asr in the learning hall.', category: 'Event', audience: 'Public' },
    { mosque_id: alHuda.mosque_id, author_id: yusuf.user_id, title: 'Updated prayer timetable', content: 'The new monthly timetable is available from the mosque office.', category: 'General', audience: 'Public' }
  ] });
  const programme = await prisma.program.create({ data: { mosque_id: alNoor.mosque_id, title: 'Foundations of Tajweed', description: 'A four-week practical course for adult learners.', start_date: new Date('2026-09-05T16:00:00Z'), end_date: new Date('2026-09-26T18:00:00Z'), location: 'Learning Hall', max_capacity: 30 } });
  await prisma.registration.create({ data: { mosque_id: alNoor.mosque_id, user_id: ali.user_id, program_id: programme.program_id } });
  await prisma.donation.create({ data: { mosque_id: alNoor.mosque_id, user_id: ali.user_id, amount_minor: 2500000, currency: 'NGN', category: 'Sadaqah', method: 'Transfer', status: 'Completed', receipt_number: 'MH-SEED-001' } });
  await prisma.auditEvent.create({ data: { actor_id: platformAdmin.user_id, action: 'seed.completed', target_type: 'Platform', summary: 'Demonstration environment seeded.' } });
}

main().finally(() => prisma.$disconnect());
