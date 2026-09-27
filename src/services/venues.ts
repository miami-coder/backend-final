// Клієнтський сервіс закладів: теги, перегляди, CRUD, фото, обране.
// Обгортки над api()/apiVoid() з src/lib/api/client — опції запитів живуть тут.

import { api, apiList, apiVoid } from '@/lib/api/client'

/** Довідник тегів для чипів (GET /venues/tags — публічний). */
export interface TagRef {
  id: string
  name: string
  slug: string
  venueCount: number
}

/** Довідник тегів GET /venues/tags — публічний ендпоінт, без авторизації. */
export async function getVenueTags(): Promise<TagRef[]> {
  const res = await apiList<TagRef>('/venues/tags')
  return res.data
}

/**
 * POST /venues/:id/view — фіксація перегляду. Fire-and-forget: рекордер нічого
 * не рендерить, мережева помилка не має ніяк позначатись на UI, тому тіхає тут.
 */
export function recordVenueView(venueId: string, sessionId: string): void {
  fetch(`/api/v1/venues/${venueId}/view`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId: sessionId.slice(0, 64) }),
  }).catch(() => {})
}

/** POST /venues — створення закладу; повертає id для подальшого завантаження фото. */
export function createVenue(data: unknown): Promise<{ id: string } | undefined> {
  // content-type обовʼязковий: BFF-проксі не проставляє його сам
  return api<{ id: string }>('/venues', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
}

/** PATCH /venues/:id — редагування закладу власником. */
export function updateVenue(venueId: string, data: unknown): Promise<unknown> {
  // content-type обовʼязковий: BFF-проксі не проставляє його сам
  return api(`/venues/${venueId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
}

/** POST /venues/:id/photos — multipart (браузер сам ставить boundary — без content-type). */
export function uploadVenuePhoto(venueId: string, file: File): Promise<unknown> {
  const fd = new FormData()
  fd.append('file', file)
  return api(`/venues/${venueId}/photos`, { method: 'POST', body: fd })
}

/** DELETE /venues/:id — м'яке видалення (бекенд: статус Archived). */
export function deleteVenue(venueId: string): Promise<void> {
  return apiVoid(`/venues/${venueId}`, { method: 'DELETE' })
}

/** POST /me/favorites/:venueId — додати в обране (200 з порожнім тілом). */
export function addFavorite(venueId: string): Promise<unknown> {
  return api(`/me/favorites/${venueId}`, { method: 'POST' })
}

/** DELETE /me/favorites/:venueId — прибрати з обраного (200 з порожнім тілом). */
export function removeFavorite(venueId: string): Promise<void> {
  return apiVoid(`/me/favorites/${venueId}`, { method: 'DELETE' })
}

// --- адмінські дії над закладами (суперадмін) ---

/** POST /admin/venues/:id/approve — бекенд approve приймає запит без тіла. */
export function approveVenue(venueId: string): Promise<unknown> {
  return api(`/admin/venues/${venueId}/approve`, { method: 'POST' })
}

/** POST /admin/venues/:id/reject — відхилення з причиною (тіло '{}'). */
export function rejectVenue(venueId: string): Promise<unknown> {
  return api(`/admin/venues/${venueId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
}

/** POST /admin/venues/:id/assign-owner — призначити власника. */
export function assignVenueOwner(venueId: string, userId: string): Promise<unknown> {
  return api(`/admin/venues/${venueId}/assign-owner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
}