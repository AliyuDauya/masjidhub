import { describe, it, expect, beforeEach } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('Fastify Rate Limiting', () => {
  let app: any;

  beforeEach(() => {
    app = buildServer();
  });

  it('should enforce rate limits and return 429 when max threshold is exceeded', async () => {
    // Inject mock requests up to limit constraint
    for (let i = 0; i < 100; i++) {
      await app.inject({
        method: 'GET',
        url: '/api/mosques/al-noor'
      });
    }

    // The 101st request should be blocked
    const blockedResponse = await app.inject({
      method: 'GET',
      url: '/api/mosques/al-noor'
    });

    expect(blockedResponse.statusCode).toBe(429);
    expect(JSON.parse(blockedResponse.body).message).toContain('Rate limit exceeded');
  });
});
