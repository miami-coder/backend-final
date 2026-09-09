'use client'

import { useEffect, useRef } from 'react'

// Лічильник переглядів: публічний POST /venues/:id/view (BFF-проксі).
// Fire-and-forget: помилки ігноруємо — лічильник не критичний для UI.
// Дедуп: ref усередині інстансу (StrictMode-подвійний ефект) + sessionStorage
// між інстансами (перемонтаж компонента) — бекенд сам дедупить 30 хв по sessionId.
const KEY = 'view-session-id'

export function ViewRecorder({ venueId }: { venueId: string }) {
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true

    const sentKey = `view-sent-${venueId}`
    let sessionId: string
    try {
      if (sessionStorage.getItem(sentKey)) return
      sessionId = localStorage.getItem(KEY) ?? ''
    } catch {
      sessionId = ''
    }
    if (!sessionId) {
      sessionId = (crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random()}`).slice(0, 64)
      try {
        localStorage.setItem(KEY, sessionId)
      } catch {
        // приватний режим — ок, сесія ефемерна
      }
    }
    try {
      sessionStorage.setItem(sentKey, '1')
    } catch {
      // немає sessionStorage — ref-гuard все одно захищає від дубля в цьому інстансі
    }

    fetch(`/api/v1/venues/${venueId}/view`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId.slice(0, 64) }),
    }).catch(() => {})
  }, [venueId])

  return null
}
