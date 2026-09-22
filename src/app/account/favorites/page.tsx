import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FavoriteRemoveButton } from '@/components/features/venues/favorite-remove-button'
import { RatingStars } from '@/components/ui/rating-stars'
import { Pagination } from '@/components/ui/pagination'
import { serverFetchList } from '@/lib/api/server-client'
import { getSessionTokens } from '@/lib/auth/session'
import { parseFavoriteVenue, type RawFavoriteVenue } from '@/types/favorite'
import { placeholderFor } from '@/lib/utils/placeholder'

const LIMIT = 20

interface Props {
  searchParams: Promise<{ page?: string }>
}

export default async function FavoritesPage({ searchParams }: Props) {
  const tokens = await getSessionTokens()
  if (!tokens) redirect('/auth/login?next=/account/favorites')

  const sp = await searchParams
  const page = Math.max(1, Number(sp?.page ?? 1) || 1)

  const raw = await serverFetchList<RawFavoriteVenue>(`/me/favorites?page=${page}&limit=${LIMIT}`, {
    tokens,
    revalidate: 0,
  })
  const favorites = raw.data.map(parseFavoriteVenue)
  const totalPages = Math.max(1, Math.ceil((raw.meta?.total ?? 0) / (raw.meta?.limit || LIMIT)))

  return (
    <div className="space-y-4">
      {favorites.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-8 text-center">
          <p className="text-muted">У обраному поки порожньо.</p>
          <Link className="mt-4 inline-block text-amber-500 hover:underline" href="/">
            Перейти до каталогу
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {favorites.map((f) => (
            <li key={f.id} className="flex items-center gap-4 rounded-xl border border-line p-4">
              {f.mainPhotoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element -- зовнішній URL з бекенда */
                <img src={f.mainPhotoUrl} alt="" loading="lazy" className="h-16 w-16 rounded-lg object-cover" />
              ) : (
                <div className="h-16 w-16 overflow-hidden rounded-lg bg-raised">
                  <div style={{ background: placeholderFor(f.id) }} className="h-full w-full" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <Link className="font-medium hover:underline" href={`/venues/${f.id}`}>
                  {f.name}
                </Link>
                <p className="truncate text-sm text-muted">{f.address}</p>
                {f.ratingAvg !== null && <RatingStars value={f.ratingAvg} />}
              </div>
              <FavoriteRemoveButton venueId={f.id} />
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} hrefFor={(p) => `/account/favorites?page=${p}`} />
      )}
    </div>
  )
}
