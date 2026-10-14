// Клієнтський сервіс пиячків: створення від закладу, join/cancel/leave.

import { api, apiVoid } from '@/lib/api/client'

/** POST /venues/:venueId/hangouts — зустріч, яку організовує відвідувач закладу. */
export function createVenueHangout(venueId: string, data: unknown): Promise<unknown> {
  return api(`/venues/${venueId}/hangouts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
}

/** POST /hangouts/:id/join — приєднатися до зустрічі. */
export function joinHangout(hangoutId: string): Promise<void> {
  return apiVoid(`/hangouts/${hangoutId}/join`, { method: 'POST' })
}

/** POST /hangouts/:id/cancel | /hangouts/:id/leave — скасувати (творець) або вийти (учасник). */
export function hangoutAction(hangoutId: string, kind: 'cancel' | 'leave'): Promise<void> {
  return apiVoid(`/hangouts/${hangoutId}/${kind}`, { method: 'POST' })
}