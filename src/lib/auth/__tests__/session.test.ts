import { describe, expect, it } from 'vitest'
import { decodeTokens, encodeTokens, sessionCookieOptions } from '@/lib/auth/session'

describe('сесійний cookie', () => {
  it('encode → decode дає ті самі токени', () => {
    const t = { accessToken: 'a.b.c', refreshToken: 'r.d.e' }
    expect(decodeTokens(encodeTokens(t))).toEqual(t)
  })
  it('decode null/сміття/порожній JSON → null', () => {
    expect(decodeTokens(undefined)).toBeNull()
    expect(decodeTokens('not-json')).toBeNull()
    expect(decodeTokens('{}')).toBeNull() // немає обох полів
  })
  it('опції cookie: httpOnly, lax, 30 днів', () => {
    const o = sessionCookieOptions()
    expect(o.httpOnly).toBe(true)
    expect(o.sameSite).toBe('lax')
    expect(o.path).toBe('/')
    expect(o.maxAge).toBe(30 * 24 * 3600)
  })
})
