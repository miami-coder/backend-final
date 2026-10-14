'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { authOauth } from '@/services/auth'

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
          // токени йдуть тілом, щоб не потрапити в жоден URL
          const res = await authOauth({ accessToken: access, refreshToken: refresh })
          ok = res.ok
        } catch {
          ok = false
        }
      }
      if (cancelled) return
      const destination = ok ? '/' : '/auth/login'
      if (ok) {
        // ПОВНЕ перевантаження: cookie вже в контейнері, а router.replace('/')
        // робить soft-nav — layout не перевитягує /auth/me, і хедер лишається
        // «Увійти» (дефект «другий вхід працює»). location.replace заодно
        // витирає callback-URL (з токенами) з історії.
        window.location.replace(destination)
        return
      }
      // невалідні токени: лишаємось на сторінці, URL лише витираємо
      window.history.replaceState(null, '', destination)
      setFailed(true)
    }

    finish()
    return () => { cancelled = true }
  }, [router, searchParams])

  if (failed) {
    return (
      <div className="py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">Не вдалося увійти</h1>
        <p className="mt-2 text-muted">Токени застаріли або невалідні.</p>
        <Link className="mt-6 inline-block rounded-full bg-amber-500 px-4 py-2 font-medium text-espresso hover:bg-amber-400" href="/auth/login">
          Спробувати знову
        </Link>
      </div>
    )
  }
  return <p className="py-16 text-center text-muted">Завершуємо вхід…</p>
}
