import { api } from '@/lib/api/client'

export interface SiteContentMap {
  about: string | null
  contacts: string | null
}

export function updateContent(
  key: 'about' | 'contacts',
  value: string | null,
): Promise<unknown> {
  return api(`/admin/content/${key}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })
}
