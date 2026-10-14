// Клієнтський сервіс користувачів: профіль свій і адмінський, ролі, системні
// повідомлення, видалення акаунта суперадміном.

import { api, apiList, apiVoid } from '@/lib/api/client'
import type { RawAdminUser } from '@/types/admin'

/** GET /admin/users?limit=100 — вибір користувача в адмін-модалках (dropdown). */
export function getAdminUserOptions() {
  return apiList<RawAdminUser>('/admin/users?limit=100')
}

/** PATCH /me/profile — редагування власного профілю. */
export function updateMyProfile(data: unknown): Promise<unknown> {
  return api('/me/profile', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
}

/** PATCH /admin/users/:id — правка профілю користувача суперадміном (diff-тіло). */
export function adminUpdateUser(userId: string, data: unknown): Promise<unknown> {
  return api(`/admin/users/${userId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
}

/** POST /admin/users/:id/roles — надати/зняти роль ({ roleCode, action }). */
export function setUserRole(userId: string, data: { roleCode: string; action: 'add' | 'remove' }): Promise<unknown> {
  return api(`/admin/users/${userId}/roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

/** POST /admin/users/:id/message — системне повідомлення користувачу. */
export function messageAdminUser(userId: string, data: unknown): Promise<unknown> {
  return api(`/admin/users/${userId}/message`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
}

/** DELETE /admin/users/:id — видалення акаунта суперадміном (403 — спроба видалити себе). */
export function deleteAdminUser(userId: string): Promise<void> {
  return apiVoid(`/admin/users/${userId}`, { method: 'DELETE' })
}