'use client'

// Адмін-аналітика переглядів (пункти ТЗ 8-9): часовий ряд —
// GET /admin/analytics/timeseries?from&to&granularity=day|week|month
// (SVG-бари як у venue-analytics) + розріз по закладах —
// GET /admin/analytics/venues?from&to (топ за переглядами).
// Діапазон застосовується через URL (SSR-фетч у page.tsx).

import { type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils/format'

const GRANULARITIES = [
  { value: 'day', label: 'Дні' },
  { value: 'week', label: 'Тижні' },
  { value: 'month', label: 'Місяці' },
] as const

export type Granularity = (typeof GRANULARITIES)[number]['value']

export interface TimeseriesPoint {
  date: string
  count: number
}

export interface VenueStat {
  venueId: string
  venueName: string | null
  views: number
}

export function AdminAnalyticsControls({ from, to, granularity }: { from: string; to: string; granularity: Granularity }) {
  const router = useRouter()
  const sp = useSearchParams()

  function apply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const p = new URLSearchParams()
    p.set('from', String(fd.get('from') ?? from))
    p.set('to', String(fd.get('to') ?? to))
    p.set('granularity', String(fd.get('granularity') ?? granularity))
    router.push(`/admin/analytics?${p.toString()}`)
  }

  function reset() {
    const p = new URLSearchParams(sp)
    p.delete('from')
    p.delete('to')
    p.delete('granularity')
    router.push(`/admin/analytics${p.size ? `?${p}` : ''}`)
  }

  return (
    <form onSubmit={apply} aria-label="Параметри аналітики" className="flex flex-wrap items-end gap-3">
      <label className="text-sm">
        З
        <Input type="date" name="from" defaultValue={from} className="mt-1 block" />
      </label>
      <label className="text-sm">
        По
        <Input type="date" name="to" defaultValue={to} className="mt-1 block" />
      </label>
      <label className="text-sm">
        Гранулярність
        <Select name="granularity" defaultValue={granularity} className="mt-1">
          {GRANULARITIES.map((g) => (
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </Select>
      </label>
      <div className="flex gap-2">
        <Button type="submit">Застосувати</Button>
        <Button type="button" variant="ghost" onClick={reset}>Скинути</Button>
      </div>
    </form>
  )
}

export function TimeseriesChart({ data }: { data: TimeseriesPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  if (data.length === 0) {
    return <p className="text-sm text-muted">Немає даних</p>
  }
  return (
    <svg viewBox={`0 0 ${data.length * 24} 100`} className="h-32 w-full" role="img" aria-label="Графік переглядів">
      {data.map((d, i) => (
        <rect
          key={d.date}
          x={i * 24 + 4}
          y={100 - (d.count / max) * 90}
          width={16}
          height={(d.count / max) * 90}
          rx={2}
          className="fill-amber-500"
        >
          <title>{`${d.date}: ${d.count}`}</title>
        </rect>
      ))}
    </svg>
  )
}

export function VenueStatsTable({ data }: { data: VenueStat[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted">Немає даних</p>
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-muted">
          <th className="py-1 pr-3 font-normal">Заклад</th>
          <th className="py-1 font-normal">Перегляди</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {data.map((v) => (
          <tr key={v.venueId}>
            <td className="py-1 pr-3">{v.venueName ?? v.venueId}</td>
            <td className="py-1">{v.views}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function AnalyticsPeriodLabel({ from, to }: { from: string; to: string }) {
  return (
    <p className="text-sm text-muted">
      Період: {formatDate(from)} — {formatDate(to)}
    </p>
  )
}