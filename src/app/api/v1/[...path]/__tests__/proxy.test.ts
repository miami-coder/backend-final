import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookieStore: { value: string | undefined } = { value: undefined }

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (name === 'piyachok_session' ? { value: cookieStore.value } : undefined),
    set: (name: string, value: string) => { if (name === 'piyachok_session') cookieStore.value = value },
  })),
}))

import { GET as proxyGet, POST as proxyPost } from '@/app/api/v1/[...path]/route'
import { decodeTokens } from '@/lib/auth/session'

const jsonRes = (body: unknown, status = 200, headers: Record<string, string> = { 'content-type': 'application/json' }) =>
  new Response(JSON.stringify(body), { status, headers })

const makeCtx = (path: string[]) => ({ params: Promise.resolve({ path }) })

beforeEach(() => {
  cookieStore.value = JSON.stringify({ accessToken: 'OLD_AT', refreshToken: 'REF' })
  vi.restoreAllMocks()
})

describe('проксі /api/v1', () => {
  it('додає Authorization з cookie і проксує відповідь', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect((init?.headers as Headers).get('Authorization')).toBe('Bearer OLD_AT')
      return jsonRes({ data: { ok: 1 } })
    })
    vi.stubGlobal('fetch', fetchMock)
    const res = await proxyGet(new Request('http://l/api/v1/auth/me') as never, makeCtx(['auth', 'me']) as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { ok: 1 } })
  })

  it('при 401 робить refresh, оновлює cookie і повторює запит', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonRes({ error: { code: 'UNAUTHORIZED', message: 'x', details: null } }, 401))
      .mockResolvedValueOnce(jsonRes({ accessToken: 'NEW_AT', refreshToken: 'NEW_RT' }, 201)) // /auth/refresh
      .mockResolvedValueOnce(jsonRes({ data: { id: 'u1' } }))                                  // retry /auth/me
    vi.stubGlobal('fetch', fetchMock)
    const res = await proxyGet(new Request('http://l/api/v1/auth/me') as never, makeCtx(['auth', 'me']) as never)
    expect(res.status).toBe(200)
    // ротація спостережувана у Set-Cookie відповіді (сервер декодує value при читанні cookie)
    const session = res.headers.getSetCookie().find((c) => c.startsWith('piyachok_session='))
    expect(session).toBeDefined()
    const cookieValue = decodeURIComponent(session!.split(';')[0]!.slice('piyachok_session='.length))
    expect(decodeTokens(cookieValue)).toEqual({ accessToken: 'NEW_AT', refreshToken: 'NEW_RT' })
    const retryInit = fetchMock.mock.calls[2][1] as RequestInit
    expect((retryInit.headers as Headers).get('Authorization')).toBe('Bearer NEW_AT')
  })

  it('retry після refresh несе те саме тіло POST', async () => {
    const payload = JSON.stringify({ name: 'Пиячок IPA' })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonRes({ error: { code: 'UNAUTHORIZED', message: 'x', details: null } }, 401))
      .mockResolvedValueOnce(jsonRes({ accessToken: 'NEW_AT', refreshToken: 'NEW_RT' }, 201)) // /auth/refresh
      .mockResolvedValueOnce(jsonRes({ data: { ok: 1 } }))                                  // retry POST
    vi.stubGlobal('fetch', fetchMock)
    const res = await proxyPost(new Request('http://l/api/v1/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    }) as never, makeCtx(['orders']) as never)
    expect(res.status).toBe(200)
    const retryInit = fetchMock.mock.calls[2][1] as RequestInit
    expect(new TextDecoder().decode(retryInit.body as ArrayBuffer)).toBe(payload)
    expect((retryInit.headers as Headers).get('content-type')).toBe('application/json')
  })

  it('бекенд недоступний → 502 INTERNAL_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('connect ECONNREFUSED') }))
    const res = await proxyGet(new Request('http://l/api/v1/venues') as never, makeCtx(['venues']) as never)
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'Сервіс тимчасово недоступний', details: null })
  })

  it('мертвий refresh → проксує 401', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonRes({ error: { code: 'UNAUTHORIZED', message: 'x', details: null } }, 401))
      .mockResolvedValueOnce(jsonRes({ error: { code: 'UNAUTHORIZED', message: 'x', details: null } }, 401))
    vi.stubGlobal('fetch', fetchMock)
    const res = await proxyGet(new Request('http://l/api/v1/auth/me') as never, makeCtx(['auth', 'me']) as never)
    expect(res.status).toBe(401)
  })

  it('dot-сегмент у шляху → 400 BAD_REQUEST, до бекенда не доходить', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    // Next декодує %2e%2e у '..' — саме такий масив сегментів і прийде в params
    const res = await proxyGet(new Request('http://l/api/v1/%2e%2e/health') as never, makeCtx(['..', 'health']) as never)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: { code: 'BAD_REQUEST', message: 'Некоректний запит', details: null } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('сегмент з вбудованим %2f (обхід через ../) → 400 BAD_REQUEST, до бекенда не доходить', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    // Тестовий харнес передає сегменти прямо в params (без декодування URL),
    // тому подаємо той вигляд, який у проді дістається хендлеру: Next розбиває
    // catch-all на '/' ДО декодування, тож '..%2fhealth' і '..%2f..%2fsecret'
    // приходять як ОДИН сегмент '../health' / '../../secret'
    const res1 = await proxyGet(new Request('http://l/api/v1/..%2fhealth') as never, makeCtx(['../health']) as never)
    expect(res1.status).toBe(400)
    expect(await res1.json()).toEqual({ error: { code: 'BAD_REQUEST', message: 'Некоректний запит', details: null } })
    const res2 = await proxyGet(new Request('http://l/api/v1/..%2f..%2fsecret') as never, makeCtx(['../../secret']) as never)
    expect(res2.status).toBe(400)
    // backslash-варіант теж відкидається
    const res3 = await proxyGet(new Request('http://l/api/v1/x') as never, makeCtx(['..\\secret']) as never)
    expect(res3.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('без сесії не додає Authorization', async () => {
    cookieStore.value = undefined
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect((init?.headers as Headers).get('Authorization')).toBeNull()
      return jsonRes({ data: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    await proxyGet(new Request('http://l/api/v1/venues') as never, makeCtx(['venues']) as never)
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
