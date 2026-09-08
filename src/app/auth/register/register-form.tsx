'use client'

// Форма реєстрації: та сама схема, що LoginForm — клієнтська валідація через
// registerSchema (помилки показуємо над відповідними полями), POST на BFF-хендлер
// /api/auth/register, після успіху — /auth/me → setUser → редірект.

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
      <label className="block text-sm">
        Ім&apos;я
        {fieldErrors.firstname && <span role="alert" className="block text-red-600">{fieldErrors.firstname}</span>}
        <Input value={firstname} autoComplete="given-name" onChange={(e) => setFirstname(e.target.value)} />
      </label>
      <label className="block text-sm">
        Прізвище
        {fieldErrors.lastname && <span role="alert" className="block text-red-600">{fieldErrors.lastname}</span>}
        <Input value={lastname} autoComplete="family-name" onChange={(e) => setLastname(e.target.value)} />
      </label>
      <label className="block text-sm">
        Email
        {fieldErrors.email && <span role="alert" className="block text-red-600">{fieldErrors.email}</span>}
        <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="block text-sm">
        Пароль
        {fieldErrors.password && <span role="alert" className="block text-red-600">{fieldErrors.password}</span>}
        <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <label className="block text-sm">
        Вік (необов&apos;язково)
        {fieldErrors.age && <span role="alert" className="block text-red-600">{fieldErrors.age}</span>}
        <Input type="number" min={18} value={age} onChange={(e) => setAge(e.target.value)} />
      </label>
      <label className="block text-sm">
        Телефон (необов&apos;язково)
        {fieldErrors.phone && <span role="alert" className="block text-red-600">{fieldErrors.phone}</span>}
        <Input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
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
