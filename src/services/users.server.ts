import 'server-only'

import { serverFetch, serverFetchList } from '@/lib/api/server-client'
import type { RawAdminUser } from '@/types/admin'
import type { SessionTokens } from '@/lib/auth/session'

/** Мій профіль (/me) — поля профілю для форми кабінету. */
export function getMyProfile<T>(tokens: SessionTokens | null): Promise<{ profile: T }> {
  return serverFetch<{ profile: T }>('/me', { tokens, revalidate: 0 })
}

/** Список користувачів для адмінки (пагінація). */
export function getAdminUsersPage(page: number, tokens: SessionTokens | null) {
  return serverFetchList<RawAdminUser>(`/admin/users?page=${page}`, { tokens, revalidate: 0 })
}

/** Один користувач для адмін-деталки; null → notFound на сторінці. */
export function getAdminUser(id: string, tokens: SessionTokens | null) {
  return serverFetch<RawAdminUser>(`/admin/users/${id}`, { tokens, revalidate: 0 }).catch(() => null)
}