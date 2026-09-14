import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/auth/session', () => ({
  getSessionTokens: vi.fn(async () => ({ accessToken: 'a', refreshToken: 'r' })),
}))

const serverFetchList = vi.fn()
vi.mock('@/lib/api/server-client', () => ({
  serverFetchList: (...args: unknown[]) => serverFetchList(...args),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

// Острови — клієнтські (useToast/useRouter): у статичному рендері сторінки
// заміняємо їх заглушками з venueId у тексті
vi.mock('@/components/features/admin/venue-approve-button', async () => ({
  VenueApproveButton: ({ venueId }: { venueId: string }) => createElement('span', null, `approve:${venueId}`),
}))
vi.mock('@/components/features/admin/venue-reject-button', async () => ({
  VenueRejectButton: ({ venueId }: { venueId: string }) => createElement('span', null, `reject:${venueId}`),
}))

import AdminVenuesPage from '@/app/admin/venues/page'
import { getSessionTokens } from '@/lib/auth/session'
import type { RawVenue } from '@/types/venue'

const rawVenue = (overrides: Partial<RawVenue> = {}): RawVenue => ({
  id: 'v1',
  ownerId: 'o1',
  name: 'Кнайпа «У Пана»',
  description: null,
  address: 'вул. Хрещатик, 1',
  latitude: null,
  longitude: null,
  contacts: {},
  workingHours: {},
  averageCheck: null,
  mainPhotoUrl: null,
  status: 'pending',
  ratingAvg: null,
  ratingCount: 0,
  viewCount: 0,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  ...overrides,
})

async function renderPage(searchParams: { page?: string } = {}): Promise<string> {
  return renderToStaticMarkup(await AdminVenuesPage({ searchParams: Promise.resolve(searchParams) }))
}

describe('/admin/venues — черга модерації', () => {
  beforeEach(() => {
    serverFetchList.mockReset()
    vi.mocked(getSessionTokens).mockResolvedValue({ accessToken: 'a', refreshToken: 'r' })
    serverFetchList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, hasMore: false } })
  })

  it('page=1: GET /admin/venues/pending?page=1 → назви, адреса, дата, статус, острови', async () => {
    serverFetchList.mockResolvedValue({
      data: [
        rawVenue(),
        rawVenue({ id: 'v2', name: 'Бар «Двадцять»', address: 'вул. Саївська, 20' }),
      ],
      meta: { page: 1, limit: 20, total: 2, hasMore: false },
    })
    const html = await renderPage()
    expect(serverFetchList).toHaveBeenCalledWith('/admin/venues/pending?page=1', {
      tokens: { accessToken: 'a', refreshToken: 'r' },
      revalidate: 0,
    })
    expect(html).toContain('Кнайпа «У Пана»')
    expect(html).toContain('Бар «Двадцять»')
    expect(html).toContain('вул. Хрещатик, 1')
    // VENUE_STATUS_LABELS.pending
    expect(html).toContain('На модерації')
    // formatDate від 2026-09-01
    expect(html).toContain('вересня')
    expect(html).toContain('approve:v1')
    expect(html).toContain('reject:v2')
    // pending-рядки — без посилань на публічний заклад
    expect(html).not.toContain('href="/venues/')
  })

  it('searchParams.page → ?page=N у запиті і в hrefFor', async () => {
    serverFetchList.mockResolvedValue({
      data: [rawVenue()],
      meta: { page: 2, limit: 20, total: 45, hasMore: true },
    })
    const html = await renderPage({ page: '2' })
    expect(serverFetchList).toHaveBeenCalledWith('/admin/venues/pending?page=2', {
      tokens: { accessToken: 'a', refreshToken: 'r' },
      revalidate: 0,
    })
    expect(html).toContain('/admin/venues?page=3')
  })

  it('meta.total > limit → навігація Pagination (totalPages без meta.totalPages)', async () => {
    serverFetchList.mockResolvedValue({
      data: [rawVenue()],
      meta: { page: 1, limit: 20, total: 45, hasMore: true },
    })
    const html = await renderPage()
    expect(html).toContain('aria-label="Пагінація"')
    expect(html).toContain('/admin/venues?page=2')
  })

  it('meta.total <= limit → Pagination повертає null (без навігації)', async () => {
    serverFetchList.mockResolvedValue({
      data: [rawVenue()],
      meta: { page: 1, limit: 20, total: 1, hasMore: false },
    })
    const html = await renderPage()
    expect(html).not.toContain('aria-label="Пагінація"')
  })

  it('порожня черга → повідомлення про відсутність заявок', async () => {
    const html = await renderPage()
    expect(html).toContain('Заявок на модерації немає.')
  })

  it('некоректний page → клампиться до 1', async () => {
    await renderPage({ page: '0' })
    expect(serverFetchList).toHaveBeenCalledWith('/admin/venues/pending?page=1', {
      tokens: { accessToken: 'a', refreshToken: 'r' },
      revalidate: 0,
    })
  })
})
