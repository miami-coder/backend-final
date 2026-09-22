import Link from 'next/link'
import { notFound } from 'next/navigation'
import { serverFetch } from '@/lib/api/server-client'
import { getSessionTokens } from '@/lib/auth/session'
import { parseAdminUser, ROLE_LABELS, type RawAdminUser } from '@/types/admin'
import { formatDate } from '@/lib/utils/format'
import { UserProfileForm } from '@/components/features/admin/user-profile-form'
import { UserRolesManager } from '@/components/features/admin/user-roles-manager'
import { UserDeleteButton } from '@/components/features/admin/user-delete-button'

export const revalidate = 0

interface Props {
  params: Promise<{ id: string }>
}

// «Користувачі» → деталка: профіль (PATCH), керування ролями та мʼяке
// видалення. 404/видалений/мережа → notFound (глобальний 404 достатній).
export default async function AdminUserPage({ params }: Props) {
  const { id } = await params
  const tokens = await getSessionTokens()
  const res = await serverFetch<{ data: RawAdminUser }>(`/admin/users/${id}`, {
    tokens,
    revalidate: 0,
  }).catch(() => null)
  if (!res) notFound()
  const user = parseAdminUser(res.data)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{user.email}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>
            {user.name ?? 'Без імені'} · {formatDate(user.createdAt)}
          </span>
          {user.roles.map((r) => (
            <span
              key={r}
              className={
                r === 'super_admin'
                  ? 'rounded-full bg-amber-400/15 px-2 py-0.5 text-xs text-amber-400'
                  : 'rounded-full bg-raised px-2 py-0.5 text-xs text-muted'
              }
            >
              {ROLE_LABELS[r]}
            </span>
          ))}
        </div>
      </div>

      <section aria-label="Профіль користувача" className="space-y-2">
        <h3 className="font-medium text-ink">Профіль</h3>
        {/* profile as-is із бекенду: avatarUrl у UpdateProfileDto відсутній —
            форма його не редагує */}
        <UserProfileForm userId={user.id} profile={res.data.profile} />
      </section>

      <section aria-label="Ролі користувача" className="space-y-2">
        <h3 className="font-medium text-ink">Ролі</h3>
        <UserRolesManager userId={user.id} roles={user.roles} />
      </section>

      <section aria-label="Небезпечна зона" className="space-y-2 border-t border-line pt-6">
        <h3 className="font-medium text-danger">Небезпечна зона</h3>
        <UserDeleteButton userId={user.id} email={user.email} />
      </section>

      <Link className="text-sm text-amber-500 hover:underline" href="/admin/users">
        ← До списку користувачів
      </Link>
    </div>
  )
}
