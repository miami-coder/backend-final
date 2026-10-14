import { beforeEach, describe, expect, it, vi } from 'vitest'

const setSpy = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ set: setSpy, get: vi.fn(), delete: vi.fn(), has: vi.fn(() => false) })),
}))

import { POST as login } from '@/app/api/auth/login/route'

const okBackend = {
  ok: true,
  status: 201,
  json: async () => ({ accessToken: 'AT', refreshToken: 'RT', user: { id: 'u1', email: 'a@b.c', roles: ['user'] } }),
}

beforeEach(() => {
  vi.restoreAllMocks()
  setSpy.mockClear()
})

describe('POST /api/auth/login', () => {
  it('успіх: кладе токени в cookie і повертає ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okBackend))
    const res = await login(new Request('http://l/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.c', password: 'Password1' }),
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(setSpy).toHaveBeenCalledWith('piyachok_session', JSON.stringify({ accessToken: 'AT', refreshToken: 'RT' }), expect.objectContaining({ httpOnly: true }))
  })

  it('401 від бекенда проксується клієнту', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Невірний email або пароль', details: null } }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    )))
    const res = await login(new Request('http://l/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.c', password: 'wrong' }),
    }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.message).toBe('Невірний email або пароль')
    expect(setSpy).not.toHaveBeenCalled()
  })

  it('бекенд недоступний (мережа) → 502 INTERNAL_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('connect ECONNREFUSED') }))
    const res = await login(new Request('http://l/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.c', password: 'Password1' }),
    }))
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'Сервіс тимчасово недоступний', details: null })
    expect(setSpy).not.toHaveBeenCalled()
  })
})
