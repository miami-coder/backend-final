'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

export function CallbackClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const access = searchParams.get('access')
    const refresh = searchParams.get('refresh')

    async function finish() {
      let ok = false
      if (access && refresh) {
        try {
          const res = await fetch('/api/auth/oauth', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            // токени йдуть тілом, щоб не потрапити в жоден URL
            body: JSON.stringify({ accessToken: access, refreshToken: refresh }),
          })
          ok = res.ok
        } catch {
          ok = false
        }
      }
      if (cancelled) return
      // ВИТИРАЄМО callback-URL (з токенами) з поточного запису історії ДО переходу
      const destination = ok ? '/' : '/auth/login'
      window.history.replaceState(null, '', destination)
      if (ok) router.replace(destination)
      else setFailed(true)
    }

    finish()
    return () => { cancelled = true }
  }, [router, searchParams])

  if (failed) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">Не вдалося увійти</h1>
        <p className="mt-2 text-stone-500">Токени застаріли або невалідні.</p>
        <Link className="mt-6 inline-block rounded-lg bg-brand-500 px-4 py-2 text-white hover:bg-brand-600" href="/auth/login">
          Спробувати знову
        </Link>
      </div>
    )
  }
  return <p className="py-16 text-center text-stone-500">Завершуємо вхід…</p>
}