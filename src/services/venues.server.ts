import 'server-only'

import { serverFetch, serverFetchList } from '@/lib/api/server-client'
import { parseVenue, type RawVenue, type Venue } from '@/types/venue'
import type { RawFavoriteVenue } from '@/types/favorite'
import type { RawVenueAnalytics } from '@/types/analytics'
import type { SessionTokens } from '@/lib/auth/session'

/**
 * Деталі закладу зі збагаченням: GET /venues/:id не повертає
 * photos/tags/types/features (лише owner) — добираємо через list-пошук за
 * назвою; деградація тиха, якщо не знайшли. Повертає null, якщо заклад
 * недоступний (не-approved → 404 на бекенді).
 */
export async function getVenueDetail(id: string, revalidate = 60): Promise<Venue | null> {
  // Авторитетне джерело з 404-семантикою (не-approved → 404 на бекенді)
  const detail = await serverFetch<RawVenue>(`/venues/${id}`, { revalidate }).catch(() => null)
  if (!detail) return null

  let relations: RawVenue | null = null
  try {
    const list = await serverFetchList<RawVenue>(`/venues?q=${encodeURIComponent(detail.name)}&limit=100`, {
      revalidate,
    })
    relations = list.data.find((v) => v.id === detail.id) ?? null
  } catch {
    relations = null
  }

  return parseVenue(relations ?? detail)
}

/** Каталог закладів (головна сторінка); meta потрібна пагінації. */
export function getVenuesCatalog(query: string) {
  return serverFetchList<RawVenue>(`/venues?${query}`, { revalidate: 60 })
}

/** Список закладів поточного власника (кабінет). */
export function getMyVenues(tokens: SessionTokens | null): Promise<RawVenue[]> {
  return serverFetch<RawVenue[]>('/me/venues', { tokens, revalidate: 0 })
}

/** Заклад поточного власника (вкладка керування). */
export function getOwnerVenue(id: string, tokens: SessionTokens | null): Promise<RawVenue> {
  return serverFetch<RawVenue>(`/me/venues/${id}`, { tokens, revalidate: 0 })
}

/** Аналітика закладу власника за період. */
export function getVenueAnalytics(venueId: string, from: string, to: string, tokens: SessionTokens | null): Promise<RawVenueAnalytics> {
  return serverFetch<RawVenueAnalytics>(`/me/venues/${venueId}/analytics?from=${from}&to=${to}`, {
    tokens,
    revalidate: 0,
  })
}

/** Сторінка обраного користувача (кабінет, пагінація). */
export function getFavoritesPage(tokens: SessionTokens | null, page: number, limit: number) {
  return serverFetchList<RawFavoriteVenue>(`/me/favorites?page=${page}&limit=${limit}`, {
    tokens,
    revalidate: 0,
  })
}

/** id закладів в обраному (ендпоінту «чи в обраному» немає — шукаємо проекцією списку). */
export async function getFavoriteIds(tokens: SessionTokens | null): Promise<Set<string>> {
  const favs = await serverFetchList<{ id: string }>('/me/favorites?limit=100', { tokens, revalidate: 0 })
  return new Set(favs.data.map((f) => f.id))
}