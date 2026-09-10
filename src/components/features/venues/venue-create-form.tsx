'use client'

// Форма подання закладу: zod-валідація Task 3 (venueCreateSchema) перед
// POST /venues → 201. Порожні опційні поля НЕ надсилаємо (whitelist на
// бекенді, порожні рядки ламали б MinLength/regex), успіх → модераційний
// редірект на кабінет з ?created=1.

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api/client'
import { ApiError } from '@/lib/api/parse'
import { venueCreateSchema, WH_DAYS, csvToArray } from '@/lib/validation/venue'

const DAY_LABELS: Record<string, string> = {
  monday: 'Понеділок', tuesday: 'Вівторок', wednesday: 'Середа', thursday: 'Четвер',
  friday: 'Пʼятниця', saturday: 'Субота', sunday: 'Неділя',
}

export function VenueCreateForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [phone, setPhone] = useState('')
  const [instagram, setInstagram] = useState('')
  const [facebook, setFacebook] = useState('')
  const [website, setWebsite] = useState('')
  const [hours, setHours] = useState<Record<string, string>>({})
  const [averageCheck, setAverageCheck] = useState('')
  const [featureCodes, setFeatureCodes] = useState('')
  const [tagSlugs, setTagSlugs] = useState('')
  const [typeSlug, setTypeSlug] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const workingHours = Object.fromEntries(
      Object.entries(hours).filter(([, v]) => v.trim()),
    )
    const dto = {
      name,
      address,
      description: description.trim() || undefined,
      latitude: latitude.trim() ? Number(latitude) : undefined,
      longitude: longitude.trim() ? Number(longitude) : undefined,
      contacts: (phone.trim() || instagram.trim() || facebook.trim() || website.trim())
        ? {
            ...(phone.trim() ? { phone } : {}),
            ...(instagram.trim() ? { instagram } : {}),
            ...(facebook.trim() ? { facebook } : {}),
            ...(website.trim() ? { website } : {}),
          }
        : undefined,
      workingHours: Object.keys(workingHours).length ? workingHours : undefined,
      averageCheck: averageCheck.trim() ? Number(averageCheck) : undefined,
      featureCodes: csvToArray(featureCodes).length ? csvToArray(featureCodes) : undefined,
      tagSlugs: csvToArray(tagSlugs).length ? csvToArray(tagSlugs) : undefined,
      typeSlug: typeSlug.trim() || undefined,
    }
    const parsed = venueCreateSchema.safeParse(dto)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Перевірте поля')
      return
    }
    setSending(true)
    try {
      // content-type обовʼязковий: BFF-проксі не проставляє його сам
      await api('/venues', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      router.push('/account/venues?created=1')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося подати заклад')
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="Створення закладу">
      <label className="block text-sm font-medium">Назва
        <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full" />
      </label>
      <label className="block text-sm font-medium">Адреса
        <Input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1 w-full" />
      </label>
      <label className="block text-sm font-medium">Опис
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">Широта
          <Input value={latitude} onChange={(e) => setLatitude(e.target.value)} className="mt-1 w-full" inputMode="decimal" />
        </label>
        <label className="block text-sm font-medium">Довгота
          <Input value={longitude} onChange={(e) => setLongitude(e.target.value)} className="mt-1 w-full" inputMode="decimal" />
        </label>
      </div>
      <fieldset className="rounded-xl border border-stone-200 p-3">
        <legend className="px-1 text-sm font-medium">Контакти</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон" aria-label="Телефон" />
          <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="Instagram" aria-label="Instagram" />
          <Input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="Facebook" aria-label="Facebook" />
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Сайт" aria-label="Сайт" />
        </div>
      </fieldset>
      <fieldset className="rounded-xl border border-stone-200 p-3">
        <legend className="px-1 text-sm font-medium">Години роботи (формат HH:MM-HH:MM, порожнє — вихідний)</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {WH_DAYS.map((d) => (
            <label key={d} className="block text-xs text-stone-500">
              {DAY_LABELS[d]}
              <Input
                value={hours[d] ?? ''}
                onChange={(e) => setHours((h) => ({ ...h, [d]: e.target.value }))}
                placeholder="10:00-22:00"
                aria-label={`Години: ${DAY_LABELS[d]}`}
                className="mt-0.5 w-full"
              />
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-medium">Середній чек (₴)
        <Input type="number" min="0" value={averageCheck} onChange={(e) => setAverageCheck(e.target.value)} className="mt-1 w-full" />
      </label>
      <label className="block text-sm font-medium">Фічі (через кому, до 20)
        <Input value={featureCodes} onChange={(e) => setFeatureCodes(e.target.value)} className="mt-1 w-full" />
      </label>
      <label className="block text-sm font-medium">Теги (через кому, до 20)
        <Input value={tagSlugs} onChange={(e) => setTagSlugs(e.target.value)} className="mt-1 w-full" />
      </label>
      <label className="block text-sm font-medium">Тип (slug)
        <Input value={typeSlug} onChange={(e) => setTypeSlug(e.target.value)} className="mt-1 w-full" />
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={sending}>{sending ? 'Подаємо…' : 'Подати заклад'}</Button>
      <p className="text-sm text-stone-500">Заклад буде відправлено на модерацію.</p>
    </form>
  )
}
