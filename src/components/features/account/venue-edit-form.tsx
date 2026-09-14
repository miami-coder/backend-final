'use client'

// Форма редагування закладу: патерн VenueCreateForm, але сабміт — PATCH
// /venues/:id лише зі ЗМІНЕНИМИ полями (venueUpdateSchema, Task 3), успіх →
// toast + router.refresh(). Фічі/теги/тип PATCH ігнорує — полів немає,
// поточні значення показуємо чипами read-only.
//
// ВАЖЛИВО: бекенд PATCH замінює contacts/workingHours ОБʼЄКТ ЦІЛІКОМ
// (dto.contacts ?? venue.contacts), тому при зміні хоча б одного поля
// надсилаємо повний обʼєкт (усі непорожні значення), інакше втратили б
// решту. Очистити поле через PATCH неможливо (?? лишає старе) — порожнє
// значення просто не надсилається.

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import { ApiError } from '@/lib/api/parse'
import { venueUpdateSchema, WH_DAYS } from '@/lib/validation/venue'
import type { Venue } from '@/types/venue'

const DAY_LABELS: Record<string, string> = {
  monday: 'Понеділок', tuesday: 'Вівторок', wednesday: 'Середа', thursday: 'Четвер',
  friday: 'Пʼятниця', saturday: 'Субота', sunday: 'Неділя',
}

export function VenueEditForm({ venue }: { venue: Venue }) {
  const router = useRouter()
  const { toast } = useToast()
  const [name, setName] = useState(venue.name)
  const [address, setAddress] = useState(venue.address)
  const [description, setDescription] = useState(venue.description ?? '')
  const [latitude, setLatitude] = useState(venue.latitude !== null ? String(venue.latitude) : '')
  const [longitude, setLongitude] = useState(venue.longitude !== null ? String(venue.longitude) : '')
  const [phone, setPhone] = useState(venue.contacts.phone ?? '')
  const [instagram, setInstagram] = useState(venue.contacts.instagram ?? '')
  const [facebook, setFacebook] = useState(venue.contacts.facebook ?? '')
  const [website, setWebsite] = useState(venue.contacts.website ?? '')
  const [hours, setHours] = useState<Record<string, string>>({ ...venue.workingHours })
  const [averageCheck, setAverageCheck] = useState(venue.averageCheck !== null ? String(venue.averageCheck) : '')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    // DTO лише зі зміненими полями (порожні опційні НЕ надсилаємо —
    // whitelist на бекенді; «очистити» через PATCH неможливо за дизайном)
    const dto: Record<string, unknown> = {}
    if (name.trim() !== venue.name) dto.name = name.trim()
    if (address.trim() !== venue.address) dto.address = address.trim()
    if (description.trim() !== (venue.description ?? '')) {
      if (description.trim()) dto.description = description.trim()
    }
    const currentLat = venue.latitude !== null ? String(venue.latitude) : ''
    if (latitude.trim() !== currentLat && latitude.trim()) dto.latitude = Number(latitude)
    const currentLng = venue.longitude !== null ? String(venue.longitude) : ''
    if (longitude.trim() !== currentLng && longitude.trim()) dto.longitude = Number(longitude)
    const contactsChanged =
      phone.trim() !== (venue.contacts.phone ?? '') ||
      instagram.trim() !== (venue.contacts.instagram ?? '') ||
      facebook.trim() !== (venue.contacts.facebook ?? '') ||
      website.trim() !== (venue.contacts.website ?? '')
    if (contactsChanged) {
      // повний обʼєкт: PATCH замінює contacts повністю, частковий обʼєкт стер би решту
      dto.contacts = {
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(instagram.trim() ? { instagram: instagram.trim() } : {}),
        ...(facebook.trim() ? { facebook: facebook.trim() } : {}),
        ...(website.trim() ? { website: website.trim() } : {}),
      }
    }
    const hoursChanged = WH_DAYS.some(
      (d) => (hours[d] ?? '').trim() !== (venue.workingHours[d] ?? ''),
    )
    if (hoursChanged) {
      // повний запис: PATCH замінює workingHours повністю
      dto.workingHours = Object.fromEntries(
        WH_DAYS.map((d) => [d, (hours[d] ?? '').trim()]).filter(([, v]) => v),
      )
    }
    const currentCheck = venue.averageCheck !== null ? String(venue.averageCheck) : ''
    if (averageCheck.trim() !== currentCheck && averageCheck.trim()) {
      dto.averageCheck = Number(averageCheck)
    }
    const parsed = venueUpdateSchema.safeParse(dto)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Перевірте поля')
      return
    }
    if (Object.keys(parsed.data).length === 0) {
      setError('Немає змін')
      return
    }
    setSending(true)
    try {
      // content-type обовʼязковий: BFF-проксі не проставляє його сам
      await api(`/venues/${venue.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      toast('Зміни збережено')
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося зберегти зміни')
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="Редагування закладу">
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
      {(venue.types.length > 0 || venue.features.length > 0 || venue.tags.length > 0) && (
        <div className="rounded-xl border border-stone-200 p-3 text-sm">
          <p className="mb-2 text-xs text-stone-500">Тип, фічі та теги — лише для перегляду (редагуються під час модерації):</p>
          <div className="flex flex-wrap gap-2">
            {venue.types.map((t) => (
              <span key={t.id} className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">{t.name}</span>
            ))}
            {venue.features.map((f) => (
              <span key={f.id} className="rounded-lg border border-stone-200 px-3 py-1 text-xs">
                {f.icon ? `${f.icon} ` : ''}{f.name}
              </span>
            ))}
            {venue.tags.map((t) => (
              <span key={t.id} className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">#{t.name}</span>
            ))}
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={sending}>{sending ? 'Зберігаємо…' : 'Зберегти зміни'}</Button>
    </form>
  )
}
