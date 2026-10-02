// GET /api/auth/google|facebook — точка старту OAuth для браузера:
// 302 на бекенд. Браузер НЕ бачить docker-імʼя BACKEND_URL (host.docker.internal
// не резолвиться з хоста) — редірект має вести на браузерну адресу бекенда
// (публікований порт localhost:3000).

import { describe, expect, it, vi } from 'vitest'

const backendUrl = vi.hoisted(() => ({ value: 'http://host.docker.internal:3000' }))
vi.mock('@/app/api/auth/_backend', () => ({
  backendUrl: backendUrl.value,
  browserBackendUrl: 'http://localhost:3000',
}))

import { GET as google } from '@/app/api/auth/google/route'
import { GET as facebook } from '@/app/api/auth/facebook/route'

describe('OAuth start redirects', () => {
  it('google → 302 на браузерну адресу бекенда, не на BACKEND_URL з контейнера', async () => {
    const res = await google()
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('http://localhost:3000/api/v1/auth/google')
  })

  it('facebook → 302 на браузерну адресу бекенда', async () => {
    const res = await facebook()
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('http://localhost:3000/api/v1/auth/facebook')
  })
})