// /news — публічний список новин: вкладки категорій, пагінація, протерміновано 60с
// Рядок новини — спільний NewsListItem (та сама стрічка на сторінці закладу)

import Link from 'next/link'
import { Pagination } from '@/components/ui/pagination'
import { NewsListItem } from '@/components/features/news/news-list-item'
import { getNewsPage } from '@/services/news.server'
import { NEWS_CATEGORIES } from '@/lib/validation/news'
import { parseNews, type RawNews } from '@/types/news'

const LIMIT = 12

interface Props {
  searchParams: Promise<{ category?: string; page?: string }>
}

export const revalidate = 60

export default async function NewsPage({ searchParams }: Props) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp?.page ?? 1) || 1)
  const category = NEWS_CATEGORIES.some((c) => c.value === sp?.category) ? sp!.category : undefined

  const raw = await getNewsPage(page, LIMIT, category)
  const news = raw.data.map(parseNews)
  const totalPages = Math.max(1, Math.ceil((raw.meta?.total ?? 0) / (raw.meta?.limit || LIMIT)))

  return (
    <div className="mx-auto max-w-4xl py-8">
      <h1 className="font-display text-2xl font-bold text-ink">Новини</h1>
      <nav className="mt-4 flex gap-3 text-sm" aria-label="Категорії новин">
        <Link href="/news" className={!category ? 'font-semibold text-amber-500' : 'text-muted hover:text-amber-500'}>Усі</Link>
        {NEWS_CATEGORIES.map((c) => (
          <Link key={c.value} href={`/news?category=${c.value}`}
            className={category === c.value ? 'font-semibold text-amber-500' : 'text-muted hover:text-amber-500'}>
            {c.label}
          </Link>
        ))}
      </nav>
      {news.length === 0 ? (
        <div className="mt-6 rounded-xl border border-line bg-surface p-8 text-center">
          <p className="text-muted">Новин ще немає.</p>
        </div>
      ) : (
        <ul className="mt-6">
          {news.map((n) => (
            <NewsListItem key={n.id} item={n} />
          ))}
        </ul>
      )}
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} hrefFor={(p) => `/news?${category ? `category=${category}&` : ''}page=${p}`} />}
    </div>
  )
}