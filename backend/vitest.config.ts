import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/current/**/*.test.ts', 'test/e2e/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } }
  }
});

