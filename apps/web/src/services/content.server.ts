import { serverFetch } from '@/lib/api/server-client'
import { getSessionTokens, type SessionTokens } from '@/lib/auth/session'
import type { SiteContentMap } from '@/services/content'

/** Публічний GET /content — тексти сайту. */
export async function getSiteContent(
  tokens?: SessionTokens | null,
): Promise<SiteContentMap> {
  const res = await serverFetch<{ data: SiteContentMap }>('/content', {
    tokens: tokens ?? (await getSessionTokens()),
    revalidate: 0,
  }).catch(() => ({ data: { about: null, contacts: null } as SiteContentMap }))
  return res.data
}
