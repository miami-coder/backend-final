import { NextRequest, NextResponse } from 'next/server'
import { setSessionCookie } from '@/lib/auth/session'
import { serverFetch } from '@/lib/api/server-client'

export const dynamic = 'force-dynamic'

// Токени з query — це дані з URL, їм не можна довіряти напряму (login-CSRF):
// перед встановленням cookie перевіряємо access-токен на бекенді через /auth/me
async function tokensAreValid(access: string, refresh: string): Promise<boolean> {
  try {
    await serverFetch('/auth/me', { tokens: { accessToken: access, refreshToken: refresh }, revalidate: 0 })
    return true
  } catch {
    // 401, інший статус або недоступний бекенд — токени вважаємо невалідними
    return false
  }
}

export async function GET(req: NextRequest) {
  const access = req.nextUrl.searchParams.get('access')
  const refresh = req.nextUrl.searchParams.get('refresh')
  if (access && refresh && (await tokensAreValid(access, refresh))) {
    await setSessionCookie({ accessToken: access, refreshToken: refresh })
    // 302: NextResponse.redirect за замовчуванням дає 307
    return NextResponse.redirect(new URL('/', req.nextUrl.origin), 302)
  }
  return NextResponse.redirect(new URL('/auth/login?error=oauth', req.nextUrl.origin), 302)
}
