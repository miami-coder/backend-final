import 'server-only'

import { serverFetchList } from '@/lib/api/server-client'
import type { RawComplaint } from '@/types/admin'
import type { SessionTokens } from '@/lib/auth/session'

/** Список скарг для адмінки (пагінація). */
export function getAdminComplaintsPage(page: number, tokens: SessionTokens | null) {
  return serverFetchList<RawComplaint>(`/admin/complaints?page=${page}`, { tokens, revalidate: 0 })
}