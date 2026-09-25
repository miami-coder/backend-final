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
vi.mock('@/components/features/admin/venue-assign-owner-button', async () => ({
  VenueAssignOwnerButton: ({ venueId }: { venueId: string }) => createElement('span', null, `assign-owner:${venueId}`),
}))
// м'яке видалення в рядку схвалених (клієнтський, вимагає ToastProvider)
vi.mock('@/components/features/venues/venue-delete-button', () => ({
  VenueDeleteButton: ({ venueId }: { venueId: string }) => createElement('span', null, `delete:${venueId}`),
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

async function renderPage(searchParams: { page?: string; tab?: string } = {}): Promise<string> {
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
    // formatDate від 2026-09-01
    expect(html).toContain('вересня')
    expect(html).toContain('approve:v1')
    expect(html).toContain('reject:v2')
    // assign-owner на заявках НЕ потрібен (творець вже власник) — кнопка лише в табі схвалених
    expect(html).not.toContain('assign-owner')
    // pending-рядки — без посилань на публічний заклад
    expect(html).not.toContain('href="/venues/')
  })

  it('таб «Схвалені»: GET /admin/venues/approved → лінки на публічні сторінки + передача керування', async () => {
    serverFetchList.mockResolvedValue({
      data: [
        rawVenue({
          id: 'v1',
          status: 'approved',
          owner: {
            id: 'o1',
            email: 'owner@test.dev',
            profile: { firstname: 'Остап', lastname: 'Бендер' },
          },
        }),
        rawVenue({ id: 'v2', status: 'approved', name: 'Бар «Двадцять»' }),
      ],
      meta: { page: 1, limit: 20, total: 2, hasMore: false },
    })
    const html = await renderPage({ tab: 'approved' })
    expect(serverFetchList).toHaveBeenCalledWith('/admin/venues/approved?page=1', {
      tokens: { accessToken: 'a', refreshToken: 'r' },
      revalidate: 0,
    })
    // схвалені — лінк на публічну сторінку є
    expect(html).toContain('href="/venues/v1"')
    expect(html).toContain('owner@test.dev')
    expect(html).toContain('Остап Бендер')
    // кнопка передачі керування з venueId (мок повертає assign-owner:<id>)
    expect(html).toContain('assign-owner:v1')
    expect(html).toContain('assign-owner:v2')
    // у схвалених немає модераторських дій
    expect(html).not.toContain('approve:v1')
    expect(html).not.toContain('reject:v1')
  })

  it('невідомий tab → зводиться до модерації', async () => {
    serverFetchList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, hasMore: false } })
    await renderPage({ tab: 'незнаю' })
    expect(serverFetchList).toHaveBeenCalledWith('/admin/venues/pending?page=1', {
      tokens: { accessToken: 'a', refreshToken: 'r' },
      revalidate: 0,
    })
  })

  it('картка заявки: опис, чек, контакти, графік, власник, фото, теги/фічі', async () => {
    serverFetchList.mockResolvedValue({
      data: [
        rawVenue({
          description: 'Старе місто, льох і живе пиво',
          contacts: { phone: '+380501234567', instagram: 'u_pana' },
          workingHours: { mon: '10:00-23:00' },
          averageCheck: '250.50',
          photos: [{ id: 'ph1', venueId: 'v1', url: '/static/venues/v1/ph.jpg', sortOrder: 0 }],
          owner: {
            id: 'o1',
            email: 'owner@test.dev',
            profile: { firstname: 'Остап', lastname: 'Бендер' },
          },
          featureAssignments: [
            { venueId: 'v1', featureId: 'f1', feature: { id: 'f1', code: 'craft_beer', name: 'Крафтове пиво', icon: null } },
          ],
          venueTags: [{ venueId: 'v1', tagId: 't1', tag: { id: 't1', name: 'Бар', slug: 'bar' } }],
          venueTypeAssignments: [
            { venueId: 'v1', typeId: 'ty1', type: { id: 'ty1', name: 'Бар', slug: 'bar' } },
          ],
        }),
      ],
      meta: { page: 1, limit: 20, total: 1, hasMore: false },
    })
    const html = await renderPage()
    expect(html).toContain('Старе місто, льох і живе пиво')
    expect(html).toContain('250.5 грн')
    expect(html).toContain('+380501234567')
    expect(html).toContain('@u_pana')
    expect(html).toContain('Пн 10:00-23:00')
    expect(html).toContain('owner@test.dev')
    expect(html).toContain('Остап Бендер')
    expect(html).toContain('Крафтове пиво')
    expect(html).toContain('#bar')
    // головне фото — в превʼю картки
    expect(html).toContain('src="/static/venues/v1/ph.jpg"')
    expect(html).toContain('1 шт.')
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
    expect(html).toContain('/admin/venues?tab=moderation&amp;page=3')
  })

  it('meta.total > limit → навігація Pagination (totalPages без meta.totalPages)', async () => {
    serverFetchList.mockResolvedValue({
      data: [rawVenue()],
      meta: { page: 1, limit: 20, total: 45, hasMore: true },
    })
    const html = await renderPage()
    expect(html).toContain('aria-label="Пагінація"')
    expect(html).toContain('/admin/venues?tab=moderation&amp;page=2')
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
