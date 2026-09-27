// Клієнтський сервіс аутентифікації.
//
// Два роди викликів:
// - BFF-хендлери /api/auth/* (login/register/oauth/logout): same-origin Next-роути,
//   що ставлять httpOnly-сесійний cookie. Тому це НЕ api()/api/v1 — проксі тут
//   не потрібен, а 401-редірект із client.ts був би шкідливим (форма сама
//   показує помилку тіла відповіді).
// - /api/v1/auth/me: best-effort підтвердження сесії — його падіння не має
//   кидатись нагору (проксі сам спробує refresh), тому сирий fetch без 401-логіки.

import type { SessionUser } from '@/types/user'
import type { LoginValues, RegisterValues } from '@/lib/validation/auth'

async function bffPost(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** POST /api/auth/login — ставить сесійний cookie; форму обробляє Res самостійно (ok + error.body). */
export function authLogin(values: LoginValues): Promise<Response> {
  return bffPost('/api/auth/login', values)
}

/** POST /api/auth/register — аналогічно до login. */
export function authRegister(values: RegisterValues): Promise<Response> {
  return bffPost('/api/auth/register', values)
}

/** POST /api/auth/oauth — завершення OAuth-колбеку; токени йдуть тілом, щоб не потрапити в URL. */
export function authOauth(tokens: { accessToken: string; refreshToken: string }): Promise<Response> {
  return bffPost('/api/auth/oauth', tokens)
}

/** POST /api/auth/logout — вихід; мережева помилка не має ламати вихід (→ null). */
export async function authLogout(): Promise<Response | null> {
  return fetch('/api/auth/logout', { method: 'POST' }).catch(() => null)
}

/** GET /api/v1/auth/me — користувач сесії або null (проксі сам рефрешить токен). */
export async function authMe(): Promise<SessionUser | null> {
  const res = await fetch('/api/v1/auth/me')
  if (!res.ok) return null
  const body = (await res.json().catch(() => null)) as { data?: SessionUser } | null
  return body?.data ?? null
}

