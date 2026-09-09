import { beforeEach, describe, expect, it, vi } from 'vitest'

const setSpy = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ set: setSpy, get: vi.fn(), delete: vi.fn(), has: vi.fn(() => false) })),
}))

import { POST as oauth } from '@/app/api/auth/oauth/route'

const meOk = new Response(JSON.stringify({ data: { id: 'u1', email: 'a@b.c', roles: ['user'] } }), {
  status: 200, headers: { 'content-type': 'application/json' },
})

beforeEach(() => {
  setSpy.mockClear()
  vi.restoreAllMocks()
})

describe('POST /api/auth/oauth', () => {
  it('валідні токени: кладе cookie, повертає ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => meOk))
    const res = await oauth(new Request('http://l/api/auth/oauth', {
      method: 'POST',
      body: JSON.stringify({ accessToken: 'AT', refreshToken: 'RT' }),
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(setSpy).toHaveBeenCalledWith('piyachok_session', JSON.stringify({ accessToken: 'AT', refreshToken: 'RT' }), expect.objectContaining({ httpOnly: true }))
  })

  it('невалідні токени (401 від /auth/me): 401 клієнту, cookie НЕ ставиться', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    )))
    const res = await oauth(new Request('http://l/api/auth/oauth', {
      method: 'POST',
      body: JSON.stringify({ accessToken: 'BAD', refreshToken: 'RT' }),
    }))
    expect(res.status).toBe(401)
    expect(setSpy).not.toHaveBeenCalled()
  })

  it('без полів — 400', async () => {
    const res = await oauth(new Request('http://l/api/auth/oauth', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(400)
  })
})