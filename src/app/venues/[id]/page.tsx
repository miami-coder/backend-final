import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RatingStars } from '@/components/ui/rating-stars'
import { PhotoGallery } from '@/components/features/venues/photo-gallery'
import { RouteButton } from '@/components/features/venues/route-button'
import { ViewRecorder } from '@/components/features/venues/view-recorder'
import { WorkingHours } from '@/components/features/venues/working-hours'
import { getSessionTokens } from '@/lib/auth/session'
import { FavoriteButton } from '@/components/features/venues/favorite-button'
import { ReviewForm } from '@/components/features/venues/review-form'
import { ReviewList } from '@/components/features/venues/review-list'
import { serverFetch, serverFetchList } from '@/lib/api/server-client'
import { formatMoney } from '@/lib/utils/format'
import { parseVenue, type RawVenue } from '@/types/venue'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sort?: string; page?: string }>
}

async function getVenue(id: string) {
  // Авторитетне джерело з 404-семантикою (не-approved → 404 на бекенді)
  const detail = await serverFetch<RawVenue>(`/venues/${id}`, { revalidate: 60 }).catch(() => null)
  if (!detail) return null

  // GET /venues/:id не повертає photos/tags/types/features (лише owner) —
  // збагачуємо через list-пошук за назвою; деградація тиха, якщо не знайшли
  let relations: RawVenue | null = null
  try {
    const list = await serverFetchList<RawVenue>(
      `/venues?q=${encodeURIComponent(detail.name)}&limit=100`,
      { revalidate: 60 },
    )
    relations = list.data.find((v) => v.id === detail.id) ?? null
  } catch {
    relations = null
  }

  return parseVenue(relations ?? detail)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const venue = await getVenue(id)
  return { title: venue ? `${venue.name} — Пиячок` : 'Заклад — Пиячок' }
}

export default async function VenuePage({ params, searchParams }: Props) {
  const { id } = await params
  const venue = await getVenue(id)
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
      const favs = await serverFetchList<{ id: string }>('/me/favorites?limit=100', {
        tokens,
        revalidate: 0,
      })
      initialFavorite = favs.data.some((f) => f.id === id)
    } catch {
      initialFavorite = false
    }
  }

  // мій відгук на цей заклад (ендпоінту «мій відгук на X» немає — шукаємо в /me/reviews)
  let myReview: { id: string; rating: number; text: string } | null = null
  if (tokens) {
    try {
      const mine = await serverFetchList<{ id: string; venueId: string; rating: number; text: string }>(
        '/me/reviews?limit=100',
        { tokens, revalidate: 0 },
      )
      const found = mine.data.find((r) => r.venueId === id)
      if (found) myReview = { id: found.id, rating: found.rating, text: found.text }
    } catch {
      myReview = null
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8">
      <ViewRecorder venueId={venue.id} />

      <PhotoGallery mainPhotoUrl={venue.mainPhotoUrl} photos={venue.photos} />

      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{venue.name}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-stone-500">
          <RatingStars value={venue.ratingAvg} />
          {venue.ratingCount > 0 && <span>{venue.ratingCount} відгуків</span>}
          <span aria-hidden>·</span>
          <span>Середній чек: {formatMoney(venue.averageCheck)}</span>
        </div>
        <p className="text-stone-600">{venue.address}</p>
        {venue.types.length > 0 && (
          <p className="text-sm text-stone-500">
            {venue.types.map((t) => t.name).join(' · ')}
          </p>
        )}
      </header>

      <div className="flex flex-wrap gap-3">
        <FavoriteButton venueId={venue.id} initialFavorite={initialFavorite} />
        <RouteButton venue={venue} />
        {/* Точка монтування: ComplaintButton (Task 12), HangoutButton (Task 13) */}
      </div>

      {venue.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {venue.tags.map((tag) => (
            <Link
              key={tag.id}
              href={`/venues?tag=${tag.slug}`}
              className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600 hover:bg-stone-200"
            >
              #{tag.name}
            </Link>
          ))}
        </div>
      )}

      {venue.features.length > 0 && (
        <section aria-label="Особливості" className="flex flex-wrap gap-2">
          {venue.features.map((f) => (
            <span key={f.id} className="rounded-lg border border-stone-200 px-3 py-1 text-xs">
              {f.icon ? `${f.icon} ` : ''}{f.name}
            </span>
          ))}
        </section>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        {Object.keys(venue.workingHours).length > 0 && (
          <section aria-label="Години роботи">
            <h2 className="mb-2 font-semibold">Години роботи</h2>
            <WorkingHours hours={venue.workingHours} />
          </section>
        )}

        <section aria-label="Контакти">
          <h2 className="mb-2 font-semibold">Контакти</h2>
          <ul className="space-y-1 text-sm">
            {venue.contacts.phone && <li><a className="text-brand-600 hover:underline" href={`tel:${venue.contacts.phone}`}>{venue.contacts.phone}</a></li>}
            {venue.contacts.instagram && <li><a className="text-brand-600 hover:underline" href={venue.contacts.instagram} target="_blank" rel="noopener noreferrer">Instagram</a></li>}
            {venue.contacts.facebook && <li><a className="text-brand-600 hover:underline" href={venue.contacts.facebook} target="_blank" rel="noopener noreferrer">Facebook</a></li>}
            {venue.contacts.website && <li><a className="text-brand-600 hover:underline" href={venue.contacts.website} target="_blank" rel="noopener noreferrer">Сайт</a></li>}
            {!venue.contacts.phone && !venue.contacts.instagram && !venue.contacts.facebook && !venue.contacts.website && <li className="text-stone-400">Не вказано</li>}
          </ul>
        </section>
      </div>

      {venue.description && (
        <section aria-label="Опис">
          <h2 className="mb-2 font-semibold">Про заклад</h2>
          <p className="whitespace-pre-line text-stone-700">{venue.description}</p>
        </section>
      )}

      <section aria-label="Відгуки" className="space-y-4">
        <h2 className="text-xl font-semibold">Відгуки</h2>
        <ReviewForm venueId={venue.id} myReview={myReview} />
        <ReviewList venueId={venue.id} sort={sort} page={page} />
      </section>
    </div>
  )
}
