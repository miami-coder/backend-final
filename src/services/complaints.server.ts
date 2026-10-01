import 'server-only'

import { serverFetchList } from '@/lib/api/server-client'
import type { RawComplaint } from '@/types/admin'
import type { SessionTokens } from '@/lib/auth/session'

/** Список скарг для адмінки (пагінація). */
export function getAdminComplaintsPage(page: number, tokens: SessionTokens | null) {
  return serverFetchList<RawComplaint>(`/admin/complaints?page=${page}`, { tokens, revalidate: 0 })
}

/** Скарги до закладу власника (вкладка кабінету; пагінація). */
export function getVenueComplaintsPage(venueId: string, page: number, tokens: SessionTokens | null) {
  return serverFetchList<RawComplaint>(`/me/venues/${venueId}/complaints?page=${page}`, { tokens, revalidate: 0 })
}