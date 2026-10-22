// Карточка закладу в каталозі (серверний компонент)

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { RatingStars } from '@/components/ui/rating-stars'
import { placeholderFor } from '@/lib/utils/placeholder'
import type { Venue } from '@/types/venue'

export function VenueCard({
  venue,
  variant = 'default',
  place,
}: {
  venue: Venue
  // compact — маленька плитка (Топ/«Рекомендовані критиком» на /top):
  // тільки фото + назва + зірки, без адреси/чеку/типів/тегів
  variant?: 'default' | 'compact'
  // номер місця (Топ) — бейдж у кутку фото; для критика не передається
  place?: number
}) {
  if (variant === 'compact') {
    return (
      <Link
        href={`/venues/${venue.id}`}
        className="block overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-amber-500/70"
      >
        <div className="relative h-24 overflow-hidden bg-raised">
          {venue.mainPhotoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element -- зовнішній URL з бекенда */
            <img
              src={venue.mainPhotoUrl}
              alt={venue.name}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div style={{ background: placeholderFor(venue.id) }} className="h-full w-full" />
          )}
          {place !== undefined ? (
            <span className="absolute top-1.5 left-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-xs font-bold text-espresso">
              {place}
            </span>
          ) : venue.recommendedBy ? (
            <span
              title="Рекомендовано критиком Пиячок"
              className="absolute top-1.5 left-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-500"
            >
              ✦
            </span>
          ) : null}
        </div>
        <div className="p-2.5">
          <h3 className="truncate text-sm font-semibold text-ink">{venue.name}</h3>
          <RatingStars value={venue.ratingAvg} />
        </div>
      </Link>
    )
  }
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
        {venue.recommendedBy && (
          <span
            title="Рекомендовано критиком Пиячок"
            className="mt-2 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-500"
          >
            ✦ Рекомендовано
          </span>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {venue.averageCheck !== null && (
            <Badge tone="brand">≈ {venue.averageCheck} грн</Badge>
          )}
          {venue.types.map((t) => <Badge key={t.id}>{t.name}</Badge>)}
        </div>
        {/* Теги — неклікабельні бейджі: вся картка один <Link>, вкладені
            посилання всередині невалідні. Клік-фільтр за тегом — на сторінці
            закладу і в чипах панелі фільтрів. */}
        {venue.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {venue.tags.map((t) => (
              <span key={t.id} className="rounded-full bg-raised px-2 py-0.5 text-xs text-muted">
                #{t.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
