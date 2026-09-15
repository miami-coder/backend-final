'use client'

// Форма подання закладу: zod-валідація Task 3 (venueCreateSchema) перед
// POST /venues → 201. Порожні опційні поля НЕ надсилаємо (whitelist на
// бекенді, порожні рядки ламали б MinLength/regex), успіх → модераційний
// редірект на кабінет з ?created=1. Помилки валідації — по-полівну під
// інпутом (роль alert + aria-describedby), з іменем поля в тексті.

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

// Людські назви полів для по-полівних помилок (ключ — zod-issue path)
const FIELD_LABELS: Record<string, string> = {
  name: 'Назва',
  address: 'Адреса',
  description: 'Опис',
  'contacts.phone': 'Телефон',
  'contacts.instagram': 'Instagram',
  'contacts.facebook': 'Facebook',
  'contacts.website': 'Сайт',
  workingHours: 'Години роботи',
  averageCheck: 'Середній чек (₴)',
  featureCodes: 'Фічі',
  tagSlugs: 'Теги',
  typeSlug: 'Тип',
}

function fieldLabel(path: ReadonlyArray<PropertyKey>): string {
  const key = path.join('.')
  if (key.startsWith('workingHours.')) {
    const day = String(path[path.length - 1])
    return `Години роботи (${DAY_LABELS[day] ?? day})`
  }
  return FIELD_LABELS[key] ?? key
}

export function VenueCreateForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [phone, setPhone] = useState('')
  const [instagram, setInstagram] = useState('')
  const [facebook, setFacebook] = useState('')
  const [website, setWebsite] = useState('')
  const [hours, setHours] = useState<Record<string, string>>({})
  const [averageCheck, setAverageCheck] = useState('')
  const [featureCodes, setFeatureCodes] = useState('')
  const [tagSlugs, setTagSlugs] = useState('')
  const [typeSlug, setTypeSlug] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    const workingHours = Object.fromEntries(
      Object.entries(hours).filter(([, v]) => v.trim()),
    )
    const dto = {
      name,
      address,
      description: description.trim() || undefined,
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
      // Кожна issue — під своїм інпутом: ключ = zod path, текст = «Поле: причина»
      const errors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.length ? issue.path.join('.') : '_'
        if (!errors[key]) errors[key] = `${fieldLabel(issue.path)}: ${issue.message}`
      }
      setFieldErrors(errors)
      return
    }
    setSending(true)
    try {
      // content-type обовʼязковий: BFF-проксі не проставляє його сам
      const created = await api<{ id: string }>('/venues', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      // Фото — після створення (ендпоінт привʼязаний до id): по одному файлу
      // на запит. Помилка окремого фото не скасовує подання (заклад уже
      // створений) — редірект іде далі, повторно завантажити можна у
      // вкладці «Фото» кабінету.
      for (const file of photos) {
        const fd = new FormData()
        fd.append('file', file)
        await api(`/venues/${created?.id}/photos`, { method: 'POST', body: fd })
      }
      router.push('/account/venues?created=1')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося подати заклад')
      setSending(false)
    }
  }

  const err = (key: string) =>
    fieldErrors[key] && (
      <span role="alert" className="mt-1 block text-red-600">{fieldErrors[key]}</span>
    )

  // Зірочка — видимий маркер обовʼязковості, прихована від скрінрідера
  // (вимога передає aria-required на інпуті)
  const req = (
    <span aria-hidden="true" className="text-red-600">
      {' '}*
    </span>
  )

  return (
    // noValidate: нативні бульбашки конфліктують з інлайн-помилками (як у register-form)
    <form noValidate onSubmit={submit} className="space-y-3" aria-label="Створення закладу">
      <div className="text-sm">
        <label htmlFor="vn-name">Назва{req}</label>
        <Input
          id="vn-name"
          required
          aria-required="true"
          aria-describedby={fieldErrors.name ? 'vn-name-error' : undefined}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full"
        />
        {fieldErrors.name && (
          <span id="vn-name-error" role="alert" className="mt-1 block text-red-600">{fieldErrors.name}</span>
        )}
      </div>
      <div className="text-sm">
        <label htmlFor="vn-address">Адреса{req}</label>
        <Input
          id="vn-address"
          required
          aria-required="true"
          aria-describedby={fieldErrors.address ? 'vn-address-error' : undefined}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="mt-1 w-full"
        />
        {fieldErrors.address && (
          <span id="vn-address-error" role="alert" className="mt-1 block text-red-600">{fieldErrors.address}</span>
        )}
      </div>
      <div className="text-sm">
        <label htmlFor="vn-description">Опис</label>
        <Textarea
          id="vn-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full"
        />
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
        {WH_DAYS.map((d) =>
          fieldErrors[`workingHours.${d}`] && (
            <span key={`wh-${d}`} role="alert" className="block text-red-600">
              {fieldErrors[`workingHours.${d}`]}
            </span>
          ),
        )}
      </fieldset>
      <div className="text-sm">
        <label htmlFor="vn-check">Середній чек (₴)</label>
        <Input
          id="vn-check"
          type="number"
          min="0"
          aria-describedby={fieldErrors.averageCheck ? 'vn-check-error' : undefined}
          value={averageCheck}
          onChange={(e) => setAverageCheck(e.target.value)}
          className="mt-1 w-full"
        />
        {fieldErrors.averageCheck && (
          <span id="vn-check-error" role="alert" className="mt-1 block text-red-600">{fieldErrors.averageCheck}</span>
        )}
      </div>
      <div className="text-sm">
        <label htmlFor="vn-features">Фічі (через кому, до 20)</label>
        <Input
          id="vn-features"
          value={featureCodes}
          onChange={(e) => setFeatureCodes(e.target.value)}
          className="mt-1 w-full"
        />
        {err('featureCodes')}
      </div>
      <div className="text-sm">
        <label htmlFor="vn-tags">Теги (через кому, до 20)</label>
        <Input
          id="vn-tags"
          value={tagSlugs}
          onChange={(e) => setTagSlugs(e.target.value)}
          className="mt-1 w-full"
        />
        {err('tagSlugs')}
      </div>
      <div className="text-sm">
        <label htmlFor="vn-type">Тип (slug)</label>
        <Input
          id="vn-type"
          value={typeSlug}
          onChange={(e) => setTypeSlug(e.target.value)}
          className="mt-1 w-full"
        />
        {err('typeSlug')}
      </div>
      <div className="text-sm">
        <label htmlFor="vn-photos">Фото закладу</label>
        <input
          id="vn-photos"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          aria-label="Фото закладу"
          onChange={(e) => setPhotos(e.target.files ? Array.from(e.target.files) : [])}
          className="mt-1 block w-full text-sm"
        />
        <p className="mt-1 text-xs text-stone-500">JPEG/PNG/WebP, до 5 МБ кожне. Перше фото стане головним.</p>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={sending}>{sending ? 'Подаємо…' : 'Подати заклад'}</Button>
      <p className="text-sm text-stone-500">Заклад буде відправлено на модерацію.</p>
    </form>
  )
}