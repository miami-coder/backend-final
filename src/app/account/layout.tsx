import { redirect } from 'next/navigation'
import Link from 'next/link'
import { serverFetch } from '@/lib/api/server-client'
import { getSessionTokens } from '@/lib/auth/session'
import type { SessionUser } from '@/types/user'

// Захищена зона: сесії немає або вона мертва → логін із поверненням
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const tokens = await getSessionTokens()
  const user = tokens
    ? await serverFetch<SessionUser>('/auth/me', { tokens, revalidate: 0 }).catch(() => null)
    : null
  if (!user) redirect('/auth/login?next=/account')

  return (
    <div className="mx-auto max-w-4xl py-8">
      <h1 className="text-2xl font-bold">Кабінет</h1>
      <nav className="mt-4 flex gap-4 border-b border-stone-200 pb-2 text-sm">
        <Link className="text-brand-600 hover:underline" href="/account">
          Профіль
        </Link>
        <Link className="text-brand-600 hover:underline" href="/account/favorites">
          Обране
        </Link>
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  )
}
