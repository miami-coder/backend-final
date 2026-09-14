import { renderToStaticMarkup } from 'react-dom/server'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { VenueAnalytics } from '@/components/features/account/venue-analytics'
import { AnalyticsRangeForm } from '@/components/features/account/analytics-range-form'

vi.mock('@/lib/auth/session', () => ({
  getSessionTokens: vi.fn(async () => ({ accessToken: 'a', refreshToken: 'r' })),
}))
const serverFetch = vi.fn()
vi.mock('@/lib/api/server-client', () => ({ serverFetch: (...args: unknown[]) => serverFetch(...args) }))

// AnalyticsRangeForm — клієнтський: useRouter поза app-router-контекстом
// (renderToStaticMarkup) кидає «invariant expected app router to be mounted»
const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: (url: string) => push(url) }) }))

describe('VenueAnalytics (server)', () => {
  beforeEach(() => {
    serverFetch.mockReset()
  })

  it('рендер stat-плитки, SVG-барів і eventsByType', async () => {
    serverFetch.mockResolvedValue({
      totalViews: 42,
      viewsByDay: [{ date: '2026-09-09', count: 12 }, { date: '2026-09-10', count: 30 }],
      eventsByType: [{ eventType: 'venue_view', count: 30 }, { eventType: 'review_create', count: 2 }],
    })
    const html = renderToStaticMarkup(
      await VenueAnalytics({ venueId: 'v1', from: '2026-09-01', to: '2026-09-10' }),
    )
    expect(html).toContain('42')
    expect(html).toContain('<svg')
    expect(html).toContain('venue_view')
    expect(serverFetch).toHaveBeenCalledWith('/me/venues/v1/analytics?from=2026-09-01&to=2026-09-10', expect.anything())
  })

  it('порожні дані → «Немає даних»', async () => {
    serverFetch.mockResolvedValue({ totalViews: 0, viewsByDay: [], eventsByType: [] })
    const html = renderToStaticMarkup(
      await VenueAnalytics({ venueId: 'v1', from: '2026-09-01', to: '2026-09-10' }),
    )
    expect(html).toContain('Немає даних')
  })
})

describe('AnalyticsRangeForm (client)', () => {
  it('сабміт → router.push(?tab=analytics&from&to)', () => {
    render(<AnalyticsRangeForm from="2026-09-01" to="2026-09-10" />)
    fireEvent.submit(screen.getByRole<HTMLButtonElement>('button', { name: 'Оновити' }).form as HTMLFormElement)
    expect(push).toHaveBeenCalledWith('?tab=analytics&from=2026-09-01&to=2026-09-10')
  })

  it('from > to → push не викликається', () => {
    render(<AnalyticsRangeForm from="2026-09-10" to="2026-09-01" />)
    fireEvent.submit(screen.getByRole<HTMLButtonElement>('button', { name: 'Оновити' }).form as HTMLFormElement)
    expect(push).not.toHaveBeenCalled()
  })
})
