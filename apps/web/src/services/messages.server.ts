import 'server-only'

import { serverFetchList } from '@/lib/api/server-client'
import type { RawMessage } from '@/types/message'
import type { SessionTokens } from '@/lib/auth/session'

/** Скринька власника: повідомлення користувачів про заклад. */
export function getVenueMessages(venueId: string, tokens: SessionTokens | null) {
  return serverFetchList<RawMessage>(`/me/venues/${venueId}/messages`, { tokens, revalidate: 0 })
}

/** Стрічка feedback-повідомлень для суперадміна (пагінація). */
export function getAdminFeedback(page: number, limit: number, tokens: SessionTokens | null) {
  return serverFetchList<RawMessage>(`/admin/messages/feedback?page=${page}&limit=${limit}`, {
    tokens,
    revalidate: 0,
  })
}