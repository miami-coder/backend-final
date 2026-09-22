'use client'

// Фільтри каталогу: стан локальний, застосування — через URL (щоб SSR бачив усе)

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { CatalogQuery } from '@/lib/venues/query'

export function VenueFilters({ initial }: { initial: CatalogQuery }) {
  const router = useRouter()
  const [q, setQ] = useState(initial.q ?? '')
  const [sort, setSort] = useState(initial.sort)
  const [type, setType] = useState(initial.type ?? '')
  const [tag, setTag] = useState(initial.tag.join(', '))
  const [feature, setFeature] = useState(initial.feature.join(', '))
  const [minCheck, setMinCheck] = useState(initial.minCheck?.toString() ?? '')
  const [maxCheck, setMaxCheck] = useState(initial.maxCheck?.toString() ?? '')
  const [minRating, setMinRating] = useState(initial.minRating?.toString() ?? '')
  const [radiusKm, setRadiusKm] = useState(initial.radiusKm?.toString() ?? '5')
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(
    initial.lat !== undefined && initial.lng !== undefined ? { lat: initial.lat, lng: initial.lng } : null,
  )
  const [geoError, setGeoError] = useState<string | null>(null)

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
    <form onSubmit={apply} className="mb-6 rounded-xl border border-line bg-surface p-4" aria-label="Фільтри каталогу">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">
          Пошук
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Назва або адреса" />
        </label>
        <label className="text-sm">
          Сортування
          <Select value={sort} onChange={(e) => setSort(e.target.value as CatalogQuery['sort'])}>
            <option value="newest">Нові</option>
            <option value="rating">За рейтингом</option>
            <option value="check">За середнім чеком</option>
            <option value="name">За алфавітом</option>
            <option value="distance" disabled={!geo}>Поблизу (потрібна геолокація)</option>
          </Select>
        </label>
        <label className="text-sm">
          Тип закладу (slug)
          <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="напр. bar" />
        </label>
        <label className="text-sm">
          Теги (через кому)
          <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="pyvo, sport" />
        </label>
        <label className="text-sm">
          Фічі (через кому)
          <Input value={feature} onChange={(e) => setFeature(e.target.value)} placeholder="wifi, parking" />
        </label>
        <label className="text-sm">
          Чек від
          <Input type="number" min="0" value={minCheck} onChange={(e) => setMinCheck(e.target.value)} />
        </label>
        <label className="text-sm">
          Чек до
          <Input type="number" min="0" value={maxCheck} onChange={(e) => setMaxCheck(e.target.value)} />
        </label>
        <label className="text-sm">
          Рейтинг від
          <Input type="number" min="0" max="5" step="0.5" value={minRating} onChange={(e) => setMinRating(e.target.value)} />
        </label>
        <label className="text-sm">
          Радіус (км)
          <Input type="number" min="0.1" max="100" step="0.5" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit">Застосувати</Button>
        <Button type="button" variant="secondary" onClick={nearMe}>📍 Поблизу</Button>
        {geo && <span className="text-sm text-muted">Поблизу, радіус {radiusKm} км</span>}
        <Button type="button" variant="ghost" onClick={() => router.push('/')}>Скинути</Button>
      </div>
      {geoError && <p role="alert" className="mt-2 text-sm text-danger">{geoError}</p>}
    </form>
  )
}
