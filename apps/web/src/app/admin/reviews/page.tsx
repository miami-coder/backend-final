import Link from 'next/link'
import { getAdminReviewsPage } from '@/services/reviews.server'
import { getSessionTokens } from '@/lib/auth/session'
import { parseAdminReview, type RawReview } from '@/types/review'
import { formatDate } from '@/lib/utils/format'
import { Pagination } from '@/components/ui/pagination'
import { AdminReviewActions } from '@/components/features/admin/admin-review-actions'
import { RatingStars } from '@/components/ui/rating-stars'

export const revalidate = 0

const LIMIT = 20

interface Props {
  searchParams: Promise<{ page?: string; venueId?: string }>
}

// Суперадмін-редагування відгуків (пункт ТЗ 7): список усіх відгуків —
// GET /admin/reviews (review:edit:any); редагування рейтингу/тексту й
// видалення — через AdminReviewActions (PATCH/DELETE /reviews/:id);
// середній рейтинг закладу бекенд перераховує сам.
export default async function AdminReviewsPage({ searchParams }: Props) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp?.page ?? 1) || 1)
  const venueQuery = sp?.venueId ? `&venueId=${sp.venueId}` : ''

  const tokens = await getSessionTokens()
  const list = await getAdminReviewsPage(page, LIMIT, venueQuery, tokens)
  const reviews = list.data.map(parseAdminReview)
  const totalPages = Math.max(1, Math.ceil((list.meta?.total ?? 0) / (list.meta?.limit || LIMIT)))

  return (
    <section aria-label="Відгуки" className="space-y-4">
      <p className="text-sm text-muted">
        Редагування тексту й рейтингу відгуку; середній рейтинг закладу перераховується автоматично.
      </p>
      {reviews.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">Відгуків немає.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {reviews.map((r) => (
            <li key={r.id} className="px-4 py-3 hover:bg-raised">
              <div className="flex flex-wrap items-center gap-2">
                <RatingStars value={r.rating} />
                <Link href={`/venues/${r.venueId}`} className="font-medium text-ink hover:text-amber-500">
                  {r.venueName ?? r.venueId}
                </Link>
                <span className="text-sm text-muted">
                  {r.author.firstname || r.author.lastname
                    ? [r.author.firstname, r.author.lastname].filter(Boolean).join(' ')
                    : 'Користувач'}
                </span>
                <span className="text-sm text-muted">{formatDate(r.createdAt)}</span>
                <div className="ml-auto flex gap-2">
                  <AdminReviewActions item={r} />
                </div>
              </div>
              <p className="mt-1 text-sm text-ink">{r.text}</p>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} totalPages={totalPages} hrefFor={(p) => `/admin/reviews?page=${p}${venueQuery}`} />
    </section>
  )
}