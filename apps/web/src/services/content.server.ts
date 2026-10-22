import { serverFetch } from '@/lib/api/server-client'
import { getSessionTokens, type SessionTokens } from '@/lib/auth/session'
import type { SiteContentMap } from '@/services/content'

/**
 * Публічний GET /content — тексти сайту.
 * Увага: serverFetch вже розгортає {data}; другий .data
 * вертав undefined і валив сторінку адмінки.
 */
export async function getSiteContent(
  tokens?: SessionTokens | null,
): Promise<SiteContentMap> {
  return serverFetch<SiteContentMap>('/content', {
    tokens: tokens ?? (await getSessionTokens()),
    revalidate: 0,
  }).catch(() => ({ about: null, contacts: null }))
}