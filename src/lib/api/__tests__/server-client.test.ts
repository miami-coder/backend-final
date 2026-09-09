import { afterEach, describe, expect, it, vi } from 'vitest'
import { serverFetch } from '@/lib/api/server-client'

afterEach(() => vi.unstubAllGlobals())

const ok = () => new Response(JSON.stringify({ data: { id: 'x' } }), {
  status: 200, headers: { 'content-type': 'application/json' },
})

// Сигнатура через generic: mock.calls[0][1] тайпнувся як RequestInit (а не порожній кортеж)
const fetchMock = () => vi.fn<(url: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => ok())

describe('serverFetch', () => {
  it('revalidate: 0 → cache: no-store', async () => {
    const mock = fetchMock()
    vi.stubGlobal('fetch', mock)
    await serverFetch('/venues/x', { revalidate: 0 })
    const init = mock.mock.calls[0][1] as RequestInit & { cache?: string }
    expect(init.cache).toBe('no-store')
  })
  it('revalidate: 60 → next.revalidate = 60', async () => {
    const mock = fetchMock()
    vi.stubGlobal('fetch', mock)
    await serverFetch('/venues', { revalidate: 60 })
    const init = mock.mock.calls[0][1] as RequestInit & { next?: { revalidate?: number } }
    expect(init.next?.revalidate).toBe(60)
  })
  it('tokens → Authorization Bearer', async () => {
    const mock = fetchMock()
    vi.stubGlobal('fetch', mock)
    await serverFetch('/me/reviews', { tokens: { accessToken: 'AT', refreshToken: 'RT' } })
    const init = mock.mock.calls[0][1] as RequestInit
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer AT')
  })
  it('body без content-type → проставляється application/json', async () => {
    const mock = fetchMock()
    vi.stubGlobal('fetch', mock)
    await serverFetch('/complaints', { init: { method: 'POST', body: JSON.stringify({ a: 1 }) } })
    const init = mock.mock.calls[0][1] as RequestInit
    expect((init.headers as Headers).get('content-type')).toBe('application/json')
  })
})
