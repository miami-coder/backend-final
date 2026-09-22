// /news/[id] — публічна сторінка деталей новини; не знайдено/заархівовано → notFound()

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { serverFetch } from '@/lib/api/server-client'
import { parseNews, type RawNews } from '@/types/news'
import { parseVenue, type RawVenue } from '@/types/venue'
import { NEWS_CATEGORIES } from '@/lib/validation/news'
import { formatDate } from '@/lib/utils/format'

interface Props {
  params: Promise<{ id: string }>
}

export const revalidate = 60

async function getNews(id: string) {
  const raw = await serverFetch<RawNews>(`/news/${id}`, { revalidate: 60 }).catch(() => null)
  // Бекенд (news.service.get, @Public() GET /news/:id) віддає і draft/archived
  // зі статусом 200 — публічна деталка мусить показувати лише published
  return raw && raw.status === 'published' ? parseNews(raw) : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const news = await getNews(id)
  return { title: news ? `${news.title} — Пиячок` : 'Новина — Пиячок' }
}

export default async function NewsPage({ params }: Props) {
  const { id } = await params
  const news = await getNews(id)
  if (!news) notFound()

  // ⚠️ бриф: GET /venues/:id віддає лише approved-заклади (не-approved → 404),
  // тому падіння запиту (включно з 404) тихо ігноруємо — рядок не показуємо
  const venue = news.venueId
    ? await serverFetch<RawVenue>(`/venues/${news.venueId}`, { revalidate: 60 }).then(parseVenue).catch(() => null)
    : null

  const categoryLabel = NEWS_CATEGORIES.find((c) => c.value === news.category)?.label

  return (
    <article className="mx-auto max-w-2xl py-8">
      {news.imageUrl && (
        /* eslint-disable-next-line @next/next/no-img-element -- зовнішній URL з бекенда */
        <img src={news.imageUrl} alt="" className="mb-4 h-64 w-full rounded-xl object-cover" />
      )}
      <div className="mb-2 flex items-center gap-2">
        {categoryLabel && (
          <span className="rounded-full bg-raised px-2 py-0.5 text-xs text-muted">{categoryLabel}</span>
        )}
        {news.publishedAt && <span className="text-sm text-muted">{formatDate(news.publishedAt)}</span>}
      </div>
      <h1 className="font-display text-2xl font-bold text-ink">{news.title}</h1>
      <div className="mt-4 whitespace-pre-line text-muted">{news.content}</div>
      {venue && (
        <p className="mt-6 text-sm text-muted">
          Заклад: <Link className="text-amber-500 hover:underline" href={`/venues/${venue.id}`}>{venue.name}</Link>
        </p>
      )}
    </article>
  )
}
