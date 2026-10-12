/** Run from web/: node --env-file=.env scripts/seed-demo-community.mjs [--apply]
 * Fixed ids make reruns safe. Only these seed rows and selected config fields change.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const seed = JSON.parse(
  readFileSync(new URL('./demo-community.json', import.meta.url), 'utf8'),
)
const assets = Object.fromEntries(
  [
    'food',
    'street',
    'gp-museum',
    'cafe',
    'hm-food',
    'hm-hand',
    'hm-museum',
    'hm-cafe',
  ].map((id) => [id, `/images/demo/sample-${id}.webp`]),
)
for (const path of [...Object.values(assets), ...seed.map((p) => p.image)]) {
  if (!existsSync(fileURLToPath(new URL(`../public${path}`, import.meta.url))))
    throw new Error(`Missing asset: ${path}`)
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  statement_timeout: 15000,
})
await client.connect()
const stableId = (name) => {
  const hex = createHash('sha256')
    .update(`run2-qa-demo-v1:${name}`)
    .digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}
try {
  const counts = await client.query(
    'SELECT (SELECT count(*) FROM community_posts) AS finishes, (SELECT count(*) FROM community_visit_posts) AS visits',
  )
  console.log(
    JSON.stringify({
      mode: process.argv.includes('--apply') ? 'apply' : 'dry-run',
      before: counts.rows[0],
      seeds: seed.length,
      images: Object.keys(assets).length,
    }),
  )
  if (process.argv.includes('--apply')) {
    await client.query('BEGIN')
    try {
      await client.query('SELECT pg_advisory_xact_lock(1381322291)')
      await client.query(
        'ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS demo_image text',
      )
      for (const [index, post] of seed.entries()) {
        const id = stableId(post.key),
          tripId = stableId(`trip:${post.key}`)
        // Background posts sit before posts shared live in the demo.
        const createdAt = new Date(Date.now() - (24 + index) * 3600000)
        if (post.kind === 'FINISH') {
          await client.query(
            `INSERT INTO community_posts (id, trip_id, course, author, caption, photo_kind, demo_image, created_at)
            VALUES ($1,$2,$3,$4,$5,'DEMO',$6,$7)
            ON CONFLICT (id) DO UPDATE SET author=excluded.author, caption=excluded.caption, demo_image=excluded.demo_image`,
            [
              id,
              tripId,
              post.course,
              post.author,
              post.caption,
              post.image,
              createdAt,
            ],
          )
        } else {
          await client.query(
            `INSERT INTO community_visit_posts (id, trip_id, course, place_id, place_name, author, caption, photo_kind, demo_image, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,'DEMO',$8,$9)
            ON CONFLICT (id) DO UPDATE SET author=excluded.author, caption=excluded.caption, demo_image=excluded.demo_image`,
            [
              id,
              tripId,
              post.course,
              post.placeId,
              post.placeName,
              post.author,
              post.caption,
              post.image,
              createdAt,
            ],
          )
        }
      }
      for (const [id, image] of Object.entries(assets)) {
        await client.query(
          `UPDATE places SET attrs=jsonb_set(attrs,'{image}',to_jsonb($2::text)), meta=meta || '{"imageSource":"AI_GENERATED_DEMO"}'::jsonb, updated_at=now()
          WHERE id=$1 AND (coalesce(attrs->>'image','')='' OR attrs->>'image' LIKE '/images/demo/sample-%')`,
          [id, image],
        )
      }
      await client.query(
        `UPDATE app_config SET value=jsonb_set(value,'{maxOutputTokens}','1600'::jsonb), meta=meta || '{"source":"operator"}'::jsonb, updated_at=now() WHERE key='agent'`,
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
    const after = await client.query(
      'SELECT (SELECT count(*) FROM community_posts) AS finishes, (SELECT count(*) FROM community_visit_posts) AS visits',
    )
    console.log(
      JSON.stringify({
        after: after.rows[0],
        ids: seed.map((p) => stableId(p.key)),
      }),
    )
  }
} finally {
  await client.end()
}
