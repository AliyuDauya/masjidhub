-- CreateTable
CREATE TABLE "Mosque" (
    "mosque_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "brand_color" TEXT NOT NULL DEFAULT '#087f5b',
    "logo_url" TEXT,
    "notification_email" BOOLEAN NOT NULL DEFAULT true,
    "notification_in_app" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "user_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "phone" TEXT,
    "account_status" TEXT NOT NULL DEFAULT 'Active',
    "platform_role" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Membership" (
    "membership_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mosque_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "joined_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Membership_mosque_id_fkey" FOREIGN KEY ("mosque_id") REFERENCES "Mosque" ("mosque_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Membership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("user_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Donation" (
    "donation_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mosque_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "amount_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "category" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "external_reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "reconciliation_status" TEXT NOT NULL DEFAULT 'Unreconciled',
    "receipt_number" TEXT NOT NULL,
    "recorded_by" INTEGER,
    "verified_by" INTEGER,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Donation_mosque_id_fkey" FOREIGN KEY ("mosque_id") REFERENCES "Mosque" ("mosque_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Donation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("user_id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Announcement" (
    "announcement_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mosque_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'Public',
    "status" TEXT NOT NULL DEFAULT 'Published',
    "publish_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiry_date" DATETIME,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Announcement_mosque_id_fkey" FOREIGN KEY ("mosque_id") REFERENCES "Mosque" ("mosque_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Announcement_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "User" ("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Program" (
    "program_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mosque_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME NOT NULL,
    "location" TEXT NOT NULL,
    "max_capacity" INTEGER NOT NULL DEFAULT 0,
    "visibility" TEXT NOT NULL DEFAULT 'Public',
    "status" TEXT NOT NULL DEFAULT 'Published',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Program_mosque_id_fkey" FOREIGN KEY ("mosque_id") REFERENCES "Mosque" ("mosque_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Registration" (
    "reg_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mosque_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "program_id" INTEGER NOT NULL,
    "reg_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'Registered',
    "attended_at" DATETIME,
    CONSTRAINT "Registration_mosque_id_fkey" FOREIGN KEY ("mosque_id") REFERENCES "Mosque" ("mosque_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Registration_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("user_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Registration_mosque_id_program_id_fkey" FOREIGN KEY ("mosque_id", "program_id") REFERENCES "Program" ("mosque_id", "program_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "notif_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mosque_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Queued',
    "related_type" TEXT,
    "related_id" INTEGER,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_mosque_id_fkey" FOREIGN KEY ("mosque_id") REFERENCES "Mosque" ("mosque_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("user_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "audit_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mosque_id" INTEGER,
    "actor_id" INTEGER,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "summary" TEXT NOT NULL,
    "request_id" TEXT,
    "ip_address" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_mosque_id_fkey" FOREIGN KEY ("mosque_id") REFERENCES "Mosque" ("mosque_id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User" ("user_id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Mosque_slug_key" ON "Mosque"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Mosque_mosque_id_slug_key" ON "Mosque"("mosque_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Membership_user_id_status_idx" ON "Membership"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_mosque_id_user_id_key" ON "Membership"("mosque_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_receipt_number_key" ON "Donation"("receipt_number");

-- CreateIndex
CREATE INDEX "Donation_mosque_id_date_idx" ON "Donation"("mosque_id", "date");

-- CreateIndex
CREATE INDEX "Donation_mosque_id_status_reconciliation_status_idx" ON "Donation"("mosque_id", "status", "reconciliation_status");

-- CreateIndex
CREATE INDEX "Announcement_mosque_id_status_publish_at_idx" ON "Announcement"("mosque_id", "status", "publish_at");

-- CreateIndex
CREATE INDEX "Program_mosque_id_start_date_idx" ON "Program"("mosque_id", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "Program_mosque_id_program_id_key" ON "Program"("mosque_id", "program_id");

-- CreateIndex
CREATE INDEX "Registration_mosque_id_program_id_status_idx" ON "Registration"("mosque_id", "program_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_mosque_id_user_id_program_id_key" ON "Registration"("mosque_id", "user_id", "program_id");

-- CreateIndex
CREATE INDEX "Notification_mosque_id_user_id_created_at_idx" ON "Notification"("mosque_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "AuditEvent_mosque_id_created_at_idx" ON "AuditEvent"("mosque_id", "created_at");

