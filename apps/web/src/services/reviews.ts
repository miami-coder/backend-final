// Клієнтський сервіс відгуків: створення (multipart із фото чеку), правка, видалення,
// виділення/зняття виділення критиком.

import { api, apiVoid } from '@/lib/api/client'
import { ApiError } from '@/lib/api/parse'

/**
 * POST /venues/:venueId/reviews — новий відгук. Тіло multipart (rating, text,
 * checkPhoto): браузер сам ставить boundary, тому сирий fetch БЕЗ content-type.
 * !ok → ApiError з message тіла (може бути не-JSON).
 */
export async function createVenueReview(venueId: string, fd: FormData): Promise<void> {
  const res = await fetch(`/api/v1/venues/${venueId}/reviews`, { method: 'POST', body: fd })
  if (!res.ok) throw new ApiError(res.status, 'ERROR', await reviewErrorMessage(res))
}

/** PATCH /reviews/:id — правка власного відгуку (rating + text, JSON). */
export function updateReview(reviewId: string, data: { rating: number; text: string }): Promise<unknown> {
  return api(`/reviews/${reviewId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
}

/** DELETE /reviews/:id → 200 з порожнім тілом (parseEmpty через apiVoid). */
export function deleteReview(reviewId: string): Promise<void> {
  return apiVoid(`/reviews/${reviewId}`, { method: 'DELETE' })
}

/** POST /reviews/:id/feature — виділити відгук (право review:feature: критик або супер-адмін). */
export function featureReview(reviewId: string): Promise<unknown> {
  return api(`/reviews/${reviewId}/feature`, { method: 'POST' })
}

/** DELETE /reviews/:id/feature — зняти виділення (200 з data — звичайний api). */
export function unfeatureReview(reviewId: string): Promise<unknown> {
  return api(`/reviews/${reviewId}/feature`, { method: 'DELETE' })
}

// витягнути message з помилкового тіла (може бути не-JSON)
async function reviewErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.clone().json()) as { error?: { message?: string } } | null
    return body?.error?.message ?? 'Сервіс тимчасово недоступний'
  } catch {
    return 'Сервіс тимчасово недоступний'
  }
}