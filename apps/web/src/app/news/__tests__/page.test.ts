import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const serverFetchList = vi.fn()
vi.mock('@/lib/api/server-client', () => ({ serverFetchList: (...args: unknown[]) => serverFetchList(...args) }))

import NewsPage from '@/app/news/page'

const rawNews = {
  id: 'n1', venueId: null, category: 'promo', title: 'Заголовок новини', content: 'x',
  imageUrl: '/static/a.png', status: 'published', isPromoted: true,
  publishedAt: '2026-09-10T10:00:00Z', createdAt: '2026-09-10T10:00:00Z', updatedAt: '2026-09-10T10:00:00Z',
}

describe('/news', () => {
  beforeEach(() => {
    serverFetchList.mockReset()
    serverFetchList.mockResolvedValue({ data: [rawNews], meta: { page: 1, limit: 12, total: 1, hasMore: false } })
  })

  // ⚠️ бриф: твердження звірено з фактичним форматом шляху — конкатенація
  // `?page=&limit=` без `category` для дефолту
  it('фетчить /news з revalidate:60 і рендерить картку', async () => {
    const html = renderToStaticMarkup(await NewsPage({ searchParams: Promise.resolve({}) }))
    expect(serverFetchList).toHaveBeenCalledWith('/news?page=1&limit=12', expect.objectContaining({ revalidate: 60 }))
    expect(html).toContain('Заголовок новини')
    expect(html).toContain('/news/n1')
  })

  it('category=promo передається у запит', async () => {
    renderToStaticMarkup(await NewsPage({ searchParams: Promise.resolve({ category: 'promo' }) }))
    expect(serverFetchList).toHaveBeenCalledWith('/news?page=1&limit=12&category=promo', expect.anything())
  })

  it('порожньо → empty-state', async () => {
    serverFetchList.mockResolvedValue({ data: [] })
    const html = renderToStaticMarkup(await NewsPage({ searchParams: Promise.resolve({}) }))
    expect(html).toContain('Новин ще немає')
  })
})
