import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, apiList, authApiError } from '@/lib/api/client'
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
