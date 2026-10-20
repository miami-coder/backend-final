// Розділ «Топ» (ревʼю викладача): тематичні збірки «Найкращий заклад для
// весілля» тощо — список редагує супер-адмін в адмінці. SSR через BFF.

import Link from 'next/link'
import { RatingStars } from '@/components/ui/rating-stars'
import { placeholderFor } from '@/lib/utils/placeholder'
import { getTop } from '@/services/top.server'

export const metadata = { title: 'Топ закладів — Пиячок' }

export default async function TopPage() {
  const categories = await getTop()

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">Топ закладів</h1>
      <p className="mt-1 text-sm text-muted">
        Вибір редакції: головні місця Хмельницького за категоріями.
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
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {c.venues.map((v, place) => (
                <li key={v.id}>
                  <Link
                    href={`/venues/${v.id}`}
                    className="block overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-amber-500/70"
                  >
                    <div className="flex items-center gap-3"
                    >
                      <span className="ml-3 w-6 shrink-0 text-center text-lg font-bold text-amber-500">
                        {place + 1}
                      </span>
                      <div className="h-16 w-24 shrink-0 overflow-hidden rounded-r-xl bg-raised">
                        {v.mainPhotoUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element -- зовнішній URL з бекенда */
                          <img
                            src={v.mainPhotoUrl}
                            alt={v.name}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div
                            style={{ background: placeholderFor(v.id) }}
                            className="h-full w-full"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pr-3">
                        <h3 className="truncate text-sm font-semibold text-ink">
                          {v.name}
                        </h3>
                        <RatingStars value={v.ratingAvg} />
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {categories.length === 0 && (
        <p className="mt-8 text-sm text-faint">Топ ще не наповнено.</p>
      )}
    </main>
  )
}