import { NextRequest, NextResponse } from 'next/server'
import {
  getSessionTokens, refreshTokens, SESSION_COOKIE, sessionCookieOptions, encodeTokens,
} from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3000'

type Ctx = { params: Promise<{ path: string[] }> }

async function forward(req: NextRequest, path: string[], accessToken: string | null, body?: ArrayBuffer): Promise<Response> {
  // search з req.url — однаково працює і для NextRequest, і для plain Request у тестах
  const target = `${BACKEND}/api/v1/${path.join('/')}${new URL(req.url).search}`
  const headers = new Headers()
  const contentType = req.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  try {
    return await fetch(target, {
      method: req.method,
      headers,
      body,
    })
  } catch {
    // Бекенд недоступний (мережа) — 502 за контрактом помилок
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Сервіс тимчасово недоступний', details: null } },
      { status: 502 },
    )
  }
}

async function passthrough(res: Response, newTokens?: string): Promise<NextResponse> {
  const body = await res.arrayBuffer()
  const out = new NextResponse(body, {
    status: res.status,
    headers: res.headers.has('content-type') ? { 'content-type': res.headers.get('content-type')! } : undefined,
  })
  if (newTokens) out.cookies.set(SESSION_COOKIE, newTokens, sessionCookieOptions())
  return out
}

async function handle(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const { path } = await ctx.params
  // Next декодує catch-all-сегменти: %2e%2e стає '..'. Такий шлях після
  // нормалізації міг би вирватися за межі /api/v1 — відхиляємо без проксування.
  // Next спочатку розбиває захоплення на '/', потім декодує КОЖЕН сегмент:
  // `..%2fhealth` доходить як ОДИН сегмент '../health', який проходить перевірку
  // seg === '..', а fetch() далі нормалізує '/'. Тому відкидаємо будь-який
  // сегмент із '/' або '\' усередині (плюс самі '.' та '..').
  if (path.some((seg) => seg === '.' || seg === '..' || seg.includes('/') || seg.includes('\\'))) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Некоректний запит', details: null } },
      { status: 400 },
    )
  }
  const tokens = await getSessionTokens()

  // Буферуємо тіло один раз: ReadableStream одноразовий, а повторний запит після refresh мусить нести ті самі дані
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.body !== null
  const body = hasBody ? await req.arrayBuffer() : undefined

  let backendRes = await forward(req, path, tokens?.accessToken ?? null, body)

  // Авто-refresh при 401 (окрім самого refresh-ендпоінта — його клієнти не викликають)
  if (backendRes.status === 401 && tokens?.refreshToken && path.join('/') !== 'auth/refresh') {
    const fresh = await refreshTokens(tokens.refreshToken)
    if (fresh) {
      backendRes = await forward(req, path, fresh.accessToken, body)
      return passthrough(backendRes, encodeTokens(fresh))
    }
  }
  return passthrough(backendRes)
}

export const GET = handle
export const POST = handle
export const PATCH = handle
export const PUT = handle
export const DELETE = handle
