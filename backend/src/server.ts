import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

import dbPlugin from './plugins/db.js';
import securityPlugin from './plugins/security.js';
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
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server, fastify.inject tests)
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

  // Register Plugins
  server.register(dbPlugin);
  server.register(securityPlugin);
  server.register(authPlugin);

  // Health Check Endpoint per Developer Guide §12.3
  server.get('/health', async (request, reply) => {
    try {
      // Ping SQLite / DB connection
      await server.prisma.$queryRaw`SELECT 1`;
      return reply.status(200).send({
        status: 'ok',
        uptime: process.uptime(),
        db: 'connected',
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      return reply.status(503).send({
        status: 'error',
        uptime: process.uptime(),
        db: 'disconnected',
        error: 'Database connectivity check failed',
        timestamp: new Date().toISOString()
      });
    }
  });

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

const start = async () => {
  const server = buildServer();
  try {
    const port = Number(process.env.PORT) || 5000;
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on http://localhost:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Start the server if this script is executed directly
if (process.argv[1] && process.argv[1].endsWith('server.ts')) {
  start();
}
