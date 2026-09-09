import { ApiError, parseEmpty, parseList } from '@/lib/api/parse'
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

// DELETE → 200 з ПОРОЖНІМ тілом: parseEmpty повертає undefined (каст as T
// брехав би). Перевантаження чесно розділяє семантику: звичайний запит
// має JSON-конверт із data, запит із method:'DELETE' може дати undefined.
export function api<T>(path: string, init: RequestInit & { method: 'DELETE' }): Promise<T | undefined>
export function api<T>(path: string, init?: RequestInit): Promise<T>
export async function api<T>(path: string, init?: RequestInit): Promise<T | undefined> {
  const res = await fetch(`/api/v1${path}`, init)
  if (res.status === 401) {
    // проксі вже спробував refresh — сесія мертва
    redirectToLogin()
  }
  // DELETE → 200 з порожнім тілом: parseData очікував би JSON-конверт
  // і кинув би на res.json() — відкат відбувся б і на успіху
  return await parseEmpty<T>(res)
}

export async function apiList<T>(path: string, init?: RequestInit): Promise<ClientListResult<T>> {
  const res = await fetch(`/api/v1${path}`, init)
  if (res.status === 401) redirectToLogin()
  return parseList<T>(res)
}

// Запити, у яких тіло відповіді не потрібне (DELETE /reviews/:id → 200 з ПОРОЖНІМ тілом).
// Від api() відрізняється лише семантикою результату: нічого не повертає,
// а на 401 одразу кидає ApiError після редіректу (відновлювати нічого — тіла немає).
export async function apiVoid(path: string, init?: RequestInit): Promise<void> {
  const res = await fetch(`/api/v1${path}`, init)
  if (res.status === 401) {
    redirectToLogin()
    throw new ApiError(401, 'UNAUTHORIZED', 'Сесія завершена')
  }
  await parseEmpty(res)
}

export function authApiError(e: unknown): string | null {
  if (e instanceof ApiError) return e.message
  return null
}
