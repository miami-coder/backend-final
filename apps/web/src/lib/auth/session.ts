import 'server-only'
import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'piyachok_session'

export interface SessionTokens {
  accessToken: string
  refreshToken: string
}

export function encodeTokens(t: SessionTokens): string {
  return JSON.stringify(t)
}

export function decodeTokens(value: string | undefined | null): SessionTokens | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<SessionTokens>
    if (typeof parsed.accessToken === 'string' && typeof parsed.refreshToken === 'string') {
      return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken }
    }
  } catch {
    // не-JSON
  }
  return null
}

export function sessionCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 30 * 24 * 3600,
    secure: process.env.NODE_ENV === 'production',
  }
}

export async function getSessionTokens(): Promise<SessionTokens | null> {
  const store = await cookies()
  return decodeTokens(store.get(SESSION_COOKIE)?.value)
}

// Викликати ЛИШЕ в route handlers / server actions
export async function setSessionCookie(tokens: SessionTokens): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, encodeTokens(tokens), sessionCookieOptions())
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 })
}

export async function refreshTokens(refreshToken: string): Promise<SessionTokens | null> {
  const backend = process.env.BACKEND_URL ?? 'http://localhost:3000'
  try {
    const res = await fetch(`${backend}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { accessToken?: string; refreshToken?: string }
    if (!body.accessToken || !body.refreshToken) return null
    return { accessToken: body.accessToken, refreshToken: body.refreshToken }
  } catch {
    return null
  }
}
