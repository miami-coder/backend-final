'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, authApiError } from '@/lib/api/client'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'

// Відхилення pending-закладу: підтвердження в модалці, POST із {} (бекенд
// тіло ігнорує, але fetch вимагає валідний запит) → toast + refresh + закриття
export function VenueRejectButton({ venueId }: { venueId: string }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  async function reject() {
    if (busy) return // in-flight гард: подвійний клік не шле другий запит
    setBusy(true)
    try {
      await api(`/admin/venues/${venueId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      toast('Заклад відхилено')
      router.refresh()
      setOpen(false)
    } catch (e) {
      // помилка: toast і модалка лишається відкритою — можна повторити спробу
      toast(authApiError(e) ?? 'Не вдалося відхилити заклад', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
      >
        Відхилити
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Відхилити заклад?">
        <p className="text-sm text-stone-600">
          Заклад зникне з публічного каталогу. Дію не можна скасувати.
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => void reject()}
            disabled={busy}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          >
            Підтвердити
          </button>
        </div>
      </Modal>
    </>
  )
}
