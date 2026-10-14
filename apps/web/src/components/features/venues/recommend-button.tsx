'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useUser } from '@/components/providers/user-provider'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { ApiError } from '@/lib/api/parse'
import { recommendVenue, unrecommendVenue } from '@/services/venues'
import type { Role } from '@/types/user'

// Ті самі ролі, що й право venue:recommend на бекенді (критик — із міграції,
// супер-адмін — адмін-набір усіх прав)
const RECOMMEND_ROLES: Role[] = ['critic', 'super_admin']

interface Props {
  venueId: string
  /** userId критика, який рекомендував; null — не рекомендований. */
  recommendedBy: string | null
}

/**
 * Перемикач «Рекомендувати/Зняти рекомендацію» закладу для критика.
 * 1 критик на заклад: свою рекомендацію знімає автор, чужу — не чіпає
 * (бекенд відповість 403), тому чужу не показуємо кнопкою взагалі.
 * Користувачам без права venue:recommend кнопка не рендериться.
 * Після успіху — router.refresh(): бейдж «Рекомендовано» і список у кабінеті
 * перезбираються з БД.
 */
export function RecommendButton({ venueId, recommendedBy }: Props) {
  const { user } = useUser()
  const { toast } = useToast()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (!user || !user.roles.some((r) => RECOMMEND_ROLES.includes(r as Role))) {
    return null
  }
  // Чужа рекомендація — лише бейдж, кнопки немає (зняти може лише автор)
  const mine = recommendedBy !== null && recommendedBy === user.id
  if (recommendedBy !== null && !mine) return null

  async function toggle() {
    setBusy(true)
    try {
      if (mine) {
        await unrecommendVenue(venueId)
        toast('Рекомендацію знято')
      } else {
        await recommendVenue(venueId)
        toast('Заклад рекомендовано — тепер він «Рекомендовано критиком»')
      }
      router.refresh()
    } catch (e) {
      // 403 — дозвіл відібрали або рекомендацію вже перезаписав інший критик
      toast(e instanceof ApiError ? e.message : 'Сервіс тимчасово недоступний')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={busy}
      onClick={toggle}
      aria-pressed={mine}
    >
      {mine ? '✦ Зняти рекомендацію' : '✦ Рекомендувати'}
    </Button>
  )
}