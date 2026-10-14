import 'server-only'

import { serverFetch, serverFetchList } from '@/lib/api/server-client'
import { parseNews, type News, type RawNews } from '@/types/news'
import type { SessionTokens } from '@/lib/auth/session'

/**
 * Публічна стрічка новин (пагінація + категорія); revalidate 60 — протерміновано.
 */
export function getNewsPage(page: number, limit: number, category?: string) {
  const categoryPart = category ? `&category=${category}` : ''
  return serverFetchList<RawNews>(`/news?page=${page}&limit=${limit}${categoryPart}`, { revalidate: 60 })
}

/**
 * Публічна деталка новини: бекенд віддає і draft/archived зі статусом 200 —
 * мусить показувати лише published; null → notFound на сторінці.
 */
export async function getPublishedNews(id: string): Promise<News | null> {
  const raw = await serverFetch<RawNews>(`/news/${id}`, { revalidate: 60 }).catch(() => null)
  return raw && raw.status === 'published' ? parseNews(raw) : null
}

/** Публічний список /news?venueId= → only published (заархівовані зникають). */
export function getVenueNews(venueId: string, tokens: SessionTokens | null) {
  return serverFetchList<RawNews>(`/news?venueId=${venueId}`, { tokens, revalidate: 0 })
}

/** Список новин для адмінки (опційний фільтр статусу, пагінація). */
export function getAdminNewsPage(page: number, limit: number, status: string | undefined, tokens: SessionTokens | null) {
  const statusQuery = status ? `&status=${status}` : ''
  return serverFetchList<RawNews>(`/admin/news?page=${page}${statusQuery}`, { tokens, revalidate: 0 })
}