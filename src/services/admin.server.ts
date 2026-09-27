import 'server-only'

import { serverFetch, serverFetchList } from '@/lib/api/server-client'
import type { SessionTokens } from '@/lib/auth/session'

interface RawOverview {
  totalViews: number
  totalEvents: number
  eventsByType: { eventType: string; count: number }[]
}

/**
 * Огляд адмінки: плитки аналітики (overview падає тихо → «—») + лічильники
 * секцій із meta.total (limit=1 — потрібен лише лічильник, не записи).
 */
export async function getAdminOverview(tokens: SessionTokens | null) {
  const [overview, venues, users, complaints, news] = await Promise.all([
    serverFetch<RawOverview>('/admin/analytics/overview', { tokens, revalidate: 0 }).catch(() => null),
    serverFetchList('/admin/venues/pending?limit=1', { tokens, revalidate: 0 }),
    serverFetchList('/admin/users?limit=1', { tokens, revalidate: 0 }),
    serverFetchList('/admin/complaints?limit=1', { tokens, revalidate: 0 }),
    serverFetchList('/admin/news?limit=1', { tokens, revalidate: 0 }),
  ])
  return { overview, venues, users, complaints, news }
}

/** Таймсерія подій аналітики за період і гранулярністю; null → сторінка показує «—». */
export function getAnalyticsTimeseries<T>(from: string, to: string, granularity: string, tokens: SessionTokens | null) {
  return serverFetch<T[]>(`/admin/analytics/timeseries?from=${from}&to=${to}&granularity=${granularity}`, {
    tokens,
    revalidate: 0,
  }).catch(() => null)
}

/** Топ закладів за подіями; null → сторінка показує «—». */
export function getAnalyticsVenues<T>(query: string, tokens: SessionTokens | null) {
  return serverFetch<T[]>(`/admin/analytics/venues?${query}&limit=50`, { tokens, revalidate: 0 }).catch(() => null)
}