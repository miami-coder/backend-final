import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, apiList, apiVoid, authApiError } from '@/lib/api/client'
import { ApiError } from '@/lib/api/parse'

afterEach(() => vi.unstubAllGlobals())

describe('api', () => {
  it('фетчить відносний шлях через проксі і розгортає data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: { id: 'x' } }), { status: 200, headers: { 'content-type': 'application/json' } },
    )))
    expect(await api<{ id: string }>('/auth/me')).toEqual({ id: 'x' })
  })

  it('401 → редірект на логін з next і throw ApiError', async () => {
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { pathname: '/venues/x', assign } })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'x', details: null } }), { status: 401 },
    )))
    await expect(api('/me')).rejects.toBeInstanceOf(ApiError)
    expect(assign).toHaveBeenCalledWith('/auth/login?next=' + encodeURIComponent('/venues/x'))
  })
})

describe('api: edge-кейси', () => {
  it('non-401 ApiError (409) — кидає помилку бекенда, БЕЗ редіректу', async () => {
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { pathname: '/x', assign } })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { code: 'CONFLICT', message: 'Ви вже залишили відгук', details: null } }),
      { status: 409, headers: { 'content-type': 'application/json' } },
    )))
    await expect(api('/me/whatever')).rejects.toMatchObject({ status: 409, message: 'Ви вже залишили відгук' })
    expect(assign).not.toHaveBeenCalled()
  })

  it('401 без window (SSR) — відхиляється ApiError, без ReferenceError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'x', details: null } }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    )))
    const originalWindow = globalThis.window
    vi.stubGlobal('window', undefined)
    await expect(api('/me')).rejects.toBeInstanceOf(ApiError)
    vi.stubGlobal('window', originalWindow)
  })

  it('DELETE → 200 з порожнім тілом → undefined без кидка (відкат не спрацьовує на успіху)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 200 })))
    expect(await api('/me/favorites/v1', { method: 'DELETE' })).toBeUndefined()
  })
})

describe('apiVoid', () => {
  it('DELETE 200 порожнє тіло → резолвиться void (без parse JSON)', async () => {
    vi.stubGlobal('window', { location: { pathname: '/venues/v1', assign: vi.fn() } })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })))
    await expect(apiVoid('/reviews/r1', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it('!ok (403) → кидає ApiError з тіла, БЕЗ редіректу', async () => {
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { pathname: '/venues/v1', assign } })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Не ваш відгук', details: null } }),
      { status: 403, headers: { 'content-type': 'application/json' } },
    )))
    await expect(apiVoid('/reviews/r1', { method: 'DELETE' })).rejects.toMatchObject({
      status: 403, message: 'Не ваш відгук',
    })
    expect(assign).not.toHaveBeenCalled()
  })

  it('apiVoid: 401 → redirect ініційовано, НЕ кидає ApiError', async () => {
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { pathname: '/me/favorites/v1', assign } })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })))
    // Редірект уже ініційовано — компоненти не показують toast перед
    // перезавантаженням (резидуал Плану 2 №10): тихо резолвимося
    await expect(apiVoid('/me/favorites/v1', { method: 'DELETE' })).resolves.toBeUndefined()
    expect(assign).toHaveBeenCalledWith('/auth/login?next=' + encodeURIComponent('/me/favorites/v1'))
  })
})

describe('apiList', () => {
  it('повертає data+meta', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: [1], meta: { page: 1, limit: 20, total: 1, hasMore: false } }),
      { status: 200 },
    )))
    expect(await apiList<number>('/venues')).toEqual({ data: [1], meta: { page: 1, limit: 20, total: 1, hasMore: false } })
  })
})

describe('authApiError', () => {
  it('повертає message ApiError', () => {
    expect(authApiError(new ApiError(409, 'CONFLICT', 'Ви вже залишили відгук'))).toBe('Ви вже залишили відгук')
  })
  it('не-ApiError → null', () => {
    expect(authApiError(new Error('x'))).toBeNull()
  })
})
