import { NextResponse } from 'next/server'
import { setSessionCookie } from '@/lib/auth/session'
import { postBackend } from '../_backend'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Некоректний запит' } }, { status: 400 })

  const res = await postBackend('/auth/login', body)
  if (res.status === 200 || res.status === 201) {
    const tokens = (await res.json()) as { accessToken: string; refreshToken: string }
    await setSessionCookie({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken })
    return NextResponse.json({ ok: true })
  }
  return res
}
