'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiList, authApiError } from '@/lib/api/client'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { parseAdminUser, type AdminUser, type RawAdminUser } from '@/types/admin'

// Призначення власника закладу: модалка з вибором користувача, POST
// assign-owner { userId } → toast + refresh + закриття
export function VenueAssignOwnerButton({ venueId }: { venueId: string }) {
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
    apiList<RawAdminUser>('/admin/users?limit=100')
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
      await api(`/admin/venues/${venueId}/assign-owner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
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
        className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
      >
        Призначити власника
      </button>
      <Modal open={open} onClose={close} title="Призначити власника">
        <label className="block text-sm text-stone-600" htmlFor={`assign-owner-${venueId}`}>
          Користувач
        </label>
        <select
          id={`assign-owner-${venueId}`}
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
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
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Зберегти
          </button>
        </div>
      </Modal>
    </>
  )
}
