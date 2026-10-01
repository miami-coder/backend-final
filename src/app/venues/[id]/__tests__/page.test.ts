import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Venue } from '@/types/venue'
import type { RawNews } from '@/types/news'

const getVenueDetail = vi.fn()
const getFavoriteIds = vi.fn()
vi.mock('@/services/venues.server', () => ({
  getVenueDetail: (...args: unknown[]) => getVenueDetail(...args),
  getFavoriteIds: (...args: unknown[]) => getFavoriteIds(...args),
}))

const getVenueNews = vi.fn()
vi.mock('@/services/news.server', () => ({ getVenueNews: (...args: unknown[]) => getVenueNews(...args) }))

vi.mock('@/lib/auth/session', () => ({ getSessionTokens: async () => null }))

// ReviewList робить власні фетчі — у тесті не потрібні
vi.mock('@/components/features/venues/review-list', () => ({ ReviewList: () => null }))

// Клієнтські кнопки тягнуть useUser (потрібен провайдер) — у цьому тесті не їх перевіряємо
vi.mock('@/components/features/venues/favorite-button', () => ({ FavoriteButton: () => null }))
vi.mock('@/components/features/venues/route-button', () => ({ RouteButton: () => null }))
vi.mock('@/components/features/venues/view-recorder', () => ({ ViewRecorder: () => null }))
vi.mock('@/components/features/venues/review-form', () => ({ ReviewForm: () => null }))
vi.mock('@/components/features/hangouts/hangout-button', () => ({ HangoutButton: () => null }))
vi.mock('@/components/features/messages/message-to-manager-button', () => ({ MessageToManagerButton: () => null }))
vi.mock('@/components/features/complaints/complaint-button', () => ({ ComplaintButton: () => null }))

import VenuePage from '@/app/venues/[id]/page'

const venue = {
  id: 'v1',
  name: 'Алкашура',
  address: 'вул. Хрещатик, 1',
  ratingAvg: 4.5,
  ratingCount: 2,
  averageCheck: 200,
  mainPhotoUrl: null,
  photos: [],
  types: [],
  tags: [],
  features: [],
  workingHours: {},
  contacts: {},
  description: 'Тут смачно',
} as unknown as Venue

const rawNews = {
  id: 'n1', venueId: 'v1', category: 'general', title: 'Акустика у пʼятницю', content: 'Текст новини',
  imageUrl: '/static/a.png', status: 'published', isPromoted: false,
  publishedAt: '2026-09-28T10:00:00Z', createdAt: '2026-09-28T10:00:00Z', updatedAt: '2026-09-28T10:00:00Z',
} satisfies RawNews

describe('/venues/[id] — новини закладу', () => {
  beforeEach(() => {
    getVenueDetail.mockReset().mockResolvedValue(venue)
    getFavoriteIds.mockReset().mockResolvedValue(new Set<string>())
    getVenueNews.mockReset().mockResolvedValue({ data: [rawNews], meta: { page: 1, limit: 20, total: 1, hasMore: false } })
  })

  it('рендерить секцію «Новини закладу» з посиланням на конкретну новину', async () => {
    const html = renderToStaticMarkup(await VenuePage({ params: Promise.resolve({ id: 'v1' }), searchParams: Promise.resolve({}) }))
    expect(html).toContain('Новини закладу')
    expect(html).toContain('Акустика у пʼятницю')
    expect(html).toContain('/news/n1')
    // звʼязок із саме цим закладом: запит віддає venueId-фільтр
    expect(getVenueNews).toHaveBeenCalledWith('v1', null)
  })

  it('немає новин → секції «Новини закладу» не існує', async () => {
    getVenueNews.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, hasMore: false } })
    const html = renderToStaticMarkup(await VenuePage({ params: Promise.resolve({ id: 'v1' }), searchParams: Promise.resolve({}) }))
    expect(html).not.toContain('Новини закладу')
  })
})