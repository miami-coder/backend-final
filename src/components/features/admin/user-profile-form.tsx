'use client'

// Острів «Профіль» на деталці адмін-юзера: патерн кабінетного ProfileForm,
// але PATCH /admin/users/:id і без avatarUrl (UpdateProfileDto його не має).
// Надсилаємо лише diff проти початкових значень; порожній diff → «Немає змін».

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import { ApiError } from '@/lib/api/parse'
import { profileUpdateSchema } from '@/lib/validation/profile'

interface ProfileFields {
  firstname: string | null
  lastname: string | null
  phone: string | null
  age: number | null
}

export function UserProfileForm({ userId, profile }: { userId: string; profile: ProfileFields | null }) {
  const router = useRouter()
  const { toast } = useToast()
  const [firstname, setFirstname] = useState(profile?.firstname ?? '')
  const [lastname, setLastname] = useState(profile?.lastname ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [age, setAge] = useState(profile?.age?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (saving) return // in-flight гард
    setError(null)
    // Порожні поля НЕ надсилаємо (як у кабінеті: DTO опційні, порожній рядок
    // ламав би MinLength на бекенді) — тому «очищення» поля не летить
    const candidates: Record<string, unknown> = {}
    if (firstname.trim()) candidates.firstname = firstname
    if (lastname.trim()) candidates.lastname = lastname
    if (phone.trim()) candidates.phone = phone
    if (age.trim()) candidates.age = Number(age)
    const parsed = profileUpdateSchema.safeParse(candidates)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Перевірте поля')
      return
    }
    // diff проти початкових значень: змінене — летить, незмінене — ні
    const diff: Record<string, unknown> = {}
    if (parsed.data.firstname !== undefined && parsed.data.firstname !== (profile?.firstname ?? null)) {
      diff.firstname = parsed.data.firstname
    }
    if (parsed.data.lastname !== undefined && parsed.data.lastname !== (profile?.lastname ?? null)) {
      diff.lastname = parsed.data.lastname
    }
    if (parsed.data.phone !== undefined && parsed.data.phone !== (profile?.phone ?? null)) {
      diff.phone = parsed.data.phone
    }
    if (parsed.data.age !== undefined && parsed.data.age !== (profile?.age ?? null)) {
      diff.age = parsed.data.age
    }
    if (Object.keys(diff).length === 0) {
      toast('Немає змін')
      return
    }
    setSaving(true)
    try {
      await api(`/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(diff),
      })
      toast('Профіль оновлено')
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося оновити профіль')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-3" aria-label="Профіль">
      <label className="block text-sm font-medium">
        Імʼя
        <Input value={firstname} onChange={(e) => setFirstname(e.target.value)} className="mt-1 w-full" />
      </label>
      <label className="block text-sm font-medium">
        Прізвище
        <Input value={lastname} onChange={(e) => setLastname(e.target.value)} className="mt-1 w-full" />
      </label>
      <label className="block text-sm font-medium">
        Телефон
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full" />
      </label>
      <label className="block text-sm font-medium">
        Вік
        <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} className="mt-1 w-full" />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <Button type="submit" disabled={saving}>
        {saving ? 'Зберігаємо…' : 'Зберегти'}
      </Button>
    </form>
  )
}
