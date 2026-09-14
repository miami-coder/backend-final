'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, authApiError } from '@/lib/api/client'
import { useToast } from '@/components/ui/toast'

// Схвалення pending-закладу в адмінці: POST без тіла → toast + refresh списку
export function VenueApproveButton({ venueId }: { venueId: string }) {
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  async function approve() {
    if (busy) return // in-flight гард: подвійний клік не шле другий запит
    setBusy(true)
    try {
      // бекенд approve приймає запит без тіла
      await api(`/admin/venues/${venueId}/approve`, { method: 'POST' })
      toast('Заклад схвалено')
      router.refresh()
    } catch (e) {
      toast(authApiError(e) ?? 'Не вдалося схвалити заклад', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void approve()}
      disabled={busy}
      className="rounded-md bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
    >
      Схвалити
    </button>
  )
}
