// Карточка закладу в каталозі (серверний компонент)

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { RatingStars } from '@/components/ui/rating-stars'
import type { Venue } from '@/types/venue'

export function VenueCard({ venue }: { venue: Venue }) {
  return (
    <Link
      href={`/venues/${venue.id}`}
      className="group block overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-brand-400 hover:shadow-md"
    >
      <div className="aspect-[4/3] overflow-hidden bg-stone-100">
        {venue.mainPhotoUrl ? (
          // Зовнішні фото закладу: звичайний <img>, бо домени бекенду невідомі заздалегідь
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={venue.mainPhotoUrl}
            alt={venue.name}
            className="h-full w-full object-cover transition group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl">🍺</div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-stone-900">{venue.name}</h3>
          <RatingStars value={venue.ratingAvg} />
        </div>
        <p className="mt-1 truncate text-sm text-stone-500">{venue.address}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {venue.averageCheck !== null && (
            <Badge tone="brand">≈ {venue.averageCheck} грн</Badge>
          )}
          {venue.types.map((t) => <Badge key={t.id}>{t.name}</Badge>)}
        </div>
      </div>
    </Link>
  )
}
