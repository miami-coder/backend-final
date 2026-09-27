import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getMeSession } from '@/services/auth.server'
import { getSessionTokens } from '@/lib/auth/session'

// Захищена зона: сесії немає або вона мертва → логін із поверненням
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const tokens = await getSessionTokens()
  const user = tokens
    ? await getMeSession(tokens).catch(() => null)
    : null
  if (!user) redirect('/auth/login?next=/account')

  return (
    <div className="mx-auto max-w-4xl py-8">
      <h1 className="font-display text-2xl font-bold text-ink">Кабінет</h1>
      <nav className="mt-4 flex gap-4 border-b border-line pb-2 text-sm">
        <Link className="text-amber-500 hover:underline" href="/account">
          Профіль
        </Link>
        <Link className="text-amber-500 hover:underline" href="/account/favorites">
          Обране
        </Link>
        <Link className="text-amber-500 hover:underline" href="/account/reviews">
          Відгуки
        </Link>
        <Link className="text-amber-500 hover:underline" href="/account/messages">
          Повідомлення
        </Link>
        <Link className="text-amber-500 hover:underline" href="/account/hangouts">
          Пиячки
        </Link>
        <Link className="text-amber-500 hover:underline" href="/account/venues">
          Заклади
        </Link>
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  )
}
