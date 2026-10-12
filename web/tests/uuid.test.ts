import { afterEach, expect, it } from 'vitest'
import { z } from 'zod'
import { uuid } from '#/app/trip-client'

const original = Object.getOwnPropertyDescriptor(crypto, 'randomUUID')
afterEach(() => {
  if (original) Object.defineProperty(crypto, 'randomUUID', original)
})

it('HTTPS가 아닌 주소(휴대폰에서 개발 서버 접속)에서도 v4 UUID를 만든다', () => {
  Object.defineProperty(crypto, 'randomUUID', {
    value: undefined,
    configurable: true,
  })
  const ids = Array.from({ length: 50 }, uuid)
  for (const id of ids) {
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    // The server accepts it as a trip id.
    expect(z.uuid().safeParse(id).success).toBe(true)
  }
  expect(new Set(ids).size).toBe(ids.length)
})
