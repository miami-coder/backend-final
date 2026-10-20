import { serverFetch } from '@/lib/api/server-client'
import { getSessionTokens, type SessionTokens } from '@/lib/auth/session'
import type { TopCategoryAdmin } from '@/services/venues'

/**
 * Адмін-список Топу: GET /admin/top/categories (user:manage).
 * Увага (ревʼю Stage 4 C1): serverFetch вже розгортає {data} — подвійний
 * .data робив список завжди порожнім.
 */
export async function getTopAdmin(
  tokens?: SessionTokens | null,
): Promise<TopCategoryAdmin[]> {
  return serverFetch<TopCategoryAdmin[]>('/admin/top/categories', {
    tokens: tokens ?? (await getSessionTokens()),
    revalidate: 0,
  }).catch(() => [])
}