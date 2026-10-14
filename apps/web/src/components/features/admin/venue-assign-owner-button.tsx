'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authApiError } from '@/lib/api/client'
import { assignVenueOwner } from '@/services/venues'
import { getAdminUserOptions } from '@/services/users'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { parseAdminUser, type AdminUser, type RawAdminUser } from '@/types/admin'

// Призначення власника закладу: модалка з вибором користувача, POST
// assign-owner { userId } → toast + refresh + закриття.
// label — текст кнопки (в черзі модерації і при передачі керування різні формулі)
export function VenueAssignOwnerButton({
  venueId,
  label = 'Призначити власника',
}: {
  venueId: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [userId, setUserId] = useState('')
  const { toast } = useToast()
  const router = useRouter()

  // Список користувачів тягнемо один раз на відкриття модалки (limit=100).
  // Окремого loading-стану немає: доки список не завантажено, вибір порожній,
  // тож «Зберегти» і так disabled через !userId
  useEffect(() => {
    if (!open) return
    let cancelled = false
    getAdminUserOptions()
      .then((res) => {
        if (!cancelled) setUsers(res.data.map(parseAdminUser))
      })
      .catch((e) => {
        if (!cancelled) toast(authApiError(e) ?? 'Не вдалося завантажити користувачів', 'error')
      })
    return () => {
      cancelled = true
    }
  }, [open, toast])

  function close() {
    if (busy) return // не закриваємо посеред запиту
    setOpen(false)
    setUserId('') // наступне відкриття — з чистим вибором
  }

  async function assign() {
    if (busy || !userId) return // in-flight гард + гард на порожній вибір
    setBusy(true)
    try {
      await assignVenueOwner(venueId, userId)
      toast('Власника призначено')
      router.refresh()
      setOpen(false)
      setUserId('')
    } catch (e) {
      // помилка: toast і модалка лишається відкритою — можна повторити спробу
      toast(authApiError(e) ?? 'Не вдалося призначити власника', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-strong px-3 py-1.5 text-sm text-muted hover:bg-raised"
      >
        {label}
      </button>
      <Modal open={open} onClose={close} title={label}>
        <label className="block text-sm text-muted" htmlFor={`assign-owner-${venueId}`}>
          Користувач
        </label>
        <select
          id={`assign-owner-${venueId}`}
          className="mt-1 w-full rounded-xl border border-strong bg-bg px-3 py-2 text-sm text-ink focus:border-amber-500 focus:outline-none"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        >
          <option value="">— Оберіть користувача —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {/* profile відсутній → підписом лишається лише email */}
              {u.name ? `${u.email} — ${u.name}` : u.email}
            </option>
          ))}
        </select>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => void assign()}
            disabled={!userId || busy}
            className="rounded-xl bg-amber-500 px-3 py-1.5 text-sm font-medium text-espresso hover:bg-amber-400 disabled:opacity-50"
          >
            Зберегти
          </button>
        </div>
      </Modal>
    </>
  )
}
