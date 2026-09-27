import 'server-only'

import { serverFetch, serverFetchList } from '@/lib/api/server-client'
import type { RawReview } from '@/types/review'
import type { SessionTokens } from '@/lib/auth/session'

/**
 * Відгуки закладу зі списку (серверний компонент ReviewList).
 * revalidate: 0 — свіжі відгуки одразу після нового відгуку.
 */
export function getVenueReviews(venueId: string, sort: string, page: number, limit: number) {
  return serverFetchList<RawReview>(`/venues/${venueId}/reviews?sort=${sort}&page=${page}&limit=${limit}`, {
    revalidate: 0,
  })
}

/** Усі мої відгуки (кабінет, вкладка «Відгуки»). */
export function getMyReviews(tokens: SessionTokens | null): Promise<RawReview[]> {
  return serverFetch<RawReview[]>('/me/reviews', { tokens, revalidate: 0 })
}

/**
 * Мій відгук на конкретний заклад (ендпоінту «мій відгук на X» немає —
 * шукаємо в /me/reviews); null, якщо закладу ще не оцінював.
 */
export async function findMyReviewForVenue(venueId: string, tokens: SessionTokens | null) {
  const mine = await serverFetchList<{ id: string; venueId: string; rating: number; text: string }>(
    '/me/reviews?limit=100',
    { tokens, revalidate: 0 },
  )
  return mine.data.find((r) => r.venueId === venueId) ?? null
}

/** Список відгуків для адмінки (пагінація, фільтр за закладом). */
export function getAdminReviewsPage(page: number, limit: number, venueQuery: string, tokens: SessionTokens | null) {
  return serverFetchList<RawReview>(`/admin/reviews?page=${page}&limit=${limit}${venueQuery}`, {
    tokens,
    revalidate: 0,
  })
}