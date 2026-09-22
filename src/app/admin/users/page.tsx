import Link from 'next/link'
import { serverFetchList } from '@/lib/api/server-client'
import { getSessionTokens } from '@/lib/auth/session'
import { parseAdminUser, type RawAdminUser } from '@/types/admin'
import { formatDate } from '@/lib/utils/format'
import { Pagination } from '@/components/ui/pagination'
import { RoleBadge } from '@/components/features/admin/role-badge'

export const revalidate = 0

const LIMIT = 20

interface Props {
  searchParams: Promise<{ page?: string }>
}

// «Користувачі»: список усіх користувачів (createdAt DESC). Email — посилання
// на детальку /admin/users/[id]; ролі — бейджі з ROLE_LABELS.
export default async function AdminUsersPage({ searchParams }: Props) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp?.page ?? 1) || 1)

  const tokens = await getSessionTokens()
  const list = await serverFetchList<RawAdminUser>(`/admin/users?page=${page}`, {
    tokens,
    revalidate: 0,
  })
  const users = list.data.map(parseAdminUser)
  // meta без totalPages — рахуємо з total/limit (бекендова limit, інакше LIMIT)
  const totalPages = Math.max(1, Math.ceil((list.meta?.total ?? 0) / (list.meta?.limit || LIMIT)))

  return (
    <section aria-label="Користувачі" className="space-y-4">
      {users.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">Користувачів немає.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-medium text-faint">
                <th scope="col" className="px-4 py-2">Ім&apos;я</th>
                <th scope="col" className="px-4 py-2">Email</th>
                <th scope="col" className="px-4 py-2">Ролі</th>
                <th scope="col" className="px-4 py-2">Реєстрація</th>
                <th scope="col" className="px-4 py-2 text-right">Дії</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-line">
                  <td className="px-4 py-3 text-ink">{u.name ?? 'Без імені'}</td>
                  <td className="px-4 py-3">
                    <Link className="text-ink hover:underline" href={`/admin/users/${u.id}`}>
                      {u.email}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <RoleBadge key={r} role={r} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link className="text-amber-500 hover:underline" href={`/admin/users/${u.id}`}>
                      Деталі
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Pagination сам повертає null при totalPages <= 1 */}
      <Pagination page={page} totalPages={totalPages} hrefFor={(p) => `/admin/users?page=${p}`} />
    </section>
  )
}
