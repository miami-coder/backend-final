import Link from 'next/link'
import { RatingStars } from '@/components/ui/rating-stars'
import { Pagination } from '@/components/ui/pagination'
import { serverFetchList } from '@/lib/api/server-client'
import { formatDateTime } from '@/lib/utils/format'
import { parseReview, type RawReview, type Review } from '@/types/review'

// Бекенд валідує sort жорстко (інше значення → 500), тож фронт сам обмежує вибір
const SORTS = [
  { value: 'newest', label: 'Найновіші' },
  { value: 'oldest', label: 'Найстаріші' },
  { value: 'highest', label: 'Найвищі оцінки' },
  { value: 'lowest', label: 'Найнижчі оцінки' },
] as const

export const REVIEW_LIMIT = 10

export async function ReviewList({ venueId, sort, page }: { venueId: string; sort: string; page: number }) {
  const safeSort = SORTS.some((s) => s.value === sort) ? sort : 'newest'
  const raw = await serverFetchList<RawReview>(
    `/venues/${venueId}/reviews?sort=${safeSort}&page=${page}&limit=${REVIEW_LIMIT}`,
    { revalidate: 0 },
  )
  const reviews: Review[] = raw.data.map(parseReview)
  // meta опціональна за типом serverFetchList — дефолт без неї: одна порожня сторінка
  const totalPages = Math.max(1, Math.ceil((raw.meta?.total ?? 0) / (raw.meta?.limit || REVIEW_LIMIT)))

  return (
    <section aria-label="Відгуки" className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SORTS.map((s) => (
          <Link
            key={s.value}
            href={`/venues/${venueId}?sort=${s.value}${page > 1 ? `&page=${page}` : ''}`}
            aria-current={safeSort === s.value ? 'true' : undefined}
            className={`rounded-full px-3 py-1 text-xs ${
              safeSort === s.value ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {reviews.length === 0 && (
        <p className="rounded-xl bg-stone-50 p-6 text-center text-stone-500">
          Відгуків ще немає — будьте першим!
        </p>
      )}

      <ul className="space-y-4">
        {reviews.map((r) => (
          <li key={r.id} className="rounded-xl border border-stone-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {r.author.firstname || r.author.lastname
                  ? [r.author.firstname, r.author.lastname].filter(Boolean).join(' ')
                  : 'Користувач'}
              </span>
              <span className="text-xs text-stone-400">{formatDateTime(r.createdAt)}</span>
            </div>
            <div className="mt-1"><RatingStars value={r.rating} /></div>
            <p className="mt-2 whitespace-pre-line text-stone-700">{r.text}</p>
            <div className="mt-2 flex items-center gap-3">
              {r.isFeatured && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                  Рекомендований критиком
                </span>
              )}
              {r.checkPhotoUrl && (
                /* eslint-disable-next-line @next/next/no-img-element -- зовнішній URL з бекенда */
                <img src={r.checkPhotoUrl} alt="Фото чеку" className="h-16 rounded-lg" />
              )}
            </div>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} hrefFor={(p) => `/venues/${venueId}?sort=${safeSort}&page=${p}`} />
      )}
    </section>
  )
}
