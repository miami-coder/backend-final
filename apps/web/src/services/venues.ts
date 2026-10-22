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

export interface TypeRef {
  id: string
  name: string
  slug: string
}

export interface FeatureRef {
  id: string
  name: string
  code: string
  icon: string | null
}

/** Довідник типів закладів GET /venues/types — публічний. */
export async function getVenueTypes(): Promise<TypeRef[]> {
  const res = await apiList<TypeRef>('/venues/types')
  return res.data
}

/** Довідник особливостей GET /venues/features — публічний. */
export async function getVenueFeatures(): Promise<FeatureRef[]> {
  const res = await apiList<FeatureRef>('/venues/features')
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
/** POST /venues/:id/recommend — рекомендувати заклад (критик; 1 критик на заклад). */
export function recommendVenue(venueId: string): Promise<unknown> {
  return api(`/venues/${venueId}/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
}

/** DELETE /venues/:id/recommend — зняти рекомендацію (лише автор рекомендації). */
export function unrecommendVenue(venueId: string): Promise<void> {
  return apiVoid(`/venues/${venueId}/recommend`, { method: 'DELETE' })
}

// --- Топ закладів (редагує супер-адмін) ---

export interface TopCategoryAdmin {
  id: string
  title: string
  position: number
  entries: { id: string; venueId: string; position: number; venue?: { id: string; name: string } | null }[]
}

export function getTopAdmin(): Promise<TopCategoryAdmin[]> {
  return api<TopCategoryAdmin[]>('/admin/top/categories')
}

export function createTopCategory(title: string, position = 0): Promise<unknown> {
  return api('/admin/top/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, position }),
  })
}

export function updateTopCategory(
  id: string,
  data: { title?: string; position?: number },
): Promise<unknown> {
  return api(`/admin/top/categories/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function deleteTopCategory(id: string): Promise<unknown> {
  return api(`/admin/top/categories/${id}`, { method: 'DELETE' })
}

export function addTopEntry(categoryId: string, venueId: string, position?: number): Promise<unknown> {
  return api(`/admin/top/categories/${categoryId}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ venueId, position }),
  })
}

export function removeTopEntry(categoryId: string, entryId: string): Promise<unknown> {
  return api(`/admin/top/categories/${categoryId}/entries/${entryId}`, { method: 'DELETE' })
}

/** Новий порядок записів категорії — повний список айді (індекс = позиція). */
export function reorderTopEntries(categoryId: string, entryIds: string[]): Promise<unknown> {
  return api(`/admin/top/categories/${categoryId}/entries/reorder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entryIds }),
  })
}

/** Новий порядок самих категорій Топу. */
export function reorderTopCategories(categoryIds: string[]): Promise<unknown> {
  return api('/admin/top/categories/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryIds }),
  })
}
