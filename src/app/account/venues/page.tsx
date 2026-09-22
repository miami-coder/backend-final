import { redirect } from 'next/navigation'
import Link from 'next/link'
import { serverFetch } from '@/lib/api/server-client'
import { getSessionTokens } from '@/lib/auth/session'
import { parseVenue, VENUE_STATUS_LABELS, type RawVenue, type Venue } from '@/types/venue'
import { Badge } from '@/components/ui/badge'
import { placeholderFor } from '@/lib/utils/placeholder'

// Статус → тон бейджа (обведений стиль): pending — warning, approved — success
const STATUS_TONES: Record<string, 'neutral' | 'brand' | 'success' | 'warning'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'neutral',
  archived: 'neutral',
}

// Рядок таблиці «Моїх закладів»: мініатюра + назва/адреса, статус-бейдж,
// метрики (рейтинг/перегляди — те, що віддає список /me/venues), «Керувати»
function VenueRow({ v }: { v: Venue }) {
  const thumb = v.mainPhotoUrl ?? v.photos[0]?.url ?? null
  return (
    <tr className="border-t border-line align-middle">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-raised">
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <div style={{ background: placeholderFor(v.id) }} className="h-full w-full" />
            )}
          </div>
          <div className="min-w-0">
            <Link className="font-medium text-ink hover:underline" href={`/account/venues/${v.id}`}>{v.name}</Link>
            <p className="truncate text-sm text-muted">{v.address}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge tone={STATUS_TONES[v.status]}>{VENUE_STATUS_LABELS[v.status]}</Badge>
      </td>
      <td className="px-4 py-3 text-ink">
        {v.ratingAvg !== null ? (
          <>
            {String(v.ratingAvg).replace('.', ',')}
            <span className="text-faint"> ({v.ratingCount})</span>
          </>
        ) : (
          <span className="text-faint">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-muted">{v.viewCount}</td>
      <td className="px-4 py-3 text-right">
        <Link
          className="inline-block rounded-xl border border-amber-500 px-3 py-1.5 text-[13px] text-amber-500 hover:bg-amber-400/15"
          href={`/account/venues/${v.id}`}
        >
          Керувати
        </Link>
      </td>
    </tr>
  )
}

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
        // Таблиця в картці: Заклад (мініатюра + назва + адреса) / Статус /
        // Рейтинг / Перегляди / дії (метрики ratingAvg/ratingCount/viewCount
        // віддає бекенд у списку /me/venues)
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-medium text-faint">
                <th scope="col" className="px-4 py-2">Заклад</th>
                <th scope="col" className="px-4 py-2">Статус</th>
                <th scope="col" className="px-4 py-2">Рейтинг</th>
                <th scope="col" className="px-4 py-2">Перегляди</th>
                <th scope="col" className="px-4 py-2 text-right">Дії</th>
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => (
                <VenueRow key={v.id} v={v} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
