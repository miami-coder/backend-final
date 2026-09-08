import { beforeEach, describe, expect, it, vi } from 'vitest'

const setSpy = vi.fn()
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ set: setSpy, get: vi.fn(), delete: vi.fn(), has: vi.fn(() => false) })),
}))

import { NextRequest } from 'next/server'
import { GET as callback } from '@/app/auth/callback/route'

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  setSpy.mockClear()
  vi.unstubAllGlobals()
})

describe('GET /auth/callback', () => {
  it('валідні токени: кладе cookie і редіректить на /', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      // токени з query передані на перевірку з Authorization
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer AT')
      return jsonRes({ data: { id: 'u1', email: 'a@b.c' } })
    })
    vi.stubGlobal('fetch', fetchMock)
    const res = await callback(new NextRequest('http://l/auth/callback?access=AT&refresh=RT'))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('http://l/')
    expect(setSpy).toHaveBeenCalledWith('piyachok_session', JSON.stringify({ accessToken: 'AT', refreshToken: 'RT' }), expect.anything())
  })

  it('невалідні токени (401 від /auth/me): без cookie, редірект на логін', async () => {
    const fetchMock = vi.fn(async () =>
      jsonRes({ error: { code: 'UNAUTHORIZED', message: 'x', details: null } }, 401))
    vi.stubGlobal('fetch', fetchMock)
    const res = await callback(new NextRequest('http://l/auth/callback?access=BAD&refresh=RT'))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('/auth/login')
    expect(setSpy).not.toHaveBeenCalled()
  })

  it('недоступний бекенд: без cookie, редірект на логін', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('connect ECONNREFUSED') }))
    const res = await callback(new NextRequest('http://l/auth/callback?access=AT&refresh=RT'))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('/auth/login')
    expect(setSpy).not.toHaveBeenCalled()
  })

  it('без параметрів — на логін з error=oauth', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const res = await callback(new NextRequest('http://l/auth/callback'))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('/auth/login?error=oauth')
    expect(setSpy).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
