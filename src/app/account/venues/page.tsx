import { redirect } from 'next/navigation'
import Link from 'next/link'
import { serverFetch } from '@/lib/api/server-client'
import { getSessionTokens } from '@/lib/auth/session'
import { parseVenue, VENUE_STATUS_LABELS, type RawVenue } from '@/types/venue'

export default async function MyVenuesPage({
  searchParams,
}: {
  searchParams?: Promise<{ created?: string }>
} = {}) {
  const tokens = await getSessionTokens()
  if (!tokens) redirect('/auth/login?next=/account/venues')
  // searchParams опційний: у тестах компонент викликається без пропсів
  const { created } = (await searchParams) ?? {}
  const raw = await serverFetch<RawVenue[]>('/me/venues', { tokens, revalidate: 0 })
  const venues = raw.map(parseVenue)

  return (
    <section>
      {created === '1' && (
        <p role="status" className="mb-4 rounded-xl bg-success/15 p-3 text-success">Заклад подано на модерацію.</p>
      )}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Мої заклади</h2>
        <Link className="text-amber-500 hover:underline" href="/venues/new">Додати заклад</Link>
      </div>
      {venues.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-8 text-center">
          <p className="text-muted">Закладів поки немає.</p>
          <Link className="mt-4 inline-block text-amber-500 hover:underline" href="/venues/new">Подати перший заклад</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {venues.map((v) => (
            <li key={v.id} className="flex items-center gap-4 rounded-xl border border-line p-4">
              <div className="min-w-0 flex-1">
                <Link className="font-medium hover:underline" href={`/account/venues/${v.id}`}>{v.name}</Link>
                <p className="truncate text-sm text-muted">{v.address}</p>
              </div>
              <span className="rounded-full bg-raised px-2 py-0.5 text-xs text-muted">{VENUE_STATUS_LABELS[v.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
