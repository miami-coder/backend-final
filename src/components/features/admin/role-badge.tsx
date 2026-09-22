import { ROLE_LABELS } from '@/types/admin'
import type { Role } from '@/types/user'

// Бейдж ролі адмінки: супер-адмін — бурштиновий, решта — нейтральні пігулки
export function RoleBadge({ role }: { role: Role }) {
  const superAdmin = role === 'super_admin'
  return (
    <span
      className={
        superAdmin
          ? 'rounded-full bg-amber-400/15 px-2 py-0.5 text-xs text-amber-400'
          : 'rounded-full bg-raised px-2 py-0.5 text-xs text-muted'
      }
    >
      {ROLE_LABELS[role]}
    </span>
  )
}