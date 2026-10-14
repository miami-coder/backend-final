// Клієнтський сервіс скарг: подання користувачем і вирішення адміном.

import { api } from '@/lib/api/client'

/** POST /complaints — скарга на заклад або відгук. */
export function createComplaint(data: unknown): Promise<unknown> {
  return api('/complaints', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
}

/** POST /admin/complaints/:id/resolve — вирішення суперадміном. */
export function resolveComplaint(complaintId: string, data: unknown): Promise<unknown> {
  return api(`/admin/complaints/${complaintId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}