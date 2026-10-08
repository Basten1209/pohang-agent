import { defineConfig } from 'drizzle-kit'

// Managed migrations for a real PostgreSQL (`DATABASE_URL`).
// PGlite and first deploys use the idempotent bootstrap in src/server/db/schema.ts.
export default defineConfig({
  out: './drizzle',
  schema: './src/server/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
})
