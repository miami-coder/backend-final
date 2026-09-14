'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/components/providers/user-provider'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { apiVoid } from '@/lib/api/client'
import { ApiError } from '@/lib/api/parse'
import type { HangoutStatus } from '@/types/hangout'

export function HangoutJoinButton({ hangoutId, status }: { hangoutId: string; status: HangoutStatus }) {
  const { user } = useUser()
  const { toast } = useToast()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!user) {
    return (
      // без encodeURIComponent: %2F у next проксі відкидає (нормалізація шляху),
      // а слеші в route-значенні безпечні — патерн HangoutButton/FavoriteButton
      <Link href="/auth/login?next=/hangouts" className="text-sm text-brand-600 hover:underline">
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
      await apiVoid(`/hangouts/${hangoutId}/join`, { method: 'POST' })
      // router.refresh(): після join список учасників на сервері змінився —
      // RSC-перевитяг оновить лічильник/статус картки (патерн HangoutActions)
      router.refresh()
      toast('Успішно приєднано до зустрічі')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не вдалося приєднатися')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Button size="sm" onClick={join} disabled={busy}>{busy ? 'Приєднуємось…' : 'Приєднатися'}</Button>
      {error && <p role="alert" className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
