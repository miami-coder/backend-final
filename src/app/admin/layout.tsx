import { redirect } from 'next/navigation'
import { serverFetch } from '@/lib/api/server-client'
import { getSessionTokens } from '@/lib/auth/session'
import type { SessionUser } from '@/types/user'
import { AdminNav } from '@/components/layout/admin-nav'

const LINKS = [
  { href: '/admin', label: 'Огляд' },
  { href: '/admin/venues', label: 'Заклади' },
  { href: '/admin/users', label: 'Користувачі' },
  { href: '/admin/complaints', label: 'Скарги' },
  { href: '/admin/news', label: 'Новини' },
] as const

export const revalidate = 0

// Захищена адмін-зона: тільки super_admin; інакше — на головну
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const tokens = await getSessionTokens()
  const user = tokens
    ? await serverFetch<SessionUser>('/auth/me', { tokens, revalidate: 0 }).catch(() => null)
    : null
  if (!user || !user.roles.includes('super_admin')) redirect('/')

  return (
    <div className="mx-auto max-w-5xl py-8">
      <h1 className="text-2xl font-bold">Адмінка</h1>
      <AdminNav links={[...LINKS]} />
      <div className="mt-6">{children}</div>
    </div>
  )
}
