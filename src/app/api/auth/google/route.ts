import { NextResponse } from 'next/server'
import { browserBackendUrl } from '../_backend'

export const dynamic = 'force-dynamic'

export async function GET() {
  // 302 на браузерну адресу бекенда (не docker-імʼя BACKEND_URL)
  return NextResponse.redirect(`${browserBackendUrl}/api/v1/auth/google`, 302)
}
