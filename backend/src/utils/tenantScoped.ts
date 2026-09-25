import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Tenant-scoped Prisma wrapper guaranteeing strict tenant isolation
 * per Developer Guide §3.2.
 */
export function createTenantScopedPrisma(prisma: PrismaClient, mosqueId: number) {
  return {
    mosqueId,
    donation: {
      findMany: (args?: Prisma.DonationFindManyArgs) =>
        prisma.donation.findMany({ ...args, where: { ...args?.where, mosque_id: mosqueId } }),
      findFirst: (args?: Prisma.DonationFindFirstArgs) =>
        prisma.donation.findFirst({ ...args, where: { ...args?.where, mosque_id: mosqueId } }),
      count: (args?: Prisma.DonationCountArgs) =>
        prisma.donation.count({ ...args, where: { ...args?.where, mosque_id: mosqueId } })
    },
    announcement: {
      findMany: (args?: Prisma.AnnouncementFindManyArgs) =>
        prisma.announcement.findMany({ ...args, where: { ...args?.where, mosque_id: mosqueId } }),
      findFirst: (args?: Prisma.AnnouncementFindFirstArgs) =>
        prisma.announcement.findFirst({ ...args, where: { ...args?.where, mosque_id: mosqueId } }),
      count: (args?: Prisma.AnnouncementCountArgs) =>
        prisma.announcement.count({ ...args, where: { ...args?.where, mosque_id: mosqueId } })
    },
    program: {
      findMany: (args?: Prisma.ProgramFindManyArgs) =>
        prisma.program.findMany({ ...args, where: { ...args?.where, mosque_id: mosqueId } }),
      findFirst: (args?: Prisma.ProgramFindFirstArgs) =>
        prisma.program.findFirst({ ...args, where: { ...args?.where, mosque_id: mosqueId } }),
      count: (args?: Prisma.ProgramCountArgs) =>
        prisma.program.count({ ...args, where: { ...args?.where, mosque_id: mosqueId } })
    },
    registration: {
      findMany: (args?: Prisma.RegistrationFindManyArgs) =>
        prisma.registration.findMany({ ...args, where: { ...args?.where, mosque_id: mosqueId } }),
      findFirst: (args?: Prisma.RegistrationFindFirstArgs) =>
        prisma.registration.findFirst({ ...args, where: { ...args?.where, mosque_id: mosqueId } }),
      count: (args?: Prisma.RegistrationCountArgs) =>
        prisma.registration.count({ ...args, where: { ...args?.where, mosque_id: mosqueId } })
    },
    notification: {
      findMany: (args?: Prisma.NotificationFindManyArgs) =>
        prisma.notification.findMany({ ...args, where: { ...args?.where, mosque_id: mosqueId } }),
      findFirst: (args?: Prisma.NotificationFindFirstArgs) =>
        prisma.notification.findFirst({ ...args, where: { ...args?.where, mosque_id: mosqueId } }),
      count: (args?: Prisma.NotificationCountArgs) =>
        prisma.notification.count({ ...args, where: { ...args?.where, mosque_id: mosqueId } })
    },
    auditEvent: {
      findMany: (args?: Prisma.AuditEventFindManyArgs) =>
        prisma.auditEvent.findMany({ ...args, where: { ...args?.where, mosque_id: mosqueId } }),
      findFirst: (args?: Prisma.AuditEventFindFirstArgs) =>
        prisma.auditEvent.findFirst({ ...args, where: { ...args?.where, mosque_id: mosqueId } }),
      count: (args?: Prisma.AuditEventCountArgs) =>
        prisma.auditEvent.count({ ...args, where: { ...args?.where, mosque_id: mosqueId } })
    }
  };
}

export type TenantScopedPrisma = ReturnType<typeof createTenantScopedPrisma>;
