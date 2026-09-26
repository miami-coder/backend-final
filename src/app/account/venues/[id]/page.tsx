import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { VenueAnalytics } from '@/components/features/account/venue-analytics'
import { VenueEditForm } from '@/components/features/account/venue-edit-form'
import { VenueMessagesManager } from '@/components/features/account/venue-messages-manager'
import { VenueNewsManager } from '@/components/features/account/venue-news-manager'
import { VenuePhotoManager } from '@/components/features/account/venue-photo-manager'
import { VenueDeleteButton } from '@/components/features/venues/venue-delete-button'
import { serverFetch, serverFetchList } from '@/lib/api/server-client'
import { getSessionTokens } from '@/lib/auth/session'
import { parseMessage, type RawMessage } from '@/types/message'
import { parseNews, type RawNews } from '@/types/news'
import { parseVenue, VENUE_STATUS_LABELS, type RawVenue } from '@/types/venue'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; from?: string; to?: string }>
}

const TABS = [
  { key: 'edit', label: 'Редагування' },
  { key: 'photos', label: 'Фото' },
  { key: 'news', label: 'Новини' },
  { key: 'messages', label: 'Повідомлення' },
  { key: 'analytics', label: 'Аналітика' },
] as const

type TabKey = (typeof TABS)[number]['key']

// Формат дати аналітики з URL (YYYY-MM-DD): сире значення з query не
// інтерполюємо у запит — невалідне відкидаємо на дефолтний період
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// react-hooks/purity не пускає Date.now()/new Date() прямо в рендері —
// обгортаємо дефолтний період (to = сьогодні, from = to − 30 днів) у хелпер
function defaultAnalyticsRange() {
  return {
    to: new Date().toLocaleDateString('en-CA'),
    from: new Date(Date.now() - 30 * 86400000).toLocaleDateString('en-CA'),
  }
}

export default async function ManageVenuePage({ params, searchParams }: Props) {
  const tokens = await getSessionTokens()
  if (!tokens) redirect('/auth/login?next=/account/venues')
  const { id } = await params
  // serverFetch розгортає {data}-конверт сам; будь-яка помилка (403 чужий
  // заклад / 404 не існує / мережа) → notFound (глобальний 404 достатній)
  const raw = await serverFetch<RawVenue>(`/me/venues/${id}`, { tokens, revalidate: 0 }).catch(() => null)
  if (!raw) notFound()
  const venue = parseVenue(raw)

  const sp = await searchParams
  const tab: TabKey = TABS.some((t) => t.key === sp?.tab) ? (sp.tab as TabKey) : 'edit'
  // Публічний список /news?venueId= → only published (заархівовані зникають):
  // serverFetchList повертає {data, meta?}-конверт (на відміну від serverFetch)
  const news = tab === 'news'
    ? (await serverFetchList<RawNews>(`/news?venueId=${venue.id}`, { tokens, revalidate: 0 })).data.map(parseNews)
    : []
  // Скринька власника: повідомлення користувачів про заклад
  const messages = tab === 'messages'
    ? (
      await serverFetchList<RawMessage>(`/me/venues/${venue.id}/messages`, { tokens, revalidate: 0 })
    ).data.map(parseMessage)
    : []

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h2 className="font-display text-lg font-semibold">{venue.name}</h2>
        <span className="rounded-full bg-raised px-2 py-0.5 text-xs text-muted">
          {VENUE_STATUS_LABELS[venue.status]}
        </span>
        <Link className="text-sm text-amber-500 hover:underline" href={`/venues/${venue.id}`}>Публічна сторінка</Link>
        {/* М'яке видалення: після нього ця сторінка не існує → редірект у список */}
        <VenueDeleteButton venueId={venue.id} redirectTo="/account/venues" />
      </div>
      <nav className="mb-4 flex gap-3 border-b border-line pb-2 text-sm" aria-label="Керування закладом">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/account/venues/${venue.id}?tab=${t.key}`}
            aria-current={t.key === tab ? 'page' : undefined}
            className={t.key === tab ? 'font-semibold text-amber-500' : 'text-muted hover:text-amber-500'}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === 'edit' && <VenueEditForm venue={venue} />}
      {tab === 'photos' && <VenuePhotoManager venueId={venue.id} photos={venue.photos} />}
      {tab === 'news' && <VenueNewsManager venueId={venue.id} news={news} />}
      {tab === 'messages' && <VenueMessagesManager venueId={venue.id} messages={messages} />}
      {tab === 'analytics' && (
        // діапазон із URL (YYYY-MM-DD, en-CA); дефолт — сьогодні / сьогодні − 30 днів
        <VenueAnalytics
          venueId={venue.id}
          from={sp?.from && DATE_RE.test(sp.from) ? sp.from : defaultAnalyticsRange().from}
          to={sp?.to && DATE_RE.test(sp.to) ? sp.to : defaultAnalyticsRange().to}
        />
      )}
    </div>
  )
}
