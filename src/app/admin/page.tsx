import { serverFetch, serverFetchList } from '@/lib/api/server-client'
import { getSessionTokens } from '@/lib/auth/session'

interface RawOverview {
  totalViews: number
  totalEvents: number
  eventsByType: { eventType: string; count: number }[]
}

// Плитка-лічильник: число font-display бурштинове + faint-підпис, без кліку
function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="font-display text-2xl font-semibold text-amber-400">{value}</div>
      <div className="mt-1 text-sm text-faint">{label}</div>
    </div>
  )
}

export const revalidate = 0

// «Огляд»: плитки аналітики (overview падає тихо → «—») + лічильники секцій з meta.total
export default async function AdminOverviewPage() {
  const tokens = await getSessionTokens()
  const [overview, venues, users, complaints, news] = await Promise.all([
    serverFetch<RawOverview>('/admin/analytics/overview', { tokens, revalidate: 0 }).catch(() => null),
    serverFetchList('/admin/venues/pending?limit=1', { tokens, revalidate: 0 }),
    serverFetchList('/admin/users?limit=1', { tokens, revalidate: 0 }),
    serverFetchList('/admin/complaints?limit=1', { tokens, revalidate: 0 }),
    serverFetchList('/admin/news?limit=1', { tokens, revalidate: 0 }),
  ])
  return (
    <section aria-label="Огляд системи" className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <Tile label="Перегляди" value={overview ? overview.totalViews : '—'} />
      <Tile label="Події" value={overview ? overview.totalEvents : '—'} />
      <Tile label="Заклади на модерації" value={venues.meta?.total ?? 0} />
      <Tile label="Користувачі" value={users.meta?.total ?? 0} />
      <Tile label="Скарги" value={complaints.meta?.total ?? 0} />
      <Tile label="Новини" value={news.meta?.total ?? 0} />
    </section>
  )
}
