import Link from 'next/link'
import { serverFetchList } from '@/lib/api/server-client'
import { getSessionTokens } from '@/lib/auth/session'
import { parseAdminUser, ROLE_LABELS, type RawAdminUser } from '@/types/admin'
import { formatDate } from '@/lib/utils/format'
import { Pagination } from '@/components/ui/pagination'

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
        <p className="text-stone-500">Користувачів немає.</p>
      ) : (
        <ul className="divide-y divide-stone-200">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <Link className="font-medium text-stone-900 hover:underline" href={`/admin/users/${u.id}`}>
                  {u.email}
                </Link>
                <div className="text-sm text-stone-600">
                  {u.name ?? 'Без імені'} · {formatDate(u.createdAt)}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1">
                {u.roles.map((r) => (
                  <span
                    key={r}
                    className="rounded-full border border-stone-300 px-2 py-0.5 text-xs text-stone-700"
                  >
                    {ROLE_LABELS[r]}
                  </span>
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