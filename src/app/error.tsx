'use client'

import { useEffect } from 'react'

// Глобальна межа помилок рендерингу (конвенція файлів Next.js — error.tsx у корені app).
// retry() повторно запитує RSC-пейлоад і лише потім скидає стан межі — на відміну від
// reset(), який рендерить уже отриманий (помилковий) пейлоад і миттєво знову «падає»
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  // reporting-hook: поки немає Sentry/сервісу — консоль; digest попередньо виводимо
  useEffect(() => {
    console.error('[GlobalError]', error?.digest ?? '', error)
  }, [error])

  return (
    <div className="py-16 text-center">
      <h1 className="font-display text-2xl font-bold text-ink">Щось пішло не так</h1>
      <p className="mt-2 text-muted">Сервіс тимчасово недоступний. Спробуйте ще раз.</p>
      <button className="mt-6 rounded-full bg-amber-500 px-4 py-2 font-medium text-espresso hover:bg-amber-400" onClick={retry}>
        Повторити
      </button>
    </div>
  )
}
