import { sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from './schema'

/**
 * One database interface, two engines:
 *
 * - `DATABASE_URL` set → PostgreSQL over node-postgres (Vercel + Neon/Supabase, GCP).
 * - otherwise → PGlite (Postgres compiled to WASM) — a real Postgres with
 *   jsonb and GIN indexes, persisted to `PGLITE_DIR` or kept in memory.
 *
 * The rest of the app only sees `Db`.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

const connect = async (): Promise<Db> => {
  const url = process.env.DATABASE_URL
  if (url) {
    const { drizzle } = await import('drizzle-orm/node-postgres')
    return drizzle({
      connection: {
        connectionString: url,
        max: 3,
        connectionTimeoutMillis: 5000,
        statement_timeout: 10000,
      },
      schema,
    }) as unknown as Db
  }
  const { PGlite } = await import('@electric-sql/pglite')
  const dir =
    process.env.PGLITE_DIR ??
    (process.env.NODE_ENV === 'production' || process.env.VITEST
      ? 'memory://'
      : '.data/pglite')
  if (!dir.startsWith('memory://')) {
    const { mkdirSync } = await import('node:fs')
    const { dirname } = await import('node:path')
    mkdirSync(dirname(dir), { recursive: true })
  }
  const { drizzle } = await import('drizzle-orm/pglite')
  return drizzle({ client: new PGlite(dir), schema }) as unknown as Db
}

export const bootstrap = async (db: Db) => {
  for (const statement of schema.bootstrapStatements)
    await db.execute(sql.raw(statement))
  return db
}

let pending: Promise<Db> | undefined

/** Lazily connect and bootstrap once per process. A failed attempt is retried next call. */
export const getDb = (): Promise<Db> => {
  pending ??= connect()
    .then(bootstrap)
    .catch((error: unknown) => {
      pending = undefined
      throw error
    })
  return pending
}

/** For tests: use an isolated in-memory database. */
export const memoryDb = async (): Promise<Db> => {
  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle } = await import('drizzle-orm/pglite')
  return bootstrap(drizzle({ client: new PGlite(), schema }) as unknown as Db)
}
