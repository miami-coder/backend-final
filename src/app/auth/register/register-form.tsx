'use client'

// Форма реєстрації: та сама схема, що LoginForm — клієнтська валідація через
// registerSchema (помилки полів рендеримо окремо від label і прив'язуємо
// aria-describedby), POST на BFF-хендлер /api/auth/register, після успіху —
// /auth/me → setUser → редірект.

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUser } from '@/components/providers/user-provider'
import { registerSchema } from '@/lib/validation/auth'
import type { SessionUser } from '@/types/user'

export function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setUser } = useUser()
  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [age, setAge] = useState('')
  const [phone, setPhone] = useState('')
  const [acceptEula, setAcceptEula] = useState(false)
  // Помилки полів з zod: { ім'я поля => український текст }
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    // Клієнтська валідація до будь-якого запиту в мережу;
    // порожні опціональні поля не відправляємо на бекенд
    const parsed = registerSchema.safeParse({
      firstname,
      lastname,
      email,
      password,
      age: age === '' ? undefined : age,
      phone: phone === '' ? undefined : phone,
      acceptEula,
    })
    if (!parsed.success) {
      const errors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? '')
        if (!errors[key]) errors[key] = issue.message
      }
      setFieldErrors(errors)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
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
      // 409: email зайнято / EULA не прийнято; 422: помилки полів DTO
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      setError(body?.error?.message ?? 'Не вдалося зареєструватися')
    } catch {
      setError('Сервіс тимчасово недоступний')
    } finally {
      setLoading(false)
    }
  }

  return (
    // noValidate: валідацію робимо через zod, нативні бульбашки браузера конфліктують з інлайн-помилками
    <form noValidate onSubmit={submit} className="mx-auto max-w-sm space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
      <h1 className="text-xl font-bold">Реєстрація</h1>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {/* Помилка — сусід label, а не вкладена в нього: не забруднює accessible name;
          зв'язок через aria-describedby */}
      <div className="text-sm">
        <label htmlFor="reg-firstname">
          Ім&apos;я
        </label>
        <Input
          id="reg-firstname"
          aria-describedby={fieldErrors.firstname ? 'reg-firstname-error' : undefined}
          value={firstname}
          autoComplete="given-name"
          onChange={(e) => setFirstname(e.target.value)}
        />
        {fieldErrors.firstname && (
          <span id="reg-firstname-error" role="alert" className="mt-1 block text-red-600">{fieldErrors.firstname}</span>
        )}
      </div>
      <div className="text-sm">
        <label htmlFor="reg-lastname">
          Прізвище
        </label>
        <Input
          id="reg-lastname"
          aria-describedby={fieldErrors.lastname ? 'reg-lastname-error' : undefined}
          value={lastname}
          autoComplete="family-name"
          onChange={(e) => setLastname(e.target.value)}
        />
        {fieldErrors.lastname && (
          <span id="reg-lastname-error" role="alert" className="mt-1 block text-red-600">{fieldErrors.lastname}</span>
        )}
      </div>
      <div className="text-sm">
        <label htmlFor="reg-email">
          Email
        </label>
        <Input
          id="reg-email"
          type="email"
          aria-describedby={fieldErrors.email ? 'reg-email-error' : undefined}
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {fieldErrors.email && (
          <span id="reg-email-error" role="alert" className="mt-1 block text-red-600">{fieldErrors.email}</span>
        )}
      </div>
      <div className="text-sm">
        <label htmlFor="reg-password">
          Пароль
        </label>
        <Input
          id="reg-password"
          type="password"
          aria-describedby={fieldErrors.password ? 'reg-password-error' : undefined}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {fieldErrors.password && (
          <span id="reg-password-error" role="alert" className="mt-1 block text-red-600">{fieldErrors.password}</span>
        )}
      </div>
      <div className="text-sm">
        <label htmlFor="reg-age">
          Вік (необов&apos;язково)
        </label>
        <Input
          id="reg-age"
          type="number"
          min={18}
          aria-describedby={fieldErrors.age ? 'reg-age-error' : undefined}
          value={age}
          onChange={(e) => setAge(e.target.value)}
        />
        {fieldErrors.age && (
          <span id="reg-age-error" role="alert" className="mt-1 block text-red-600">{fieldErrors.age}</span>
        )}
      </div>
      <div className="text-sm">
        <label htmlFor="reg-phone">
          Телефон (необов&apos;язково)
        </label>
        <Input
          id="reg-phone"
          type="tel"
          aria-describedby={fieldErrors.phone ? 'reg-phone-error' : undefined}
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        {fieldErrors.phone && (
          <span id="reg-phone-error" role="alert" className="mt-1 block text-red-600">{fieldErrors.phone}</span>
        )}
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-brand-500"
          checked={acceptEula}
          onChange={(e) => setAcceptEula(e.target.checked)}
        />
        Приймаю умови угоди користувача
      </label>
      {fieldErrors.acceptEula && <span role="alert" className="block text-sm text-red-600">{fieldErrors.acceptEula}</span>}
      <Button type="submit" disabled={loading} className="w-full">{loading ? 'Реєструємо…' : 'Зареєструватися'}</Button>
      <p className="text-center text-sm">
        Вже маєте акаунт?{' '}
        <Link className="text-brand-600 hover:underline" href="/auth/login">Увійти</Link>
      </p>
    </form>
  )
}
