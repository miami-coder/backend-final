export interface RawVenueAnalytics {
  totalViews: string | number
  viewsByDay: { date: string; count: string | number }[]
  eventsByType: { eventType: string; count: string | number }[]
}

export interface VenueAnalytics {
  totalViews: number
  viewsByDay: { date: string; count: number }[]
  eventsByType: { eventType: string; count: number }[]
}

const num = (v: string | number): number => Number(v) || 0

export function parseVenueAnalytics(raw: RawVenueAnalytics): VenueAnalytics {
  return {
    totalViews: num(raw.totalViews),
    viewsByDay: (raw.viewsByDay ?? []).map((d) => ({ date: d.date, count: num(d.count) })),
    eventsByType: (raw.eventsByType ?? []).map((e) => ({ eventType: e.eventType, count: num(e.count) })),
  }
}
