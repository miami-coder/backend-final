import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const serverFetch = vi.fn()
vi.mock('@/lib/api/server-client', () => ({ serverFetch: (...args: unknown[]) => serverFetch(...args) }))
vi.mock('next/navigation', () => ({ notFound: vi.fn(() => { throw new Error('NOT_FOUND') }) }))

import NewsPage from '@/app/news/[id]/page'

const rawNews = {
  id: 'n1', venueId: 'v1', category: 'event', title: 'Заголовок новини',
  content: 'Перший абзац.\n\nДругий абзац.', imageUrl: '/static/a.png', status: 'published',
  isPromoted: false, publishedAt: '2026-09-10T10:00:00Z',
  createdAt: '2026-09-10T10:00:00Z', updatedAt: '2026-09-10T10:00:00Z',
}

describe('/news/[id]', () => {
  it('рендер контенту і посилання на заклад', async () => {
    serverFetch.mockImplementation(async (path: string) => {
      if (path.startsWith('/news/')) return rawNews
      return { id: 'v1', name: 'Бар «Пиво»', address: 'вул. Липова, 1' }
    })
    const html = renderToStaticMarkup(await NewsPage({ params: Promise.resolve({ id: 'n1' }) }))
    expect(html).toContain('Заголовок новини')
    expect(html).toContain('Перший абзац.')
    expect(html).toContain('/venues/v1')
  })

  it('немає новини → notFound', async () => {
    serverFetch.mockRejectedValue(new Error('404'))
    await expect(NewsPage({ params: Promise.resolve({ id: 'nope' }) })).rejects.toThrow('NOT_FOUND')
  })

  // Бекенд віддає архівну новину зі статусом 200 — публічна деталка ховає її (notFound)
  it('заархівована новина → notFound', async () => {
    serverFetch.mockResolvedValue({ ...rawNews, status: 'archived' })
    await expect(NewsPage({ params: Promise.resolve({ id: 'n1' }) })).rejects.toThrow('NOT_FOUND')
  })

  it('метадата містить заголовок', async () => {
    serverFetch.mockImplementation(async (path: string) => (path.startsWith('/news/') ? rawNews : null))
    const meta = await (await import('@/app/news/[id]/page')).generateMetadata({ params: Promise.resolve({ id: 'n1' }) })
    expect(meta.title).toContain('Заголовок новини')
  })
})
