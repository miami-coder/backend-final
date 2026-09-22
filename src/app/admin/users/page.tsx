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
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-raised">
              <div className="min-w-0">
                <Link className="font-medium text-ink hover:underline" href={`/admin/users/${u.id}`}>
                  {u.email}
                </Link>
                <div className="text-sm text-muted">
                  {u.name ?? 'Без імені'} · {formatDate(u.createdAt)}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1">
                {u.roles.map((r) => (
                  <RoleBadge key={r} role={r} />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      {/* Pagination сам повертає null при totalPages <= 1 */}
      <Pagination page={page} totalPages={totalPages} hrefFor={(p) => `/admin/users?page=${p}`} />
    </section>
  )
}
