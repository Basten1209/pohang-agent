import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // In-memory Postgres (PGlite) tests are slow when every file runs at once.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
