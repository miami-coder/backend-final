'use client'

// Форма входу: клієнтська валідація (zod) + POST на BFF-хендлер /api/auth/login,
// який ставить httpOnly-сесійний cookie. Після успіху — редірект; /auth/me → setUser
// лише найкращим зусиллям (його падіння не блокує редірект — сесія вже встановлена).

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUser } from '@/components/providers/user-provider'
import { authLogin, authMe } from '@/services/auth'
import { loginSchema } from '@/lib/validation/auth'

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
      const res = await authLogin(parsed.data)
      if (res.ok) {
        // Сесія ВЖЕ встановлена — /auth/me лише для UI-стану; його падіння
        // не повинно блокувати редірект (інакше «Сервіс недоступний» при живій сесії)
        try {
          const me = await authMe()
          if (me) setUser(me)
        } catch {
          // пропускаємо — router.refresh() добуде користувача в layout
        }
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
    <form noValidate onSubmit={submit} className="mx-auto max-w-sm space-y-4 rounded-xl border border-line bg-surface p-6">
      <h1 className="font-display text-xl font-bold text-ink">Вхід</h1>
      {searchParams.get('error') === 'oauth' && (
        <p role="alert" className="rounded-lg bg-danger/15 p-2 text-sm text-danger">Не вдалося увійти через соцмережу. Спробуйте ще раз.</p>
      )}
      <label className="block text-sm">
        Email
        <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="block text-sm">
        Пароль
        <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full">{loading ? 'Входимо…' : 'Увійти'}</Button>
      {/* Соцмережі — обведеними кнопками на всю ширину, за вибором варіанту */}
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-faint">або</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <a href="/api/auth/google" className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-strong px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-amber-500/60 hover:bg-raised">Увійти через Google</a>
      <a href="/api/auth/facebook" className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-strong px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-amber-500/60 hover:bg-raised">Увійти через Facebook</a>
      <p className="text-center text-sm">
        Немає акаунта? <Link className="text-amber-500 hover:underline" href="/auth/register">Реєстрація</Link>
      </p>
    </form>
  )
}
