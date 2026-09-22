'use client'

// Острів «Ролі»: чипи поточних ролей із кнопкою зняття «×» + select ролей,
// яких ще немає, з кнопкою «Додати». POST /admin/users/:id/roles з exact
// body { roleCode, action }. super_admin — лише через підтверджувальну Modal.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { api, authApiError } from '@/lib/api/client'
import { ROLE_LABELS } from '@/types/admin'
import type { Role } from '@/types/user'

// Канонічний порядок ролей для select (не залежить від порядку roles з бекенду)
const ALL_ROLES: Role[] = ['user', 'venue_admin', 'super_admin', 'critic']

interface ConfirmState {
  roleCode: Role
  action: 'add' | 'remove'
}

export function UserRolesManager({ userId, roles }: { userId: string; roles: Role[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [roleCode, setRoleCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)

  const available = ALL_ROLES.filter((r) => !roles.includes(r))

  function closeConfirm() {
    if (busy) return // не закриваємо посеред запиту
    setConfirm(null)
  }

  // Після успіху roles оновляться через router.refresh() (server-props)
  async function apply({ roleCode: code, action }: ConfirmState) {
    if (busy) return // in-flight гард
    setBusy(true)
    try {
      await api(`/admin/users/${userId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleCode: code, action }),
      })
      toast(action === 'add' ? 'Роль надано' : 'Роль знято')
      router.refresh()
      setConfirm(null)
      setRoleCode('')
    } catch (e) {
      toast(authApiError(e) ?? 'Не вдалося оновити ролі', 'error')
    } finally {
      setBusy(false)
    }
  }

  function request(code: Role, action: 'add' | 'remove') {
    if (busy || !code) return // in-flight гард + гард на порожній вибір
    if (code === 'super_admin') {
      setConfirm({ roleCode: code, action }) // реверсивна дія — лише через підтвердження
      return
    }
    void apply({ roleCode: code, action })
  }

  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-2" aria-label="Поточні ролі">
        {roles.map((r) => (
          <li
            key={r}
            className="flex items-center gap-1 rounded-full border border-strong py-0.5 pl-2.5 pr-1 text-sm text-muted"
          >
            {ROLE_LABELS[r]}
            <button
              type="button"
              aria-label={`Зняти роль ${ROLE_LABELS[r]}`}
              disabled={busy}
              onClick={() => request(r, 'remove')}
              className="rounded-xl px-1.5 text-faint hover:bg-raised hover:text-danger disabled:opacity-50"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {available.length > 0 && (
        <div className="flex items-end gap-2">
          <label className="block text-sm text-muted">
            Нова роль
            <select
              aria-label="Оберіть роль"
              className="mt-1 block w-56 rounded-xl border border-strong bg-bg px-3 py-2 text-sm text-ink focus:border-amber-500 focus:outline-none"
              value={roleCode}
              onChange={(e) => setRoleCode(e.target.value)}
            >
              <option value="">— Оберіть роль —</option>
              {available.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => request(roleCode as Role, 'add')}
            disabled={!roleCode || busy}
            className="rounded-xl bg-amber-500 px-3 py-2 text-sm font-medium text-espresso hover:bg-amber-400 disabled:opacity-50"
          >
            Додати
          </button>
        </div>
      )}

      <Modal
        open={confirm !== null}
        onClose={closeConfirm}
        title={confirm?.action === 'add' ? 'Надати супер-адміна?' : 'Зняти супер-адміна?'}
      >
        <p className="text-sm text-muted">
          Супер-адмін має повний доступ до адмінки, включно з керуванням ролями інших адміністраторів.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={closeConfirm}
            className="rounded-xl border border-strong px-3 py-1.5 text-sm text-muted hover:bg-raised"
          >
            Скасувати
          </button>
          <button
            type="button"
            onClick={() => confirm && void apply(confirm)}
            disabled={busy}
            className="rounded-xl bg-amber-500 px-3 py-1.5 text-sm font-medium text-espresso hover:bg-amber-400 disabled:opacity-50"
          >
            Підтвердити
          </button>
        </div>
      </Modal>
    </div>
  )
}
