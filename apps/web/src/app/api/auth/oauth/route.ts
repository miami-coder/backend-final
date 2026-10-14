import { NextResponse } from 'next/server'
import { setSessionCookie } from '@/lib/auth/session'
import { serverFetch } from '@/lib/api/server-client'
import type { SessionUser } from '@/types/user'

export const dynamic = 'force-dynamic'

// Токени приходять тілом з клієнтської сторінки колбеку (не з URL, який бачить історія).
// Перед встановленням cookie валідуємо access-токен на бекенді (login-CSRF hardening).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { accessToken?: string; refreshToken?: string } | null
  if (!body?.accessToken || !body?.refreshToken) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Некоректний запит' } }, { status: 400 })
  }
  const tokens = { accessToken: body.accessToken, refreshToken: body.refreshToken }
  try {
    await serverFetch<SessionUser>('/auth/me', { tokens, revalidate: 0 })
  } catch {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Токени невалідні' } }, { status: 401 })
  }
  await setSessionCookie(tokens)
  return NextResponse.json({ ok: true })
}
