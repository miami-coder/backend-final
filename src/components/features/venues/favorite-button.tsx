'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useUser } from '@/components/providers/user-provider'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'

export function FavoriteButton({ venueId, initialFavorite }: { venueId: string; initialFavorite: boolean }) {
  const { user } = useUser()
  const { toast } = useToast()
  const router = useRouter()
  const [favorite, setFavorite] = useState(initialFavorite)
  // in-flight прапорець: disabled={pending} покриває лише router.refresh(),
  // а вікно await api() лишало кнопку активною — подвійний клік надсилав би
  // протилежний запит (POST після POST / DELETE після DELETE)
  const [busy, setBusy] = useState(false)
  const [pending, startTransition] = useTransition()

  if (!user) {
    return (
      <Link
        href={`/auth/login?next=/venues/${venueId}`}
        className="inline-flex items-center rounded-full border border-strong px-4 py-2 text-sm hover:bg-raised"
      >
        ♡ Обране
      </Link>
    )
  }

  async function toggle() {
    if (busy) return // другий клік у тому самому тіку: disabled ще не доїхав
    const was = favorite
    setBusy(true)
    setFavorite(!was) // оптимістично
    try {
      if (!was) {
        await api(`/me/favorites/${venueId}`, { method: 'POST' })
      } else {
        // DELETE → 200 з порожнім тілом: api() парсить через parseEmpty
        await api(`/me/favorites/${venueId}`, { method: 'DELETE' })
      }
      startTransition(() => router.refresh())
    } catch {
      setFavorite(was) // відкат
      toast('Не вдалося оновити обране. Спробуйте ще раз.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || pending}
      aria-pressed={favorite}
      className="inline-flex items-center rounded-full border border-strong px-4 py-2 text-sm hover:bg-raised"
    >
      {favorite ? '♥ В обраному' : '♡ Додати до обраного'}
    </button>
  )
}
