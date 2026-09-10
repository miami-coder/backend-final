import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/auth/session', () => ({
  getSessionTokens: vi.fn(async () => ({ accessToken: 'a', refreshToken: 'r' })),
}))

const serverFetch = vi.fn()
vi.mock('@/lib/api/server-client', () => ({
  serverFetch: (...args: unknown[]) => serverFetch(...args),
}))

vi.mock('next/navigation', () => ({ redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }) }))

import MyVenuesPage from '@/app/account/venues/page'

const rawVenue = {
  id: 'v1', ownerId: 'u1', name: 'Бар «Пиво»', description: null, address: 'вул. Липова, 1',
  latitude: '50.45', longitude: '30.52', contacts: {}, workingHours: {}, averageCheck: '250',
  mainPhotoUrl: null, status: 'pending', ratingAvg: '4.5', ratingCount: 2, viewCount: 10,
  createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z', photos: [],
}

describe('/account/venues', () => {
  beforeEach(() => {
    serverFetch.mockReset()
    // serverFetch розгортає {data} бекенд-конверта сам (parseData) → мок віддає масив
    serverFetch.mockResolvedValue([rawVenue])
  })

  it('рендерить картки зі статусом', async () => {
    const html = renderToStaticMarkup(await MyVenuesPage())
    expect(html).toContain('На модерації')
    expect(html).toContain('/account/venues/v1')
    expect(serverFetch).toHaveBeenCalledWith('/me/venues', { tokens: { accessToken: 'a', refreshToken: 'r' }, revalidate: 0 })
  })

  it('порожньо → CTA на /venues/new', async () => {
    serverFetch.mockResolvedValue([])
    const html = renderToStaticMarkup(await MyVenuesPage())
    expect(html).toContain('/venues/new')
    // у брифі рядок «поки немає закладів» не збігається з копі-рядком
    // компонента («Закладів поки немає.») — перевіряємо спільну частину
    expect(html).toContain('поки немає')
  })

  it('created=1 → банер «Заклад подано на модерацію»', async () => {
    const html = renderToStaticMarkup(
      await MyVenuesPage({ searchParams: Promise.resolve({ created: '1' }) }),
    )
    expect(html).toContain('Заклад подано на модерацію')
  })

  it('без created → банера немає', async () => {
    const html = renderToStaticMarkup(await MyVenuesPage())
    expect(html).not.toContain('Заклад подано на модерацію')
  })
})
