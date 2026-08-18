# Milestone 2 Explorer 2 Handoff Report: Strict CORS & Centralized Request Validation Schemas

## 1. Observation

Direct code analysis of the backend and frontend configurations identified key vulnerabilities and opportunities for hardening:

### Current CORS Configuration (`backend/src/server.ts`)
```typescript
// backend/src/server.ts:24-27
// Enable CORS
server.register(cors, {
  origin: process.env.CORS_ORIGIN || '*',
});
```
- **Finding 1.1**: The CORS plugin is registered with a wildcard fallback (`'*'`) and lacks `credentials: true`. Under RFC 6454 and the Fetch specification, browsers automatically reject credentialed requests (cookies like `mh_session`, authorization headers) when the response header `Access-Control-Allow-Origin` is `'*'`.
- **Finding 1.2**: Explicit allowed headers (`X-Mosque-Slug`, `X-CSRF-Token`, `Authorization`, `Content-Type`, `Cookie`) and allowed methods (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`) are omitted, leaving header acceptance non-deterministic across reverse proxies and browsers.

### Current Route Input Validation (`backend/src/routes/*.ts`)
- **Finding 1.3**: Routes in `backend/src/routes/` rely on inconsistent manual checks:
  - `backend/src/routes/auth.ts:23-30`: Manual string checks `if (!name?.trim() || !email?.trim() || !password)`.
  - `backend/src/routes/donations.ts:19-21`: Manual checks `if (!Number.isFinite(amount) || amount <= 0)`.
  - `backend/src/routes/programs.ts:37-40, 71-74`: Manual `isNaN(programId)` and property presence checks.
  - `backend/src/routes/announcements.ts:56-65`: Hardcoded array check `const categories = ['General', 'Event', 'Prayer', 'Urgent']`.
  - `backend/src/routes/memberships.ts:18-19, 33-34`: Inline validation against `roles` array.
- **Finding 1.4**: No JSON schemas are currently registered with Fastify route options (`schema: { body, params, querystring }`). As a result:
  - Fastify cannot leverage its compiled Ajv engine for high-performance schema validation.
  - Unsanitized fields are not stripped or validated at the gateway level.
  - Route param coercion is not enforced automatically.

### Error Response Contract (`frontend/src/lib/api.ts`)
```typescript
// frontend/src/lib/api.ts:20
if (!response.ok) throw new ApiError(typeof data === 'object' && data?.error ? data.error : 'Request failed.', response.status);
```
- **Finding 1.5**: The frontend API client and existing backend test suites expect error responses to contain an `{ error: string }` property on HTTP 400/401/403/404/409.

---

## 2. Logic Chain

### 2.1 Strict CORS Architecture
1. **Dynamic Origin Resolution**: When `credentials: true` is enabled, `Access-Control-Allow-Origin` must dynamically reflect the requesting origin if and only if that origin is explicitly whitelisted.
2. **Environment & Local Resolution**:
   - Default allowed origins: `http://localhost:3000`, `http://127.0.0.1:3000`, `http://localhost:5000`, `http://127.0.0.1:5000`.
   - Production origins: Parse comma-separated list from `process.env.CORS_ORIGIN` (e.g. `https://masjidhub.org,https://app.masjidhub.org`).
   - Server-to-server / curl / test requests without an `Origin` header (`!origin`) are allowed to proceed without CORS headers.
   - Non-whitelisted browser origins are rejected (CORS headers omitted or rejected).
3. **Credentials & Headers Configuration**:
   - `credentials: true`
   - `allowedHeaders`: `['Content-Type', 'Authorization', 'X-Mosque-Slug', 'x-mosque-slug', 'X-CSRF-Token', 'x-csrf-token', 'Cookie', 'Accept', 'Origin']`
   - `exposedHeaders`: `['Set-Cookie', 'X-CSRF-Token']`
   - `methods`: `['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']`
   - `maxAge`: `86400` (24h preflight cache)

### 2.2 Centralized Request Validation Architecture
1. **Directory Structure**: Create a dedicated `backend/src/schemas/` module with granular schema definitions per domain and a unified barrel export (`backend/src/schemas/index.ts`).
2. **Validation Rules**:
   - **Auth**: `name` (2-100 chars), `email` (valid email format/pattern), `password` (min 8 chars), `slug` (alphanumeric with hyphens), `role` (allowed in register body, downgraded to `'member'`).
   - **Donations**: `amount` (number > 0), `category` (enum: `Zakat`, `Sadaqah`, `Waqf`, `General`), `method` (`Card`, `Transfer` for web; `Cash` for manual admin entry), `reconciliation_status` (enum).
   - **Programs**: `title` (2-200 chars), `description`, `start_date`/`end_date` (ISO strings), `location`, `max_capacity` (integer >= 0), `visibility` (enum), `status` (enum).
   - **Registrations**: `id` (integer >= 1), `status` (enum: `Attended`, `Registered`, `Cancelled`).
   - **Announcements**: `title`, `content`, `category` (enum), `audience` (enum), `status` (enum), `publish_at`, `expiry_date` (nullable ISO string).
   - **Memberships**: `name`, `email`, `role` (5-role enum), `temporary_password` (min 8 chars), `status` (enum: `Active`, `Suspended`).
   - **Mosques**: `name`, `slug` (regex `^[a-zA-Z0-9-]+$`), admin credentials, timezone, `brand_color` (hex color code `^#[0-9a-fA-F]{6}$`), notification toggles.
   - **Platform**: Platform admin credentials, tenant status enum (`Active`, `Suspended`).
3. **Ajv Error Formatting**:
   - Register a Fastify error handler in `backend/src/server.ts` that catches `error.validation` and produces a standardized response:
     ```json
     {
       "statusCode": 400,
       "error": "body/email must match format \"email\"",
       "message": "body/email must match format \"email\"",
       "details": [ ... ]
     }
     ```
   - This satisfies the frontend `data?.error` expectation, Fastify standard schema contracts, and test assertions.

---

## 3. Caveats

1. **Cross-Origin Cookie Restrictions (SameSite=Lax vs None)**:
   In development, when frontend is on `http://localhost:3000` and backend is on `http://localhost:5000`, `SameSite=Lax` cookies are sent across top-level navigations and same-site subrequests. For cross-site production deployments under different top-level domains, cookies require `SameSite=None; Secure`. In standard deployment where frontend and backend share the parent domain (e.g. `api.masjidhub.org` and `app.masjidhub.org`), `SameSite=Lax` works reliably.
2. **Registration Body Role Sanitization**:
   Public registration (`POST /api/auth/register`) schema must permit the `role` property in `properties` (so payloads containing `role: 'tenant_admin'` from adversarial tests do not fail schema validation), while backend route logic strictly enforces `role: 'member'`.
3. **Param Type Coercion**:
   Fastify Ajv automatically coerces route params (`:id`) to integers when `type: 'integer'` is specified. Route handlers can safely use `Number(request.params.id)` or receive coerced numbers.

---

## 4. Conclusion & Ready Implementation Code

### 4.1 Schema Files Specification (`backend/src/schemas/`)

#### A. `backend/src/schemas/common.schema.ts`
```typescript
export const idParamSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'integer', minimum: 1 }
  }
} as const;

export const slugParamSchema = {
  type: 'object',
  required: ['slug'],
  properties: {
    slug: { type: 'string', minLength: 1, maxLength: 100, pattern: '^[a-zA-Z0-9-]+$' }
  }
} as const;

export const errorResponseSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'integer' },
    error: { type: 'string' },
    message: { type: 'string' }
  }
} as const;
```

#### B. `backend/src/schemas/auth.schema.ts`
```typescript
export const registerSchema = {
  body: {
    type: 'object',
    required: ['name', 'email', 'password'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 100 },
      email: { type: 'string', minLength: 5, maxLength: 255 },
      password: { type: 'string', minLength: 8, maxLength: 128 },
      phone: { type: 'string', minLength: 5, maxLength: 30 },
      role: { type: 'string' }
    },
    additionalProperties: false
  }
} as const;

export const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', minLength: 1, maxLength: 255 },
      password: { type: 'string', minLength: 1, maxLength: 128 }
    },
    additionalProperties: false
  }
} as const;

export const switchTenantSchema = {
  params: {
    type: 'object',
    required: ['slug'],
    properties: {
      slug: { type: 'string', minLength: 1, maxLength: 100, pattern: '^[a-zA-Z0-9-]+$' }
    }
  }
} as const;
```

#### C. `backend/src/schemas/donations.schema.ts`
```typescript
export const createDonationSchema = {
  body: {
    type: 'object',
    required: ['amount', 'category', 'method'],
    properties: {
      amount: { type: 'number', minimum: 0.01 },
      category: { type: 'string', enum: ['Zakat', 'Sadaqah', 'Waqf', 'General'] },
      method: { type: 'string', enum: ['Card', 'Transfer'] },
      currency: { type: 'string', minLength: 3, maxLength: 3 },
      external_reference: { type: 'string', maxLength: 100 },
      donor_email: { type: 'string', maxLength: 255 }
    },
    additionalProperties: false
  }
} as const;

export const manualDonationSchema = {
  body: {
    type: 'object',
    required: ['amount', 'category', 'method'],
    properties: {
      amount: { type: 'number', minimum: 0.01 },
      category: { type: 'string', enum: ['Zakat', 'Sadaqah', 'Waqf', 'General'] },
      method: { type: 'string', enum: ['Cash'] },
      currency: { type: 'string', minLength: 3, maxLength: 3 },
      donor_email: { type: 'string', maxLength: 255 },
      external_reference: { type: 'string', maxLength: 100 }
    },
    additionalProperties: false
  }
} as const;

export const queryDonationsSchema = {
  querystring: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['Pending', 'Completed', 'Failed'] },
      category: { type: 'string', enum: ['Zakat', 'Sadaqah', 'Waqf', 'General'] },
      reconciliation_status: { type: 'string', enum: ['Unreconciled', 'Reconciled'] },
      search: { type: 'string', maxLength: 100 }
    },
    additionalProperties: false
  }
} as const;

export const reconcileDonationSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer', minimum: 1 }
    }
  }
} as const;
```

#### D. `backend/src/schemas/programs.schema.ts`
```typescript
export const createProgramSchema = {
  body: {
    type: 'object',
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
  }
} as const;

export const updateProgramSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer', minimum: 1 }
    }
  },
  body: {
    type: 'object',
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
  }
} as const;

export const programIdParamSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer', minimum: 1 }
    }
  }
} as const;
```

#### E. `backend/src/schemas/registrations.schema.ts`
```typescript
export const registrationProgramParamSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer', minimum: 1 }
    }
  }
} as const;

export const attendanceCheckInSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer', minimum: 1 }
    }
  },
  body: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['Attended', 'Registered', 'Cancelled'] }
    },
    additionalProperties: false
  }
} as const;
```

#### F. `backend/src/schemas/announcements.schema.ts`
```typescript
export const createAnnouncementSchema = {
  body: {
    type: 'object',
    required: ['title', 'content', 'category'],
    properties: {
      title: { type: 'string', minLength: 2, maxLength: 200 },
      content: { type: 'string', minLength: 1 },
      category: { type: 'string', enum: ['General', 'Event', 'Prayer', 'Urgent'] },
      audience: { type: 'string', enum: ['Public', 'Members', 'Staff'] },
      status: { type: 'string', enum: ['Draft', 'Scheduled', 'Published', 'Archived'] },
      publish_at: { type: 'string' },
      expiry_date: { type: ['string', 'null'] }
    },
    additionalProperties: false
  }
} as const;

export const updateAnnouncementSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer', minimum: 1 }
    }
  },
  body: {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 2, maxLength: 200 },
      content: { type: 'string', minLength: 1 },
      category: { type: 'string', enum: ['General', 'Event', 'Prayer', 'Urgent'] },
      audience: { type: 'string', enum: ['Public', 'Members', 'Staff'] },
      status: { type: 'string', enum: ['Draft', 'Scheduled', 'Published', 'Archived'] },
      publish_at: { type: 'string' },
      expiry_date: { type: ['string', 'null'] }
    },
    additionalProperties: false
  }
} as const;

export const announcementIdParamSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer', minimum: 1 }
    }
  }
} as const;
```

#### G. `backend/src/schemas/memberships.schema.ts`
```typescript
export const inviteMembershipSchema = {
  body: {
    type: 'object',
    required: ['name', 'email', 'temporary_password'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 100 },
      email: { type: 'string', minLength: 5, maxLength: 255 },
      role: {
        type: 'string',
        enum: ['tenant_admin', 'finance_officer', 'programme_officer', 'communications_officer', 'member']
      },
      temporary_password: { type: 'string', minLength: 8, maxLength: 128 }
    },
    additionalProperties: false
  }
} as const;

export const updateMembershipSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer', minimum: 1 }
    }
  },
  body: {
    type: 'object',
    properties: {
      role: {
        type: 'string',
        enum: ['tenant_admin', 'finance_officer', 'programme_officer', 'communications_officer', 'member']
      },
      status: {
        type: 'string',
        enum: ['Active', 'Suspended']
      }
    },
    additionalProperties: false
  }
} as const;
```

#### H. `backend/src/schemas/mosques.schema.ts`
```typescript
export const createMosqueSchema = {
  body: {
    type: 'object',
    required: ['name', 'slug', 'admin_name', 'admin_email', 'admin_password'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 150 },
      slug: { type: 'string', minLength: 2, maxLength: 50, pattern: '^[a-zA-Z0-9-]+$' },
      admin_name: { type: 'string', minLength: 2, maxLength: 100 },
      admin_email: { type: 'string', minLength: 5, maxLength: 255 },
      admin_password: { type: 'string', minLength: 8, maxLength: 128 },
      address: { type: 'string', maxLength: 255 },
      phone: { type: 'string', maxLength: 50 },
      email: { type: 'string', maxLength: 255 }
    },
    additionalProperties: false
  }
} as const;

export const getMosqueSchema = {
  params: {
    type: 'object',
    required: ['slug'],
    properties: {
      slug: { type: 'string', minLength: 1, maxLength: 100 }
    }
  }
} as const;

export const updateMosqueSchema = {
  params: {
    type: 'object',
    required: ['slug'],
    properties: {
      slug: { type: 'string', minLength: 1, maxLength: 100 }
    }
  },
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 150 },
      address: { type: ['string', 'null'] },
      phone: { type: ['string', 'null'] },
      email: { type: ['string', 'null'] },
      timezone: { type: 'string', maxLength: 50 },
      brand_color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
      logo_url: { type: ['string', 'null'] },
      notification_email: { type: 'boolean' },
      notification_in_app: { type: 'boolean' }
    },
    additionalProperties: false
  }
} as const;
```

#### I. `backend/src/schemas/notifications.schema.ts`
```typescript
export const readNotificationSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer', minimum: 1 }
    }
  }
} as const;

export const programReminderSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer', minimum: 1 }
    }
  }
} as const;
```

#### J. `backend/src/schemas/platform.schema.ts`
```typescript
export const platformLoginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', minLength: 5, maxLength: 255 },
      password: { type: 'string', minLength: 1, maxLength: 128 }
    },
    additionalProperties: false
  }
} as const;

export const updateTenantStatusSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer', minimum: 1 }
    }
  },
  body: {
    type: 'object',
    required: ['status'],
    properties: {
      status: { type: 'string', enum: ['Active', 'Suspended'] }
    },
    additionalProperties: false
  }
} as const;
```

#### K. `backend/src/schemas/index.ts`
```typescript
export * from './common.schema.js';
export * from './auth.schema.js';
export * from './donations.schema.js';
export * from './programs.schema.js';
export * from './registrations.schema.js';
export * from './announcements.schema.js';
export * from './memberships.schema.js';
export * from './mosques.schema.js';
export * from './notifications.schema.js';
export * from './platform.schema.js';
```

---

### 4.2 Updated Server Configuration (`backend/src/server.ts`)

```typescript
import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

import dbPlugin from './plugins/db.js';
import authPlugin from './plugins/auth.js';
import mosqueRoutes from './routes/mosques.js';
import authRoutes from './routes/auth.js';
import announcementRoutes from './routes/announcements.js';
import programRoutes from './routes/programs.js';
import registrationRoutes from './routes/registrations.js';
import donationRoutes from './routes/donations.js';
import analyticsRoutes from './routes/analytics.js';
import platformRoutes from './routes/platform.js';
import membershipRoutes from './routes/memberships.js';
import notificationRoutes from './routes/notifications.js';

export function buildServer() {
  const server = fastify({
    logger: true
  });

  // Strict CORS configuration with credentials and dynamic origin resolution
  const defaultAllowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5000'
  ];

  const envOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envOrigins]));

  server.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server, fastify.inject tests)
      if (!origin) {
        return cb(null, true);
      }

      if (allowedOrigins.includes(origin) || (envOrigins.length === 1 && envOrigins[0] === '*')) {
        return cb(null, true);
      }

      // Non-whitelisted origins: omit CORS headers
      return cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Mosque-Slug',
      'x-mosque-slug',
      'X-CSRF-Token',
      'x-csrf-token',
      'Cookie',
      'Accept',
      'Origin'
    ],
    exposedHeaders: ['Set-Cookie', 'X-CSRF-Token'],
    maxAge: 86400
  });

  // Enable Security Headers
  server.register(helmet);

  // Configure Rate Limiting
  server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute'
  });

  // Centralized Fastify Validation Error Formatter
  server.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      const message = error.message || 'Request validation failed';
      return reply.status(400).send({
        statusCode: 400,
        error: message,
        message,
        details: error.validation
      });
    }
    reply.send(error);
  });

  // Register Prisma Database and Auth Plugins
  server.register(dbPlugin);
  server.register(authPlugin);

  // Register Domain Routes
  server.register(mosqueRoutes);
  server.register(authRoutes);
  server.register(announcementRoutes);
  server.register(programRoutes);
  server.register(registrationRoutes);
  server.register(donationRoutes);
  server.register(analyticsRoutes);
  server.register(platformRoutes);
  server.register(membershipRoutes);
  server.register(notificationRoutes);

  return server;
}
```

---

## 5. Verification Method

### 5.1 Unit and Integration Test Verification
Run test suites across the project:
```bash
# In project root:
npm --prefix backend test
npm --prefix backend run test:node
```

### 5.2 CORS Verification Matrix
1. **Allowed Development Origin**:
   - Send `OPTIONS /api/auth/login` with `Origin: http://localhost:3000`.
   - Verify `Access-Control-Allow-Origin: http://localhost:3000` and `Access-Control-Allow-Credentials: true`.
2. **Disallowed Origin**:
   - Send `OPTIONS /api/auth/login` with `Origin: http://untrusted-attacker.com`.
   - Verify `Access-Control-Allow-Origin` header is omitted.
3. **No-Origin Injections / API calls**:
   - Send `POST /api/auth/login` without `Origin` header (curl / inject).
   - Verify request processes cleanly without CORS abort.

### 5.3 Schema Validation Verification Matrix
1. **Invalid Registration**:
   - `POST /api/auth/register` with missing password -> Returns `400 Bad Request` with `{ error: "body must have required property 'password'" }`.
2. **Negative Donation Amount**:
   - `POST /api/donations` with `{ amount: -100 }` -> Returns `400 Bad Request` with `{ error: "body/amount must be >= 0.01" }`.
3. **Invalid Role Modification**:
   - `PATCH /api/admin/memberships/1` with `{ role: 'unauthorized_role' }` -> Returns `400 Bad Request`.
4. **Invalid Route Param Type**:
   - `PUT /api/admin/programs/not-an-id` -> Returns `400 Bad Request` with `{ error: "params/id must be integer" }`.
