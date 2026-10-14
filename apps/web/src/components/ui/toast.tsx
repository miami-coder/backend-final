'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

interface ToastItem { id: number; message: string; tone: 'success' | 'error' }

interface ToastApi {
  toast: (message: string, tone?: 'success' | 'error') => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  // таймери auto-hide: тримаємо, щоб на unmount провайдера їх погасити
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  const toast = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    const id = nextId.current++
    setItems((prev) => [...prev, { id, message, tone }])
    // авто-приховування: таймер на кожен toast окремо
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
    timers.current.add(timer)
  }, [])

  // unmount: clearTimeout — інакше «пізній» setState летить у розмонтоване дерево
  useEffect(() => () => {
    for (const t of timers.current) clearTimeout(t)
  }, [])

  const api = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* aria-live: скрін-рідери оголошують появу повідомлень */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              t.tone === 'error' ? 'bg-danger text-espresso' : 'bg-success text-espresso'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast має використовуватись всередині ToastProvider')
  return ctx
}
