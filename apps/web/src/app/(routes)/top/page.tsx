// Розділ «Топ» (ревʼю викладача): тематичні збірки «Найкращий заклад для
// весілля» тощо — список редагує супер-адмін в адмінці. Плюс «Рекомендовані
// критиком» — компактні плитки закладів з прапором критика. SSR через BFF.

import { VenueCard } from '@/components/features/venues/venue-card'
import { parseVenue, type Venue } from '@/types/venue'
import { getRecommendedVenues, getTop } from '@/services/top.server'

export const metadata = { title: 'Топ закладів — Пиячок' }

export default async function TopPage() {
  const categories = await getTop()
  // Рекомендації критиків (approved + recommendedBy) — окрема секція, без імен
  const recommendedRaw = await getRecommendedVenues()
  const recommended = recommendedRaw.map((v) => parseVenue(v))

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">Топ закладів</h1>
      <p className="mt-1 text-sm text-muted">
        Вибір редакції: головні місця України за категоріями.
      </p>

      {categories.map((c, idx) => (
        <section key={c.id} className="mt-8" aria-labelledby={`top-${c.id}`}>
          <h2
            id={`top-${c.id}`}
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-500">
              {idx + 1}
            </span>
            {c.title}
          </h2>

          {c.venues.length === 0 ? (
            <p className="mt-3 text-sm text-faint">Тимчасово порожньо</p>
          ) : (
            /* Той самий компакт-формат, що й «Рекомендовані критиком»:
               різниця тільки в бейджі місця (1/2/3) */
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {c.venues.map((v, place) => (
                <li key={v.id}>
                  {/* top/page не має повного Venue з types/tags — плаский
                      обʼєкт /top достатній компакт-варіанту */}
                  <VenueCard venue={v as unknown as Venue} variant="compact" place={place + 1} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {categories.length === 0 && (
        <p className="mt-8 text-sm text-faint">Топ ще не наповнено.</p>
      )}

      {recommended.length > 0 && (
        <section aria-labelledby="critics-choice" className="mt-12">
          <h2
            id="critics-choice"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-500">
              ✦
            </span>
            Рекомендовані критиком
          </h2>
          {/* Компактні плитки (не карта каталогу): фото + назва + зірки,
              вся плитка — посилання на заклад. 4-5 у ряд десктопу, 2 — мобілки. */}
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {recommended.map((v) => (
              <li key={v.id}>
                <VenueCard venue={v} variant="compact" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}