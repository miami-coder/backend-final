import { NextResponse } from 'next/server'
import { clearSessionCookie, getSessionTokens } from '@/lib/auth/session'
import { backendUrl } from '../_backend'

export const dynamic = 'force-dynamic'

export async function POST() {
  const tokens = await getSessionTokens()
  if (tokens) {
    // Скасовуємо refresh-токен на бекенді; невдача не блокує вихід
    await fetch(`${backendUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    }).catch(() => null)
  }
  await clearSessionCookie()
  return NextResponse.json({ ok: true })
}
