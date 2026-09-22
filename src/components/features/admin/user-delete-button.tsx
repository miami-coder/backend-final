'use client'

// Острів «Небезпечна зона»: мʼяке видалення юзера. Modal із підтвердженням —
// адмін має ввести email ТОЧНО, інакше кнопка disabled. DELETE повертає
// порожнє тіло → apiVoid; успіх → toast + router.push на список.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { apiVoid, authApiError } from '@/lib/api/client'

export function UserDeleteButton({ userId, email }: { userId: string; email: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [value, setValue] = useState('')

  const matched = value === email

  function close() {
    if (busy) return // не закриваємо посеред запиту
    setOpen(false)
    setValue('') // наступне відкриття — з чистим полем
  }

  async function remove() {
    if (busy || !matched) return // in-flight гард + гард на неточний email
    setBusy(true)
    try {
      await apiVoid(`/admin/users/${userId}`, { method: 'DELETE' })
      toast('Користувача видалено')
      router.push('/admin/users')
    } catch (e) {
      // 403 — спроба видалити себе; модалка лишається відкритою
      toast(authApiError(e) ?? 'Не вдалося видалити користувача', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-danger/50 px-3 py-1.5 text-sm text-danger hover:bg-danger/10"
      >
        Видалити
      </button>
      <Modal open={open} onClose={close} title="Видалити користувача?">
        <p role="alert" className="text-sm text-danger">
          Користувача буде мʼяко видалено: вхід і публічний контент стануть недоступні. Дію не можна
          скасувати з інтерфейсу.
        </p>
        <label className="mt-3 block text-sm text-muted" htmlFor={`delete-confirm-${userId}`}>
          Введіть email користувача для підтвердження
        </label>
        <input
          id={`delete-confirm-${userId}`}
          type="email"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 w-full rounded-xl border border-strong bg-bg px-3 py-2 text-sm text-ink focus:border-amber-500 focus:outline-none"
        />
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => void remove()}
            disabled={!matched || busy}
            className="rounded-full bg-danger px-3 py-1.5 text-sm font-medium text-espresso hover:bg-danger/85 disabled:opacity-50"
          >
            Видалити користувача
          </button>
        </div>
      </Modal>
    </>
  )
}
