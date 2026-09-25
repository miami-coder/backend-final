import { createElement } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/auth/session', () => ({
  getSessionTokens: vi.fn(async () => ({ accessToken: 'a', refreshToken: 'r' })),
}))

const serverFetch = vi.fn()
vi.mock('@/lib/api/server-client', () => ({
  serverFetch: (...args: unknown[]) => serverFetch(...args),
}))

const redirect = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) })
const notFound = vi.fn(() => { throw new Error('NOT_FOUND') })
vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirect(url),
  notFound: () => notFound(),
}))

// VenueEditForm — клієнтський компонент із контекстами; у серверному тесті
// мокаємо заглушкою і ловимо пропси (перевіряємо, що venue долетів)
let editProps: { venue: { id: string } } | null = null
vi.mock('@/components/features/account/venue-edit-form', () => ({
  VenueEditForm: (props: { venue: { id: string } }) => {
    editProps = props
    return createElement('div', null, `EDIT-FORM:${props.venue.id}`)
  },
}))

// VenuePhotoManager — клієнтський компонент; заглушка ловить пропси
let photoProps: { venueId: string; photos: { id: string }[] } | null = null
vi.mock('@/components/features/account/venue-photo-manager', () => ({
  VenuePhotoManager: (props: { venueId: string; photos: { id: string }[] }) => {
    photoProps = props
    return createElement('div', null, `PHOTO-MANAGER:${props.venueId}:${props.photos.length}`)
  },
}))

// VenueDeleteButton — клієнтський компонент; заглушка (вимагає ToastProvider)
vi.mock('@/components/features/venues/venue-delete-button', () => ({
  VenueDeleteButton: ({ venueId }: { venueId: string }) =>
    createElement('span', null, `delete:${venueId}`),
}))

// VenueAnalytics — серверний компонент; заглушка ловить пропси
// (from/to з searchParams або дефолтний 30-денний період)
let analyticsProps: { venueId: string; from: string; to: string } | null = null
vi.mock('@/components/features/account/venue-analytics', () => ({
  VenueAnalytics: (props: { venueId: string; from: string; to: string }) => {
    analyticsProps = props
    return createElement('div', null, `ANALYTICS:${props.venueId}:${props.from}:${props.to}`)
  },
}))

import ManageVenuePage from '@/app/account/venues/[id]/page'

const rawVenue = {
  id: 'v1', ownerId: 'u1', name: 'Бар «Пиво»', description: null, address: 'вул. Липова, 1',
  latitude: '50.45', longitude: '30.52', contacts: {}, workingHours: {}, averageCheck: '250',
  mainPhotoUrl: null, status: 'pending', ratingAvg: '4.5', ratingCount: 2, viewCount: 10,
  createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
  photos: [{ id: 'p1', venueId: 'v1', url: '/static/a.jpg', sortOrder: 0 }],
}

const tokens = { accessToken: 'a', refreshToken: 'r' }

async function renderPage(tab?: string, extra: Record<string, string> = {}) {
  const sp: Record<string, string> = { ...extra }
  if (tab) sp.tab = tab
  return renderToStaticMarkup(
    // Next.js 16: params/searchParams — Promises
    await ManageVenuePage({
      params: Promise.resolve({ id: 'v1' }),
      searchParams: Promise.resolve(sp),
    }),
  )
}

describe('/account/venues/[id]', () => {
  beforeEach(() => {
    serverFetch.mockReset()
    serverFetch.mockResolvedValue(rawVenue)
    editProps = null
    photoProps = null
    analyticsProps = null
    redirect.mockClear()
    notFound.mockClear()
  })

  it('default (?tab= порожній) → вкладки + VenueEditForm з venue + статус-лейбл', async () => {
    const html = await renderPage()
    expect(editProps?.venue.id).toBe('v1')
    expect(html).toContain('На модерації')
    // публічна сторінка + усі вкладки присутні
    expect(html).toContain('href="/venues/v1"')
    expect(html).toContain('href="/account/venues/v1?tab=photos"')
    expect(html).toContain('href="/account/venues/v1?tab=news"')
    expect(html).toContain('href="/account/venues/v1?tab=analytics"')
    expect(serverFetch).toHaveBeenCalledWith('/me/venues/v1', { tokens, revalidate: 0 })
  })

  it('?tab=photos → VenuePhotoManager з venue.id і фото замість форми', async () => {
    const html = await renderPage('photos')
    expect(photoProps?.venueId).toBe('v1')
    expect(photoProps?.photos).toHaveLength(1)
    expect(html).toContain('PHOTO-MANAGER:v1:1')
    expect(html).not.toContain('EDIT-FORM')
  })

  it('невідомий tab → default edit', async () => {
    const html = await renderPage('bogus')
    expect(html).toContain('EDIT-FORM:v1')
  })

  it('serverFetch падає (403/404/мережа) → notFound()', async () => {
    serverFetch.mockRejectedValue(new Error('FORBIDDEN'))
    await expect(renderPage()).rejects.toThrow('NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })

  it('?tab=analytics → VenueAnalytics з дефолтним періодом (to=сьогодні, from=−30 днів)', async () => {
    const html = await renderPage('analytics')
    expect(analyticsProps?.venueId).toBe('v1')
    expect(analyticsProps?.to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // en-CA-формат: to − from ≈ 30 днів (±1 через північ)
    const ms = (Date.parse(`${analyticsProps?.to}T00:00:00Z`) - Date.parse(`${analyticsProps?.from}T00:00:00Z`)) / 86400000
    expect(Math.round(ms)).toBe(30)
    expect(html).toContain('ANALYTICS:v1:')
  })

  it('?tab=analytics&from&to → діапазон із URL передається без змін', async () => {
    await renderPage('analytics', { from: '2026-09-01', to: '2026-09-10' })
    expect(analyticsProps).toEqual({ venueId: 'v1', from: '2026-09-01', to: '2026-09-10' })
  })

  it('без сесії → redirect на логін', async () => {
    const { getSessionTokens } = await import('@/lib/auth/session')
    vi.mocked(getSessionTokens).mockResolvedValueOnce(null)
    await expect(renderPage()).rejects.toThrow('REDIRECT:/auth/login?next=/account/venues')
    expect(serverFetch).not.toHaveBeenCalled()
  })
})
