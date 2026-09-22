import { routeUrl } from '@/lib/venues/route-url'
import type { Venue } from '@/types/venue'

// Кнопка «Прокласти маршрут»: зовнішній URL Google Maps (target=_blank)
export function RouteButton({ venue }: { venue: Pick<Venue, 'latitude' | 'longitude' | 'address' | 'name'> }) {
  return (
    <a
      href={routeUrl(venue)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-espresso hover:bg-amber-400"
    >
      Прокласти маршрут
    </a>
  )
}
