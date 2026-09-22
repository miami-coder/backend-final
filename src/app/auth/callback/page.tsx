import { Suspense } from 'react'
import { CallbackClient } from './callback-client'

export const metadata = { title: 'Завершення входу' }

export default function CallbackPage() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-muted">Завершуємо вхід…</p>}>
      <CallbackClient />
    </Suspense>
  )
}
