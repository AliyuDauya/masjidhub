# MasjidHub — Multi-Tenant Administrative Platform for Mosques

MasjidHub is a full-stack, multi-tenant administrative ecosystem designed for managing mosques, prayer times, announcements, programs/courses, member registrations, online/cash donations, and admin analytics dashboards.

---

## 🏗️ Tech Stack

- **Backend**: Node.js, Fastify, Prisma ORM, SQLite (`masjidhub.db`), `@fastify/jwt`, `bcryptjs`.
- **Frontend**: Next.js (App Router), React 19, Tailwind CSS v4, Vanilla CSS Design System.
- **Database**: SQLite with Prisma models (`Mosque`, `User`, `Announcement`, `Program`, `Registration`, `Donation`, `Notification`).

---

## 📁 Repository Structure

```
masjidhub/
├── package.json              # Monorepo root scripts
├── backend/                  # Fastify REST API Server
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema
│   │   ├── seed.ts          # Database seed script
│   │   └── masjidhub.db     # SQLite database
│   ├── src/
│   │   ├── middleware/      # Tenant context hook (tenantHook.ts)
│   │   ├── plugins/         # Database & JWT auth plugins
│   │   ├── routes/          # REST API route handlers
│   │   └── server.ts        # Fastify app builder & server listener
│   └── test/                # Backend unit & integration test suites
└── frontend/                 # Next.js Web Portal
    ├── src/app/
    │   ├── page.tsx         # Global landing page & mosque search/onboarding
    │   └── mosque/[slug]/   # Dynamic tenant portal routes
    │       ├── page.tsx     # Public portal (prayer times, feed, quick actions)
    │       ├── login/       # Tenant login page
    │       ├── register/    # Member registration page
    │       ├── donations/   # Online donation checkout
    │       ├── programs/    # Religious programs calendar & seat booking
    │       └── admin/       # Admin console & analytics dashboard
    └── __tests__/           # Frontend test suites
```

---

## ⚡ Quick Start

### 1. Run All Tests
Execute backend and frontend test suites from the root directory:
```bash
npm test
```

### 2. Database Seeding
Re-seed the SQLite database with initial mosques (`al-noor`, `al-huda`), admin/member users, and announcements:
```bash
npm run db:seed
```

### 3. Run Development Servers
- **Backend API** (http://localhost:5000):
  ```bash
  npm run dev:backend
  ```
- **Frontend App** (http://localhost:3000):
  ```bash
  npm run dev:frontend
  ```

---

## 🔐 Multi-Tenant Architecture

All tenant-scoped API requests enforce isolation using the `X-Mosque-Slug` HTTP header or route parameters:
```http
GET /api/announcements HTTP/1.1
Host: localhost:5000
X-Mosque-Slug: al-noor
```
- Multi-tenant JWT payloads embed `{ user_id, mosque_id, role }` to prevent cross-tenant data access.

---

## 📄 License
ISC License.
