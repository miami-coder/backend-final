// /news — публічний список новин: вкладки категорій, пагінація, протерміновано 60с

import Link from 'next/link'
import { Pagination } from '@/components/ui/pagination'
import { getNewsPage } from '@/services/news.server'
import { NEWS_CATEGORIES } from '@/lib/validation/news'
import { parseNews, type RawNews } from '@/types/news'
import { placeholderFor } from '@/lib/utils/placeholder'

const LIMIT = 12

// Датаблок «редакторської стрічки»: день великим + місяць капсом окремо
// (Intl uk-UA; «вер.» → «ВЕР» — без крапки, капсом)
const dayFmt = new Intl.DateTimeFormat('uk-UA', { day: 'numeric' })
const monthFmt = new Intl.DateTimeFormat('uk-UA', { month: 'short' })
function dateParts(iso: string): { day: string; month: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { day: '—', month: '' }
  return { day: dayFmt.format(d), month: monthFmt.format(d).replace('.', '').toUpperCase() }
}

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
          {news.map((n) => {
            // невідома категорія з бекенда → бейдж узагалі не рендеримо (порожній span недопустимий)
            const categoryLabel = NEWS_CATEGORIES.find((c) => c.value === n.category)?.label
            const { day, month } = dateParts(n.publishedAt ?? n.createdAt)
            return (
              <li key={n.id} className="border-b border-line">
                <Link href={`/news/${n.id}`} className="flex items-center gap-4 py-4">
                  <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-raised">
                    <span className="font-display text-xl font-bold leading-none text-amber-400">{day}</span>
                    <span className="mt-0.5 text-[10px] uppercase tracking-wide text-faint">{month}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display font-semibold text-ink">{n.title}</h2>
                    {n.content && <p className="mt-0.5 line-clamp-1 text-sm text-muted">{n.content}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {n.isPromoted && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs text-amber-400">Промо</span>}
                      {categoryLabel && (
                        <span className="rounded-full bg-raised px-2 py-0.5 text-xs text-muted">{categoryLabel}</span>
                      )}
                    </div>
                  </div>
                  <div className="aspect-[4/3] w-[120px] shrink-0 overflow-hidden rounded-xl">
                    {n.imageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- зовнішній URL з бекенда */
                      <img src={n.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div style={{ background: placeholderFor(n.id) }} className="h-full w-full" />
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} hrefFor={(p) => `/news?${category ? `category=${category}&` : ''}page=${p}`} />}
    </div>
  )
}