'use client'

// Дзвіночок непрочитаних повідомлень у хедері: GET /me/messages/unread-count
// одразу після монтажу і полінг кожні 60 с (WebSocket/SSE у проєкті немає).
// Рендериться лише для залогіненого (user з useUser); для гостя — нічого.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/components/providers/user-provider'
import { api } from '@/lib/api/client'

const POLL_MS = 60_000

export function NotificationBell() {
  const { user } = useUser()
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ count: number }>('/me/messages/unread-count')
      setCount(res.count)
    } catch {
      // тихо: дзвіночок не критичний, помилку не показуємо
    }
  }, [])

  useEffect(() => {
    if (!user) return
    void refresh()
    const id = setInterval(() => void refresh(), POLL_MS)
    return () => clearInterval(id)
  }, [user, refresh])

  if (!user) return null

  return (
    <Link
      href="/account/messages"
      aria-label={count > 0 ? `Повідомлення: ${count} непрочитаних` : 'Повідомлення'}
      className="relative rounded-full px-2 py-1 text-lg hover:bg-raised"
    >
      <span aria-hidden>🔔</span>
      {count > 0 && (
        <span
          data-testid="unread-badge"
          className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-amber-500 px-1 text-center text-[10px] font-semibold leading-4 text-espresso"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}