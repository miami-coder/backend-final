import 'server-only'

import { serverFetch } from '@/lib/api/server-client'
import type { SessionTokens } from '@/lib/auth/session'
import type { SessionUser } from '@/types/user'

/**
 * GET /auth/me з токенами сесії — єдиний серверний виклик, яким усі
 * layout-и (root/account/admin) розв'язують користувача. revalidate: 0,
 * бо сесія має бути щохвилинно свіжою.
 */
export function getMeSession(tokens: SessionTokens): Promise<SessionUser> {
  return serverFetch<SessionUser>('/auth/me', { tokens, revalidate: 0 })
}