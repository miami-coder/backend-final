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

import ManageVenuePage from '@/app/account/venues/[id]/page'

const rawVenue = {
  id: 'v1', ownerId: 'u1', name: 'Бар «Пиво»', description: null, address: 'вул. Липова, 1',
  latitude: '50.45', longitude: '30.52', contacts: {}, workingHours: {}, averageCheck: '250',
  mainPhotoUrl: null, status: 'pending', ratingAvg: '4.5', ratingCount: 2, viewCount: 10,
  createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z', photos: [],
}

const tokens = { accessToken: 'a', refreshToken: 'r' }

async function renderPage(tab?: string) {
  return renderToStaticMarkup(
    // Next.js 16: params/searchParams — Promises
    await ManageVenuePage({
      params: Promise.resolve({ id: 'v1' }),
      searchParams: Promise.resolve(tab ? { tab } : {}),
    }),
  )
}

describe('/account/venues/[id]', () => {
  beforeEach(() => {
    serverFetch.mockReset()
    serverFetch.mockResolvedValue(rawVenue)
    editProps = null
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

  it('?tab=photos → плейсхолдер замість форми', async () => {
    const html = await renderPage('photos')
    expect(html).toContain('Розділ у розробці')
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

  it('без сесії → redirect на логін', async () => {
    const { getSessionTokens } = await import('@/lib/auth/session')
    vi.mocked(getSessionTokens).mockResolvedValueOnce(null)
    await expect(renderPage()).rejects.toThrow('REDIRECT:/auth/login?next=/account/venues')
    expect(serverFetch).not.toHaveBeenCalled()
  })
})
