// Клієнтський сервіс новин: створення (власником та адміном), фото, правка, видалення.
// Вmutations з JSON-тілом завжди ставимо content-type: BFF-проксі не проставляє
// його сам, а бекенд очікує JSON.

import { api, apiVoid } from '@/lib/api/client'
import type { News } from '@/types/news'

/** POST /me/venues/:venueId/news — новина від власника закладу; venueId лише в URL. */
export function createVenueNews(venueId: string, data: unknown): Promise<News | undefined> {
  return api<News>(`/me/venues/${venueId}/news`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
}

/** POST /news/:id/photo — файловий upload після створення (multipart, boundary ставить браузер). */
export function uploadNewsPhoto(newsId: string, file: File): Promise<unknown> {
  const fd = new FormData()
  fd.append('file', file)
  return api(`/news/${newsId}/photo`, { method: 'POST', body: fd })
}

/** PATCH /news/:id — правка новини (власник або адмін). */
export function updateNews(newsId: string, data: unknown): Promise<unknown> {
  return api(`/news/${newsId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
}

/** DELETE /news/:id → 200 з {data} або порожнім тілом — apiVoid tolerate обидва. */
export function deleteNews(newsId: string): Promise<void> {
  return apiVoid(`/news/${newsId}`, { method: 'DELETE' })
}

/** POST /admin/news — адмінська новина без закладу. */
export function createAdminNews(data: unknown): Promise<unknown> {
  return api('/admin/news', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}