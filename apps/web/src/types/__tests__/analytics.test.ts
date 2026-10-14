import { describe, expect, it } from 'vitest'
import { EVENT_TYPE_LABELS, parseVenueAnalytics } from '@/types/analytics'

describe('parseVenueAnalytics', () => {
  it('конвертує рядкові numeric у number', () => {
    const a = parseVenueAnalytics({
      totalViews: '8',
      viewsByDay: [{ date: '2026-09-22', count: '3' }],
      eventsByType: [{ eventType: 'review_created', count: '6' }],
    })
    expect(a.totalViews).toBe(8)
    expect(a.viewsByDay[0]).toEqual({ date: '2026-09-22', count: 3 })
    expect(a.eventsByType[0]).toEqual({ eventType: 'review_created', count: 6 })
  })
})

describe('EVENT_TYPE_LABELS', () => {
  it('усі типи подій з бекенда мають людські лейбли', () => {
    for (const t of ['venue_created', 'venue_status_changed', 'review_created', 'hangout_filled']) {
      expect(EVENT_TYPE_LABELS[t], t).toBeTruthy()
    }
    expect(EVENT_TYPE_LABELS['review_created']).toBe('Новий відгук')
  })
})