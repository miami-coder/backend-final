'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/components/providers/user-provider'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { joinHangout } from '@/services/hangouts'
import { ApiError } from '@/lib/api/parse'
import type { HangoutStatus } from '@/types/hangout'

export function HangoutJoinButton({ hangoutId, status, joinRedirect, initialJoined = false }: {
  hangoutId: string
  status: HangoutStatus
  /** Вказати — після успішного join перейти на адресу замість перевитягу
   *  (деталі зустрічі → назад до списку). */
  joinRedirect?: string
  /** Користувач уже учасник (від сервера, /me/hangouts) — одразу «В тусовці!». */
  initialJoined?: boolean
}) {
  const { user } = useUser()
  const { toast } = useToast()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // локальний факт приєднання: кнопка гасне у стан «В тусовці!»
  const [joined, setJoined] = useState(initialJoined)

  if (!user) {
    return (
      // без encodeURIComponent: %2F у next проксі відкидає (нормалізація шляху),
      // а слеші в route-значенні безпечні — патерн HangoutButton/FavoriteButton
      <Link href="/auth/login?next=/hangouts" className="text-sm text-amber-500 hover:underline">
        Увійдіть, щоб приєднатися
      </Link>
    )
  }
  if (status !== 'open') {
    return (
      <Button size="sm" disabled aria-label="Приєднатися">
        Приєднатися
      </Button>
    )
  }

  async function join() {
    setBusy(true)
    setError(null)
    try {
      await joinHangout(hangoutId)
      setJoined(true)
      // Серверне оновлення: поки ми ще на цій сторінці — RSC-перевитяг
      // оновить лічильник/статус картки; redirect (деталі) замінює його
      if (joinRedirect) router.push(joinRedirect)
      else router.refresh()
      toast('Успішно приєднано до зустрічі')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не вдалося приєднатися')
    } finally {
      setBusy(false)
    }
  }

  if (joined) {
    // стан після успішного join: не-дія, лише позначка (бекенд 409 і так захищає)
    return <Button size="sm" disabled>В тусовці!</Button>
  }
  return (
    <div>
      <Button size="sm" onClick={join} disabled={busy}>{busy ? 'Приєднуємось…' : 'Приєднатися'}</Button>
      {error && <p role="alert" className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  )
}
