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
  const [pending, startTransition] = useTransition()

  if (!user) {
    return (
      <Link
        href={`/auth/login?next=/venues/${venueId}`}
        className="inline-flex items-center rounded-lg border border-stone-300 px-4 py-2 text-sm hover:bg-stone-100"
      >
        ♡ Обране
      </Link>
    )
  }

  async function toggle() {
    const was = favorite
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
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={favorite}
      className="inline-flex items-center rounded-lg border border-stone-300 px-4 py-2 text-sm hover:bg-stone-100"
    >
      {favorite ? '♥ В обраному' : '♡ Додати до обраного'}
    </button>
  )
}
