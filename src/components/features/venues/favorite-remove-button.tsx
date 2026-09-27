'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useToast } from '@/components/ui/toast'
import { removeFavorite } from '@/services/venues'
import { ApiError } from '@/lib/api/parse'

export function FavoriteRemoveButton({ venueId }: { venueId: string }) {
  const { toast } = useToast()
  const router = useRouter()
  const [removing, setRemoving] = useState(false)

  async function remove() {
    setRemoving(true)
    try {
      await removeFavorite(venueId)
      toast('Прибрано з обраного')
      router.refresh()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Не вдалося прибрати. Спробуйте ще раз.', 'error')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={removing}
      className="text-xs text-faint hover:text-danger"
    >
      ✕ Прибрати
    </button>
  )
}
