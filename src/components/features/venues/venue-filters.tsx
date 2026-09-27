'use client'

// Фільтри каталогу: стан локальний, застосування — через URL (щоб SSR бачив усе).
// Компонування — «панель фільтрів» (варіант 2 з макетів): вузька колонка ліворуч
// від результатів (розкладку робить page.tsx); на мобільних (<sm) панель стає
// горизонтальною стрічкою фільтрів над сіткою. Пошук — у хедері (sm+); тут він
// лишений тільки для мобільних, бо хедерний інпут схований до sm.

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { CatalogQuery } from '@/lib/venues/query'
import { getVenueTags, type TagRef } from '@/services/venues'

// Рейтинг-фільтр зірками: цілі значення 1..5 (у URL досі можна 0.5-крок)
const RATING_STARS = [1, 2, 3, 4, 5] as const

// Довідник тегів GET /venues/tags — публічний; чип-клік перемикає slug у CSV

export function VenueFilters({ initial }: { initial: CatalogQuery }) {
  const router = useRouter()
  const [q, setQ] = useState(initial.q ?? '')
  const [sort, setSort] = useState(initial.sort)
  const [type, setType] = useState(initial.type ?? '')
  const [tag, setTag] = useState(initial.tag.join(', '))
  const [tags, setTags] = useState<TagRef[]>([])
  const [feature, setFeature] = useState(initial.feature.join(', '))
  const [minCheck, setMinCheck] = useState(initial.minCheck?.toString() ?? '')
  const [maxCheck, setMaxCheck] = useState(initial.maxCheck?.toString() ?? '')
  const [minRating, setMinRating] = useState(initial.minRating?.toString() ?? '')
  const [radiusKm, setRadiusKm] = useState(initial.radiusKm?.toString() ?? '5')
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(
    initial.lat !== undefined && initial.lng !== undefined ? { lat: initial.lat, lng: initial.lng } : null,
  )
  const [geoError, setGeoError] = useState<string | null>(null)

  // Довідник тегів для чипів (публічний ендпоінт, без авторизації)
  useEffect(() => {
    getVenueTags()
      .then(setTags)
      .catch(() => undefined)
  }, [])

  // Перемикання чипа: додає/забирає slug у CSV-стані тегів
  function toggleTagSlug(slug: string) {
    const active = tag.split(',').map((s) => s.trim()).filter(Boolean)
    const next = active.includes(slug)
      ? active.filter((s) => s !== slug)
      : [...active, slug]
    setTag(next.join(', '))
  }

  function apply(e: FormEvent) {
    e.preventDefault()
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (sort !== 'newest') p.set('sort', sort)
    if (type) p.set('type', type)
    if (tag) p.set('tag', tag)
    if (feature) p.set('feature', feature)
    if (minCheck) p.set('minCheck', minCheck)
    if (maxCheck) p.set('maxCheck', maxCheck)
    if (minRating) p.set('minRating', minRating)
    if (geo) {
      p.set('lat', String(geo.lat))
      p.set('lng', String(geo.lng))
      p.set('radiusKm', radiusKm)
    }
    router.push(`/?${p.toString()}`)
  }

  function nearMe() {
    if (!navigator.geolocation) return setGeoError('Геолокація недоступна у вашому браузері')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGeoError(null)
      },
      () => setGeoError('Не вдалося отримати геолокацію — перевірте дозвіл браузера'),
    )
  }

  return (
    <form
      onSubmit={apply}
      aria-label="Фільтри каталогу"
      className="w-full shrink-0 rounded-xl border border-line bg-surface p-4 lg:w-64"
    >
      {/* На мобільних — стрічка (flex-row + overflow-x-auto), на lg — вертикальна колонка */}
      <div className="flex gap-3 overflow-x-auto pb-1 lg:flex-col lg:gap-4 lg:overflow-visible lg:pb-0">
        {/* Пошук: у хедері (sm+) він уже є — тут показуємо лише до sm, щоб не дублювати */}
        <label className="w-44 shrink-0 text-sm sm:hidden">
          Пошук
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Назва або адреса" className="mt-1" />
        </label>
        <label className="w-44 shrink-0 text-sm lg:w-auto">
          Сортування
          <Select value={sort} onChange={(e) => setSort(e.target.value as CatalogQuery['sort'])} className="mt-1">
            <option value="newest">Нові</option>
            <option value="rating">За рейтингом</option>
            <option value="check">За середнім чеком</option>
            <option value="name">За алфавітом</option>
            <option value="distance" disabled={!geo}>Поблизу (потрібна геолокація)</option>
          </Select>
        </label>
        <label className="w-44 shrink-0 text-sm lg:w-auto">
          Тип закладу (slug)
          <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="напр. bar" className="mt-1" />
        </label>
        <div className="w-44 shrink-0 text-sm lg:w-auto">
          <span>Теги</span>
          {tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label="Теги">
              {tags.map((t) => {
                const active = tag.split(',').map((s) => s.trim()).includes(t.slug)
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleTagSlug(t.slug)}
                    className={`rounded-full border px-2 py-0.5 text-xs leading-none transition-colors focus:outline-none focus-visible:border-amber-500 ${
                      active ? 'border-amber-500 text-amber-400' : 'border-line text-muted hover:text-amber-400'
                    }`}
                  >
                    #{t.name}
                  </button>
                )
              })}
            </div>
          )}
          <Input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="pyvo, sport"
            aria-label="Теги вручну (через кому)"
            className="mt-2"
          />
        </div>
        <label className="w-44 shrink-0 text-sm lg:w-auto">
          Фічі (через кому)
          <Input value={feature} onChange={(e) => setFeature(e.target.value)} placeholder="wifi, parking" className="mt-1" />
        </label>
        <label className="w-28 shrink-0 text-sm lg:w-auto">
          Чек від
          <Input type="number" min="0" value={minCheck} onChange={(e) => setMinCheck(e.target.value)} className="mt-1" />
        </label>
        <label className="w-28 shrink-0 text-sm lg:w-auto">
          Чек до
          <Input type="number" min="0" value={maxCheck} onChange={(e) => setMaxCheck(e.target.value)} className="mt-1" />
        </label>
        {/* Рейтинг — фільтр зірками: повторний клік по активній зірці скидає */}
        <div className="w-44 shrink-0 lg:w-auto">
          <span className="text-sm">Рейтинг</span>
          <div role="group" aria-label="Рейтинг від" className="mt-1 flex items-center gap-1">
            {RATING_STARS.map((n) => {
              const on = minRating !== '' && Number(minRating) >= n
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={minRating === String(n)}
                  aria-label={`Рейтинг від ${n}`}
                  onClick={() => setMinRating(minRating === String(n) ? '' : String(n))}
                  className={`rounded-xl border px-2 py-1 text-sm leading-none transition-colors focus:outline-none focus-visible:border-amber-500 ${
                    on ? 'border-amber-500 text-amber-400' : 'border-line text-faint hover:text-amber-400'
                  }`}
                >
                  ★
                </button>
              )
            })}
            <span className="ml-1.5 text-xs text-faint">
              {minRating ? `від ${minRating.replace('.', ',')}` : 'будь-який'}
            </span>
          </div>
        </div>
        <div className="w-28 shrink-0 lg:w-auto">
          <label className="text-sm">
            Радіус (км)
            <Input type="number" min="0.1" max="100" step="0.5" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} className="mt-1" />
          </label>
          {geo && <span className="mt-1 block text-xs text-muted">Поблизу, радіус {radiusKm} км</span>}
        </div>
        <div className="flex shrink-0 gap-2 lg:w-auto lg:flex-col">
          <Button type="submit">Застосувати</Button>
          <Button type="button" variant="secondary" onClick={nearMe}>📍 Поблизу</Button>
          <Button type="button" variant="ghost" onClick={() => router.push('/')}>Скинути</Button>
        </div>
      </div>
      {geoError && <p role="alert" className="mt-2 text-sm text-danger">{geoError}</p>}
    </form>
  )
}