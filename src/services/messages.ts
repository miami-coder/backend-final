// Клієнтський сервіс повідомлень: вхідні користувача, звернення до менеджера
// закладу, відповіді менеджера, адмінські відповіді на feedback.

import { api, apiList } from '@/lib/api/client'
import type { RawMessage } from '@/types/message'

/** Вхідні повідомлення користувача (пагінація). */
export function getMyMessages(page: number, limit: number) {
  return apiList<RawMessage>(`/me/messages?page=${page}&limit=${limit}`)
}

/** PATCH /me/messages/:id/read — позначка прочитання. */
export function markMessageRead(messageId: string): Promise<unknown> {
  return api(`/me/messages/${messageId}/read`, { method: 'PATCH' })
}

/** POST /venues/:venueId/messages — звернення користувача до менеджера закладу. */
export function sendMessageToManager(venueId: string, data: { body: string }): Promise<unknown> {
  return api(`/venues/${venueId}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
}

/** POST /me/venues/:venueId/messages/:messageId/reply — відповідь менеджера. */
export function replyToVenueMessage(venueId: string, messageId: string, data: { body: string }): Promise<unknown> {
  return api(`/me/venues/${venueId}/messages/${messageId}/reply`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
}

/** POST /admin/messages/feedback/:feedbackId/reply — відповідь суперадміна. */
export function replyToFeedback(feedbackId: string, data: { body: string }): Promise<unknown> {
  return api(`/admin/messages/feedback/${feedbackId}/reply`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
}

/** POST /feedback — зворотний зв'язок з контакторинки (системне повідомлення). */
export function sendFeedback(data: unknown): Promise<unknown> {
  return api('/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
}