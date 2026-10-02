import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RatingStars } from '@/components/ui/rating-stars'
import { PhotoGallery } from '@/components/features/venues/photo-gallery'
import { RouteButton } from '@/components/features/venues/route-button'
import { ViewRecorder } from '@/components/features/venues/view-recorder'
import { WorkingHours } from '@/components/features/venues/working-hours'
import { getSessionTokens } from '@/lib/auth/session'
import { ComplaintButton } from '@/components/features/complaints/complaint-button'
import { MessageToManagerButton } from '@/components/features/messages/message-to-manager-button'
import { FavoriteButton } from '@/components/features/venues/favorite-button'
import { HangoutButton } from '@/components/features/hangouts/hangout-button'
import { ReviewForm } from '@/components/features/venues/review-form'
import { ReviewList } from '@/components/features/venues/review-list'
import { NewsListItem } from '@/components/features/news/news-list-item'
import { getFavoriteIds, getVenueDetail } from '@/services/venues.server'
import { getVenueNews } from '@/services/news.server'
import { findMyReviewForVenue } from '@/services/reviews.server'
import { formatMoney } from '@/lib/utils/format'
import type { Venue } from '@/types/venue'
import { parseNews, type News } from '@/types/news'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sort?: string; page?: string }>
}

// У бекенді посилання зберігаються як введено: хендл (@u_pana, u_pana),
// «instagram.com/x» без схеми тощо — голий href робить їх відносними
// і «перекидає на сайт Пиячок». Нормалізуємо до абсолютного https-URL.
function normalizeContactHref(raw: string, host: string): string {
  const value = raw.trim()
  if (/^https?:\/\//i.test(value)) return value
  // хендл: «@name» або «name» без слешів/крапок — це не домен і не URL
  if (!value.includes('/') && !value.includes('.')) {
    return `https://${host}/${value.replace(/^@/, '')}`
  }
  // «instagram.com/name» або «facebook.com/x» без схеми — додаємо https
  return `https://${value.replace(/^\/+/, '')}`
}

function instagramHref(raw: string): string {
  return normalizeContactHref(raw, 'instagram.com')
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const venue = await getVenueDetail(id)
  return { title: venue ? `${venue.name} — Пиячок` : 'Заклад — Пиячок' }
}

export default async function VenuePage({ params, searchParams }: Props) {
  const { id } = await params
  const venue = await getVenueDetail(id)
  if (!venue) notFound()

  const sp = await searchParams
  const sort = sp?.sort ?? 'newest'
  const page = Math.max(1, Number(sp?.page ?? 1) || 1)

  // Початковий стан обраного: ендпоінту «чи в обраному» на бекенді немає —
  // визначаємо за list-проекцією /me/favorites
  const tokens = await getSessionTokens()
  let initialFavorite = false
  if (tokens) {
    try {
      initialFavorite = (await getFavoriteIds(tokens)).has(id)
    } catch {
      initialFavorite = false
    }
  }

  // мій відгук на цей заклад (ендпоінту «мій відгук на X» немає — шукаємо в /me/reviews)
  let myReview: { id: string; rating: number; text: string } | null = null
  if (tokens) {
    try {
      const found = await findMyReviewForVenue(id, tokens)
      if (found) myReview = { id: found.id, rating: found.rating, text: found.text }
    } catch {
      myReview = null
    }
  }

  // Публічні новини саме цього закладу (GET /news?venueId=): показуються
  // лише published; draft/archived тут не з'являються (анологічно вкладці /news)
  let venueNews: News[] = []
  try {
    const rawNews = await getVenueNews(id, tokens)
    venueNews = rawNews.data.map(parseNews)
  } catch {
    venueNews = []
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8">
      <ViewRecorder venueId={venue.id} />

      <PhotoGallery mainPhotoUrl={venue.mainPhotoUrl} photos={venue.photos} />

      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold text-ink">{venue.name}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <RatingStars value={venue.ratingAvg} />
          {venue.ratingCount > 0 && <span>{venue.ratingCount} відгуків</span>}
          <span aria-hidden>·</span>
          <span>Середній чек: {formatMoney(venue.averageCheck)}</span>
        </div>
        <p className="text-muted">{venue.address}</p>
        {venue.types.length > 0 && (
          <p className="text-sm text-muted">
            {venue.types.map((t) => t.name).join(' · ')}
          </p>
        )}
      </header>

      <div className="flex flex-wrap gap-3">
        <FavoriteButton venueId={venue.id} initialFavorite={initialFavorite} />
        <RouteButton venue={venue} />
        <HangoutButton venueId={venue.id} loginNext={`/venues/${venue.id}`} />
        <MessageToManagerButton venueId={venue.id} />
        <ComplaintButton target={{ venueId: venue.id }} loginNext={`/venues/${venue.id}`} />
      </div>

      {venue.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {venue.tags.map((tag) => (
            <Link
              key={tag.id}
              href={`/venues?tag=${tag.slug}`}
              className="rounded-full bg-raised px-3 py-1 text-xs text-muted hover:bg-strong"
            >
              #{tag.name}
            </Link>
          ))}
        </div>
      )}

      {venue.features.length > 0 && (
        <section aria-label="Особливості" className="flex flex-wrap gap-2">
          {venue.features.map((f) => (
            <span key={f.id} className="rounded-full border border-line px-3 py-1 text-xs">
              {f.icon ? `${f.icon} ` : ''}{f.name}
            </span>
          ))}
        </section>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        {Object.keys(venue.workingHours).length > 0 && (
          <section aria-label="Години роботи">
            <h2 className="mb-2 font-display font-semibold">Години роботи</h2>
            <WorkingHours hours={venue.workingHours} />
          </section>
        )}

        <section aria-label="Контакти">
          <h2 className="mb-2 font-display font-semibold">Контакти</h2>
          <ul className="space-y-1 text-sm">
            {venue.contacts.phone && <li><a className="text-amber-500 hover:underline" href={`tel:${venue.contacts.phone}`}>{venue.contacts.phone}</a></li>}
            {venue.contacts.instagram && <li><a className="text-amber-500 hover:underline" href={instagramHref(venue.contacts.instagram)} target="_blank" rel="noopener noreferrer">Instagram</a></li>}
            {venue.contacts.facebook && <li><a className="text-amber-500 hover:underline" href={normalizeContactHref(venue.contacts.facebook, 'facebook.com')} target="_blank" rel="noopener noreferrer">Facebook</a></li>}
            {venue.contacts.website && <li><a className="text-amber-500 hover:underline" href={normalizeContactHref(venue.contacts.website, 'example.com')} target="_blank" rel="noopener noreferrer">Сайт</a></li>}
            {!venue.contacts.phone && !venue.contacts.instagram && !venue.contacts.facebook && !venue.contacts.website && <li className="text-faint">Не вказано</li>}
          </ul>
        </section>
      </div>

      {venue.description && (
        <section aria-label="Опис">
          <h2 className="mb-2 font-display font-semibold">Про заклад</h2>
          <p className="whitespace-pre-line text-muted">{venue.description}</p>
        </section>
      )}

      {venueNews.length > 0 && (
        <section aria-label="Новини закладу" className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-semibold">Новини закладу</h2>
            <Link className="text-sm text-amber-500 hover:underline" href="/news">
              Усі новини
            </Link>
          </div>
          <ul className="border-t border-line">
            {venueNews.map((n) => (
              <NewsListItem key={n.id} item={n} />
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Відгуки" className="space-y-4">
        <h2 className="font-display text-xl font-semibold">Відгуки</h2>
        <ReviewForm venueId={venue.id} myReview={myReview} />
        <ReviewList venueId={venue.id} sort={sort} page={page} />
      </section>
    </div>
  )
}
