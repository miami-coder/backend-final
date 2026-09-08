import { NextResponse } from 'next/server'
import { backendUrl } from '../_backend'

export const dynamic = 'force-dynamic'

export async function GET() {
  // 302: NextResponse.redirect за замовчуванням дає 307
  return NextResponse.redirect(`${backendUrl}/api/v1/auth/google`, 302)
}
