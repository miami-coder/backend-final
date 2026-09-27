'use client'

import { useEffect, useRef } from 'react'
import { recordVenueView } from '@/services/venues'

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
    // sessionStorage і localStorage — окремі try: збій одного сховища
    // не мусить позбавляти стабільний sessionId з іншого
    try {
      if (sessionStorage.getItem(sentKey)) return
    } catch {
      // немає sessionStorage — ref-гuard усе одно захищає цей інстанс
    }
    let sessionId: string
    try {
      sessionId = localStorage.getItem(KEY) ?? ''
    } catch {
      sessionId = '' // приватний режим — нижче згенеруємо нову сесію
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

    recordVenueView(venueId, sessionId)
  }, [venueId])

  return null
}
