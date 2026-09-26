import Link from 'next/link'
import { serverFetchList } from '@/lib/api/server-client'
import { getSessionTokens } from '@/lib/auth/session'
import { parseNews, NEWS_STATUS_LABELS, type RawNews, type NewsStatus } from '@/types/news'
import { NEWS_CATEGORIES } from '@/lib/validation/news'
import { formatDate } from '@/lib/utils/format'
import { Pagination } from '@/components/ui/pagination'
import { Badge } from '@/components/ui/badge'
import { AdminNewsCreateForm } from '@/components/features/admin/admin-news-create-form'
import { AdminNewsActions } from '@/components/features/admin/admin-news-actions'

export const revalidate = 0

const LIMIT = 20
const STATUSES = ['draft', 'published', 'archived'] as const

// Тоновані бейджі статусів новин (Task 3): published → success, draft → warning,
// archived → нейтральний (приглушений)
const STATUS_TONE: Record<NewsStatus, 'warning' | 'success' | 'neutral'> = {
  draft: 'warning',
  published: 'success',
  archived: 'neutral',
}

// Таби-лінки: без параметра = Усі (бекенд без status повертає всі статуси);
// невідоме значення зводимо до undefined — те саме, що «Усі».
const STATUS_TABS = [
  { label: 'Усі', value: undefined },
  { label: 'Опубліковані', value: 'published' },
  { label: 'Чернетки', value: 'draft' },
  { label: 'Заархівовані', value: 'archived' },
] as const satisfies ReadonlyArray<{ label: string; value?: NewsStatus }>

interface Props {
  searchParams: Promise<{ page?: string; status?: string }>
}

// Новини: усі статуси з бейджами; лінк на публічну сторінку — лише для
// published (draft/archived публічна сторінка рендерить як notFound).
export default async function AdminNewsPage({ searchParams }: Props) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp?.page ?? 1) || 1)
  const status: NewsStatus | undefined = STATUSES.includes(sp?.status as NewsStatus)
    ? (sp?.status as NewsStatus)
    : undefined
  const statusQuery = status ? `&status=${status}` : ''

  const tokens = await getSessionTokens()
  const list = await serverFetchList<RawNews>(`/admin/news?page=${page}${statusQuery}`, {
    tokens,
    revalidate: 0,
  })
  const news = list.data.map(parseNews)
  // meta без totalPages — рахуємо з total/limit (бекендова limit, інакше LIMIT)
  const totalPages = Math.max(1, Math.ceil((list.meta?.total ?? 0) / (list.meta?.limit || LIMIT)))

  return (
    <section aria-label="Новини" className="space-y-4">
      <AdminNewsCreateForm />
      <nav className="flex gap-3 text-sm" aria-label="Статуси новин">
        {STATUS_TABS.map((t) => (
          <Link
            key={t.label}
            href={t.value ? `/admin/news?status=${t.value}` : '/admin/news'}
            className={status === t.value ? 'font-semibold text-amber-500' : 'text-muted hover:text-amber-500'}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {news.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">Новин немає.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {news.map((n) => {
            // невідома категорія з бекенда → бейдж узагалі не рендеримо (порожній span недопустимий)
            const categoryLabel = NEWS_CATEGORIES.find((c) => c.value === n.category)?.label
            return (
              <li key={n.id} className="px-4 py-3 hover:bg-raised">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS_TONE[n.status]}>{NEWS_STATUS_LABELS[n.status]}</Badge>
                  {categoryLabel && (
                    <span className="rounded-full bg-raised px-2 py-0.5 text-xs text-muted">
                      {categoryLabel}
                    </span>
                  )}
                  {n.isPromoted && (
                    <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs text-amber-400">Промо</span>
                  )}
                  {n.status === 'published' ? (
                    <Link href={`/news/${n.id}`} className="font-medium text-ink hover:text-amber-500">
                      {n.title}
                    </Link>
                  ) : (
                    <span className="font-medium text-ink">{n.title}</span>
                  )}
                  <span className="text-sm text-muted">{formatDate(n.publishedAt ?? n.createdAt)}</span>
                  <div className="ml-auto flex gap-2">
                    <AdminNewsActions item={n} />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {/* Pagination сам повертає null при totalPages <= 1 */}
      <Pagination page={page} totalPages={totalPages} hrefFor={(p) => `/admin/news?page=${p}${statusQuery}`} />
    </section>
  )
}
