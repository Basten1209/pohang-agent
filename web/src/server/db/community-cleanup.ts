import { createHash } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import type { Db } from './client'
import { appConfig, communityVisitPosts } from './schema'

const requestedPost = {
  id: '380d1879-4d67-4f8a-9919-fce8e67f4791',
  imageSha256:
    'de152def7c9e301de7b8f3253456cd9f47b81b05818cfe968e645dd3955573a4',
}

/** User-requested removal, run in the deployment holding the DB credentials.
 * Match both the exact post and reviewed image; retain no copy of the photo.
 */
export async function removeRequestedCommunityPost(
  db: Db,
  target = requestedPost,
) {
  const key = `community-cleanup:${target.id}`
  if ((await db.select().from(appConfig).where(eq(appConfig.key, key))).length)
    return
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(1381322292)`)
    if (
      (await tx.select().from(appConfig).where(eq(appConfig.key, key))).length
    )
      return
    const [post] = await tx
      .select()
      .from(communityVisitPosts)
      .where(eq(communityVisitPosts.id, target.id))
      .for('update')
    if (post) {
      const hash =
        post.imageData &&
        createHash('sha256')
          .update(Buffer.from(post.imageData.split(',')[1] ?? '', 'base64'))
          .digest('hex')
      if (post.photoKind !== 'UPLOAD' || hash !== target.imageSha256) return
      await tx
        .delete(communityVisitPosts)
        .where(eq(communityVisitPosts.id, target.id))
    }
    await tx.insert(appConfig).values({
      key,
      version: 1,
      value: { appliedAt: new Date().toISOString(), deleted: Boolean(post) },
      meta: { source: 'user-request' },
    })
  })
}
