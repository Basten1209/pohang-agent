import { z } from 'zod'

/** Small HTTP helpers shared by server routes. */

export const noStore = { 'Cache-Control': 'no-store' }

export const json = (data: unknown, init: ResponseInit = {}) =>
  Response.json(data, { ...init, headers: { ...noStore, ...init.headers } })

/** Parse a JSON body against a schema; respond 422 instead of throwing. */
export const parseBody = async <S extends z.ZodType>(
  request: Request,
  schema: S,
  maxBytes = 64_000,
): Promise<
  { ok: true; data: z.infer<S> } | { ok: false; response: Response }
> => {
  const text = await request.text()
  if (text.length > maxBytes)
    return {
      ok: false,
      response: json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 }),
    }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return {
      ok: false,
      response: json({ error: 'INVALID_JSON' }, { status: 400 }),
    }
  }
  const parsed = schema.safeParse(raw)
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, response: json({ error: 'INVALID_INPUT' }, { status: 422 }) }
}
