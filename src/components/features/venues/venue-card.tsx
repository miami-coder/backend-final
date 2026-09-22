// Карточка закладу в каталозі (серверний компонент)

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { RatingStars } from '@/components/ui/rating-stars'
import { placeholderFor } from '@/lib/utils/placeholder'
import type { Venue } from '@/types/venue'

export function VenueCard({ venue }: { venue: Venue }) {
  return (
    <Link
      href={`/venues/${venue.id}`}
      className="block overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-amber-500/70"
    >
      <div className="aspect-[4/3] overflow-hidden bg-raised">
        {venue.mainPhotoUrl ? (
          // Зовнішні фото закладу: звичайний <img>, бо домени бекенду невідомі заздалегідь
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={venue.mainPhotoUrl}
            alt={venue.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div style={{ background: placeholderFor(venue.id) }} className="h-full w-full" />
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-ink">{venue.name}</h3>
          <RatingStars value={venue.ratingAvg} />
        </div>
        <p className="mt-1 truncate text-sm text-muted">{venue.address}</p>
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
