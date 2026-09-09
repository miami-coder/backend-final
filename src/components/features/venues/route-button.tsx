import { routeUrl } from '@/lib/venues/route-url'
import type { Venue } from '@/types/venue'

// Кнопка «Прокласти маршрут»: зовнішній URL Google Maps (target=_blank)
export function RouteButton({ venue }: { venue: Pick<Venue, 'latitude' | 'longitude' | 'address' | 'name'> }) {
  return (
    <a
      href={routeUrl(venue)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
    >
      Прокласти маршрут
    </a>
  )
}
