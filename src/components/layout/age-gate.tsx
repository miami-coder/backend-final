'use client'

import { useCallback, useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'

// sessionStorage недоступний під час SSR: серверний снапшот — «підтверджено»
// (до гідратації нічого не рендеримо), клієнтський читає прапорець сеансу.
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return sessionStorage.getItem('age-confirmed') === '1'
}

function getServerSnapshot() {
  return true
}

export function AgeGate() {
  const confirmed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [denied, setDenied] = useState(false)

  const confirm = useCallback(() => {
    sessionStorage.setItem('age-confirmed', '1')
    listeners.forEach((listener) => listener())
  }, [])

  if (confirmed) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
        {denied ? (
          <p className="text-lg font-medium">Вийдіть із застосунку. Доступ лише для повнолітніх.</p>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Вікове обмеження</h1>
            <p className="mt-3 text-stone-600">
              Запускаючи цей застосунок, ви погоджуєтесь, що вам є 18 років.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Button onClick={confirm}>
                Підтверджую, мені 18+
              </Button>
              <Button variant="secondary" onClick={() => setDenied(true)}>Мені немає 18</Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
