import 'server-only'

import { serverFetch, serverFetchList } from '@/lib/api/server-client'
import type { RawHangout } from '@/types/hangout'
import type { SessionTokens } from '@/lib/auth/session'

/** Публічна стрічка пиячків з фільтрами (status/venueId/date); revalidate 30. */
export function getHangouts(query: string) {
  return serverFetchList<RawHangout>(`/hangouts?${query}`, { revalidate: 30 })
}

/** Мої зустрічі з рольовим фільтром (created/joined). */
export function getMyHangouts(role: string, tokens: SessionTokens | null): Promise<RawHangout[]> {
  return serverFetch<RawHangout[]>(`/me/hangouts?role=${role}`, { tokens, revalidate: 0 })
}