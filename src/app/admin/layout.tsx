import { redirect } from 'next/navigation'
import { getMeSession } from '@/services/auth.server'
import { getSessionTokens } from '@/lib/auth/session'
import { AdminNav } from '@/components/layout/admin-nav'

const LINKS = [
  { href: '/admin', label: 'Огляд' },
  { href: '/admin/venues', label: 'Заклади' },
  { href: '/admin/users', label: 'Користувачі' },
  { href: '/admin/complaints', label: 'Скарги' },
  { href: '/admin/reviews', label: 'Відгуки' },
  { href: '/admin/news', label: 'Новини' },
  { href: '/admin/analytics', label: 'Аналітика' },
  { href: '/admin/messages', label: 'Повідомлення' },
] as const

export const revalidate = 0

// Захищена адмін-зона: тільки super_admin; інакше — на головну
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const tokens = await getSessionTokens()
  const user = tokens
    ? await getMeSession(tokens).catch(() => null)
    : null
  if (!user || !user.roles.includes('super_admin')) redirect('/')

  return (
    <div className="mx-auto max-w-5xl py-8">
      <h1 className="font-display text-2xl font-bold text-ink">Адмінка</h1>
      <AdminNav links={[...LINKS]} />
      <div className="mt-6">{children}</div>
    </div>
  )
}
