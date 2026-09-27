'use client'

// Острів редагування профілю: порожні поля не надсилаємо (DTO опційні,
// порожній рядок ламав би MinLength на бекенді), валідація — zod-схема
// Task 3, мутація — PATCH /me/profile через api(), далі router.refresh().

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { updateMyProfile } from '@/services/users'
import { ApiError } from '@/lib/api/parse'
import { profileUpdateSchema } from '@/lib/validation/profile'

export interface ProfileFields {
  firstname: string | null
  lastname: string | null
  phone: string | null
  age: number | null
  avatarUrl: string | null
}

export function ProfileForm({ profile }: { profile: ProfileFields }) {
  const router = useRouter()
  const { toast } = useToast()
  const [firstname, setFirstname] = useState(profile.firstname ?? '')
  const [lastname, setLastname] = useState(profile.lastname ?? '')
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [age, setAge] = useState(profile.age?.toString() ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    // Порожні поля НЕ надсилаємо (DTO опційні; пусті рядки ламали б MinLength)
    const values: Record<string, unknown> = {}
    if (firstname.trim()) values.firstname = firstname
    if (lastname.trim()) values.lastname = lastname
    if (phone.trim()) values.phone = phone
    if (age.trim()) values.age = Number(age)
    if (avatarUrl.trim()) values.avatarUrl = avatarUrl
    const parsed = profileUpdateSchema.safeParse(values)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Перевірте поля')
      return
    }
    setSaving(true)
    try {
      await updateMyProfile(parsed.data)
      toast('Профіль збережено')
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося зберегти профіль')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-3" aria-label="Профіль">
      <label className="block text-sm font-medium">Імʼя
        <Input value={firstname} onChange={(e) => setFirstname(e.target.value)} className="mt-1 w-full" />
      </label>
      <label className="block text-sm font-medium">Прізвище
        <Input value={lastname} onChange={(e) => setLastname(e.target.value)} className="mt-1 w-full" />
      </label>
      <label className="block text-sm font-medium">Телефон
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full" />
      </label>
      <label className="block text-sm font-medium">Вік
        <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} className="mt-1 w-full" />
      </label>
      <label className="block text-sm font-medium">URL аватара
        <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="mt-1 w-full" />
      </label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={saving}>{saving ? 'Зберігаємо…' : 'Зберегти'}</Button>
    </form>
  )
}
