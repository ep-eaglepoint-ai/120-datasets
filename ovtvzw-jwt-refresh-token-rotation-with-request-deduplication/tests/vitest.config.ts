import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000
  }
});
