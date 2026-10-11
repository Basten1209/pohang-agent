import { z } from 'zod'

export const communityPostSchema = z
  .object({
    tripId: z.uuid(),
    course: z.enum(['guryongpo', 'homigot']),
    caption: z.string().trim().min(1).max(300),
    photo: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('DEMO') }).strict(),
      z
        .object({
          kind: z.literal('UPLOAD'),
          // The client resizes/re-encodes images to JPEG before sending them.
          data: z
            .string()
            .max(1_000_000)
            .regex(/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/),
        })
        .strict(),
    ]),
  })
  .strict()

export type CommunityPostInput = z.infer<typeof communityPostSchema>
export type CommunityPost = {
  id: string
  course: string
  author: string
  caption: string
  photoKind: 'DEMO' | 'UPLOAD'
  image: string
  createdAt: string
}
