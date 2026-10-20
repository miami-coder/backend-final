import { serverFetch } from '@/lib/api/server-client'
import { getSessionTokens, type SessionTokens } from '@/lib/auth/session'
import type { TopCategoryAdmin } from '@/services/venues'

/** Адмін-список Топу: GET /admin/top/categories (user:manage). */
export async function getTopAdmin(
  tokens?: SessionTokens | null,
): Promise<TopCategoryAdmin[]> {
  const res = await serverFetch<{ data: TopCategoryAdmin[] }>(
    '/admin/top/categories',
    { tokens: tokens ?? (await getSessionTokens()), revalidate: 0 },
  ).catch(() => ({ data: [] as TopCategoryAdmin[] }))
  return res.data ?? []
}