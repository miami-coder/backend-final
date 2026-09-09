import { ApiError, parseData, parseList } from '@/lib/api/parse'
import type { PaginatedMeta } from '@/types/api'

export interface ClientListResult<T> {
  data: T[]
  meta?: PaginatedMeta
}

function redirectToLogin() {
  // SSR (window відсутній): редірект неможливий — проксі повернув 401,
  // server-скрипт просто отримає ApiError від виклику
  if (typeof window === 'undefined' || !window.location) return
  const next = window.location.pathname
  // Свідомо повне перезавантаження: сесія мертва, стан застосунку невалідний
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign('/auth/login?next=' + encodeURIComponent(next))
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, init)
  if (res.status === 401) {
    // проксі вже спробував refresh — сесія мертва
    redirectToLogin()
  }
  return parseData<T>(res)
}

export async function apiList<T>(path: string, init?: RequestInit): Promise<ClientListResult<T>> {
  const res = await fetch(`/api/v1${path}`, init)
  if (res.status === 401) redirectToLogin()
  return parseList<T>(res)
}

export function authApiError(e: unknown): string | null {
  if (e instanceof ApiError) return e.message
  return null
}
