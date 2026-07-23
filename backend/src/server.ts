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

export function buildServer() {
  const server = fastify({
    logger: true
  });

  // Enable CORS
  server.register(cors, {
    origin: process.env.CORS_ORIGIN || '*',
  });

  // Enable Security Headers
  server.register(helmet);

  // Configure Rate Limiting
  server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute'
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
