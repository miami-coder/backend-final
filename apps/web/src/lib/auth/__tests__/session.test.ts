import { afterEach, describe, expect, it, vi } from 'vitest'
import { decodeTokens, encodeTokens, refreshTokens, sessionCookieOptions } from '@/lib/auth/session'

afterEach(() => vi.unstubAllGlobals())

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

describe('refreshTokens', () => {
  it('201 з новими токенами → повертає їх', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ accessToken: 'NEW_AT', refreshToken: 'NEW_RT' }),
      { status: 201, headers: { 'content-type': 'application/json' } },
    )))
    expect(await refreshTokens('RT')).toEqual({ accessToken: 'NEW_AT', refreshToken: 'NEW_RT' })
  })
  it('401 → null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })))
    expect(await refreshTokens('DEAD')).toBeNull()
  })
  it('мережева помилка → null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network') }))
    expect(await refreshTokens('RT')).toBeNull()
  })
})
