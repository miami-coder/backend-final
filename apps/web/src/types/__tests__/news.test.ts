import { describe, expect, it } from 'vitest'
import { parseNews, type RawNews } from '@/types/news'

const raw: RawNews = {
  id: 'n1', venueId: 'v1', category: 'promo', title: 'Заголовок новини',
  content: 'Текст', imageUrl: '/static/a.png', status: 'published',
  isPromoted: true, publishedAt: '2026-09-10T10:00:00Z',
  createdAt: '2026-09-10T10:00:00Z', updatedAt: '2026-09-10T10:00:00Z',
}

describe('parseNews', () => {
  it('розгортає поля 1:1', () => {
    const n = parseNews(raw)
    expect(n.id).toBe('n1')
    expect(n.category).toBe('promo')
    expect(n.isPromoted).toBe(true)
  })
  it('venueId/imageUrl null-сейф', () => {
    const n = parseNews({ ...raw, venueId: null, imageUrl: null, isPromoted: undefined as never })
    expect(n.venueId).toBeNull()
    expect(n.imageUrl).toBeNull()
    expect(n.isPromoted).toBe(false)
  })
})
