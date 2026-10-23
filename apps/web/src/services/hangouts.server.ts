import 'server-only'

import { serverFetch, serverFetchList } from '@/lib/api/server-client'
import type { RawHangout } from '@/types/hangout'
import type { SessionTokens } from '@/lib/auth/session'

/** Публічна стрічка пиячків з фільтрами (status/venueId/date); revalidate 0 —
 *  мутації (скасувати/покинути/видалити) мають бути видні одразу; api-сайд
 *  кешує відповідь сам з інвалідаціями. */
export function getHangouts(query: string) {
  return serverFetchList<RawHangout>(`/hangouts?${query}`, { revalidate: 0 })
}

/** Мої зустрічі з рольовим фільтром (created/joined). */
export function getMyHangouts(role: string, tokens: SessionTokens | null): Promise<RawHangout[]> {
  return serverFetch<RawHangout[]>(`/me/hangouts?role=${role}`, { tokens, revalidate: 0 })
}

/**
 * id зустрічей користувача (створені + приєднані) — для стану «В тусовці!»
 * у стрічці. Помилка (мережа/сесія) → порожня множина, кнопки лишаються «Приєднатися».
 */
export async function getMyHangoutIds(tokens: SessionTokens | null): Promise<Set<string>> {
  if (!tokens) return new Set()
  try {
    const mine = await getMyHangouts('all', tokens)
    return new Set(mine.map((h) => h.id))
  } catch {
    return new Set()
  }
}