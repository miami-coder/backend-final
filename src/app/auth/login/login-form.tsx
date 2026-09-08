'use client'

// Форма входу: клієнтська валідація (zod) + POST на BFF-хендлер /api/auth/login,
// який ставить httpOnly-сесійний cookie. Після успіху — /auth/me → setUser → редірект.

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUser } from '@/components/providers/user-provider'
import { loginSchema } from '@/lib/validation/auth'
import type { SessionUser } from '@/types/user'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setUser } = useUser()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    // Клієнтська валідація до будь-якого запиту в мережу
    const parsed = loginSchema.safeParse({ email, password })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Перевірте поля')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      if (res.ok) {
        const me = await fetch('/api/v1/auth/me').then((r) => (r.ok ? r.json() : null))
        if (me?.data) setUser(me.data as SessionUser)
        // Редірект лише на внутрішні шляхи — захист від open-redirect
        const next = searchParams.get('next')
        const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
        router.push(safeNext)
        router.refresh()
        return
      }
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      setError(body?.error?.message ?? 'Не вдалося увійти')
    } catch {
      setError('Сервіс тимчасово недоступний')
    } finally {
      setLoading(false)
    }
  }

  // noValidate: валідацію робимо через zod, нативні бульбашки браузера конфліктують з інлайн-помилками
  return (
    <form noValidate onSubmit={submit} className="mx-auto max-w-sm space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
      <h1 className="text-xl font-bold">Вхід</h1>
      {searchParams.get('error') === 'oauth' && (
        <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">Не вдалося увійти через соцмережу. Спробуйте ще раз.</p>
      )}
      <label className="block text-sm">
        Email
        <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="block text-sm">
        Пароль
        <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full">{loading ? 'Входимо…' : 'Увійти'}</Button>
      <div className="flex justify-between gap-2 text-sm">
        <Link className="text-brand-600 hover:underline" href="/auth/register">Реєстрація</Link>
        <a className="text-brand-600 hover:underline" href="/api/auth/google">Увійти через Google</a>
        <a className="text-brand-600 hover:underline" href="/api/auth/facebook">Facebook</a>
      </div>
    </form>
  )
}
