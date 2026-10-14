'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useUser } from '@/components/providers/user-provider'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { ApiError } from '@/lib/api/parse'
import { featureReview, unfeatureReview } from '@/services/reviews'
import type { Role } from '@/types/user'

// Ті самі ролі, що й право review:feature на бекенді (критик — із міграції,
// супер-адмін — адмін-набір усіх прав)
const FEATURE_ROLES: Role[] = ['critic', 'super_admin']

interface Props {
  reviewId: string
  isFeatured: boolean
}

/**
 * Перемикач «Виділити/Зняти виділення» відгуку для критика (і супер-адміна).
 * Користувачам без права review:feature кнопка взагалі не рендериться.
 * Після успіху — router.refresh(): серверний ReviewList перезбирається,
 * і бейдж «Рекомендований критиком»/кнопка синхронізуються з БД.
 */
export function FeatureReviewButton({ reviewId, isFeatured }: Props) {
  const { user } = useUser()
  const { toast } = useToast()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (!user || !user.roles.some((r) => FEATURE_ROLES.includes(r as Role))) {
    return null
  }

  async function toggle() {
    setBusy(true)
    try {
      if (isFeatured) {
        await unfeatureReview(reviewId)
        toast('Виділення знято')
      } else {
        await featureReview(reviewId)
        toast('Відгук виділено — тепер він «Рекомендований критиком»')
      }
      router.refresh()
    } catch (e) {
      // 403 — право відібрали поки сидів на сторінці; 404 — відгук видалили
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
      aria-pressed={!isFeatured}
    >
      {isFeatured ? '☆ Зняти виділення' : '★ Виділити'}
    </Button>
  )
}