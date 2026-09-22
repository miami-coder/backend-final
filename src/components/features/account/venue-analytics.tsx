import { serverFetch } from '@/lib/api/server-client'
import { parseVenueAnalytics, type RawVenueAnalytics } from '@/types/analytics'
import { AnalyticsRangeForm } from '@/components/features/account/analytics-range-form'
import { getSessionTokens } from '@/lib/auth/session'

export async function VenueAnalytics({ venueId, from, to }: { venueId: string; from: string; to: string }) {
  const tokens = await getSessionTokens()
  const raw = await serverFetch<RawVenueAnalytics>(`/me/venues/${venueId}/analytics?from=${from}&to=${to}`, {
    tokens, revalidate: 0,
  }).catch(() => null)
  if (!raw) {
    return <p className="text-sm text-danger">Не вдалося завантажити аналітику.</p>
  }
  const a = parseVenueAnalytics(raw)
  const max = Math.max(1, ...a.viewsByDay.map((d) => d.count))

  return (
    <section aria-label="Аналітика закладу">
      <AnalyticsRangeForm from={from} to={to} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line p-4">
          <p className="text-sm text-muted">Перегляди за період</p>
          <p className="text-2xl font-bold">{a.totalViews}</p>
        </div>
        <div className="rounded-xl border border-line p-4">
          <p className="text-sm text-muted">Події за типами</p>
          {a.eventsByType.length === 0 ? (
            <p className="mt-1 text-sm text-muted">Немає даних</p>
          ) : (
            <ul className="mt-1 text-sm">
              {a.eventsByType.map((e) => (
                <li key={e.eventType} className="flex justify-between">
                  <span>{e.eventType}</span><span>{e.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-line p-4">
        <p className="mb-2 text-sm text-muted">Перегляди за днями</p>
        {a.viewsByDay.length === 0 ? (
          <p className="text-sm text-muted">Немає даних</p>
        ) : (
          <svg viewBox={`0 0 ${a.viewsByDay.length * 24} 100`} className="h-32 w-full" role="img" aria-label="Графік переглядів за днями">
            {a.viewsByDay.map((d, i) => (
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
        )}
      </div>
    </section>
  )
}
