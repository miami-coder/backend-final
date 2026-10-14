import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { VenueAnalytics } from '@/components/features/account/venue-analytics'
import { VenueEditForm } from '@/components/features/account/venue-edit-form'
import { VenueMessagesManager } from '@/components/features/account/venue-messages-manager'
import { VenueNewsManager } from '@/components/features/account/venue-news-manager'
import { VenuePhotoManager } from '@/components/features/account/venue-photo-manager'
import { VenueDeleteButton } from '@/components/features/venues/venue-delete-button'
import { getVenueNews } from '@/services/news.server'
import { getOwnerVenue } from '@/services/venues.server'
import { getVenueComplaintsPage } from '@/services/complaints.server'
import { getVenueMessages } from '@/services/messages.server'
import { getSessionTokens } from '@/lib/auth/session'
import { parseMessage, type RawMessage } from '@/types/message'
import { parseNews, type RawNews } from '@/types/news'
import { parseVenue, VENUE_STATUS_LABELS } from '@/types/venue'
import { parseComplaint, type AdminComplaint } from '@/types/admin'
import { COMPLAINT_REASONS } from '@/lib/validation/complaint'
import { formatDate } from '@/lib/utils/format'
import { Pagination } from '@/components/ui/pagination'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; from?: string; to?: string; page?: string }>
}

const TABS = [
  { key: 'edit', label: 'Редагування' },
  { key: 'photos', label: 'Фото' },
  { key: 'news', label: 'Новини' },
  { key: 'messages', label: 'Повідомлення' },
  { key: 'analytics', label: 'Аналітика' },
  { key: 'complaints', label: 'Скарги' },
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
  const raw = await getOwnerVenue(id, tokens).catch(() => null)
  if (!raw) notFound()
  const venue = parseVenue(raw)

  const sp = await searchParams
  const tab: TabKey = TABS.some((t) => t.key === sp?.tab) ? (sp.tab as TabKey) : 'edit'
  // Публічний список /news?venueId= → only published (заархівовані зникають)
  const news = tab === 'news'
    ? (await getVenueNews(venue.id, tokens)).data.map(parseNews)
    : []
  // Скринька власника: повідомлення користувачів про заклад
  const messages = tab === 'messages'
    ? (await getVenueMessages(venue.id, tokens)).data.map(parseMessage)
    : []
  // Скарги до закладу (черга New/InReview, читає лише власник/супер-адмін);
  // вирішення — лише в супер-адміна, тому тут список без кнопок дій
  let complaints: AdminComplaint[] = []
  let complaintsTotal = 0
  if (tab === 'complaints') {
    const page = Math.max(1, Number(sp?.page ?? 1) || 1)
    try {
      const list = await getVenueComplaintsPage(venue.id, page, tokens)
      complaints = list.data.map(parseComplaint)
      complaintsTotal = list.meta?.total ?? 0
    } catch {
      complaints = []
    }
  }

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
      {tab === 'complaints' && (
        complaints.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">Скарг немає.</p>
        ) : (
          <section aria-label="Скарги до закладу" className="space-y-4">
            <ul className="grid gap-4 sm:grid-cols-2">
              {complaints.map((c) => (
                <li key={c.id} className="rounded-xl border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                      {COMPLAINT_REASONS.find((r) => r.value === c.reason)?.label ?? 'Інше'}
                    </span>
                    <span className="text-sm text-muted">{c.venueId ? 'Заклад' : c.reviewId ? 'Відгук' : '—'}</span>
                    <span className="ml-auto text-xs text-faint">{formatDate(c.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm text-ink">
                    {c.text.length > 140 ? c.text.slice(0, 140) + '…' : c.text}
                  </p>
                </li>
              ))}
            </ul>
            {Math.ceil(complaintsTotal / 20) > 1 && (
              <Pagination
                page={Number(sp?.page ?? 1) || 1}
                totalPages={Math.ceil(complaintsTotal / 20)}
                hrefFor={(p) => `/account/venues/${venue.id}?tab=complaints&page=${p}`}
              />
            )}
          </section>
        )
      )}
    </div>
  )
}
