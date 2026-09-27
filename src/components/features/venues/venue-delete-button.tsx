'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authApiError } from '@/lib/api/client'
import { deleteVenue } from '@/services/venues'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'

// М'яке видалення закладу (бекенд: статус Archived): підтвердження в модалці,
// DELETE → toast + refresh; за потреби редірект (напр., у кабінеті сторінка
// закладу після видалення більше не існує). Спільний для кабінету й адмінки.
export function VenueDeleteButton({
  venueId,
  label = 'Видалити',
  redirectTo,
}: {
  venueId: string
  label?: string
  redirectTo?: string
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  async function remove() {
    if (busy) return // in-flight гард: подвійний клік не шле другий запит
    setBusy(true)
    try {
      // DELETE → 204 з порожнім тілом: apiVoid без тіла відповіді
      await deleteVenue(venueId)
      toast('Заклад видалено')
      if (redirectTo) {
        router.push(redirectTo)
      }
      // refresh і після push: список на сторінці призначення має оновитись
      router.refresh()
      setOpen(false)
    } catch (e) {
      // помилка: toast і модалка лишається відкритою — можна повторити спробу
      toast(authApiError(e) ?? 'Не вдалося видалити заклад', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-danger/50 px-3 py-1.5 text-sm text-danger hover:bg-danger/10"
      >
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Видалити заклад?">
        <p className="text-sm text-muted">
          Заклад перейде в архів і зникне з публічного каталогу. Дію не можна скасувати.
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            className="rounded-xl bg-danger px-3 py-1.5 text-sm font-medium text-espresso hover:bg-danger/85 disabled:opacity-50"
          >
            Підтвердити
          </button>
        </div>
      </Modal>
    </>
  )
}