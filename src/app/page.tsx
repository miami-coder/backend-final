// Головна сторінка — каталог закладів із пошуком, фільтрами, сортуванням і пагінацією

import { serverFetchList } from '@/lib/api/server-client'
import { parseVenue, type RawVenue } from '@/types/venue'
import { parseCatalogQuery, catalogHref, toSearch, type CatalogQuery } from '@/lib/venues/query'
import { VenueCard } from '@/components/features/venues/venue-card'
import { VenueFilters } from '@/components/features/venues/venue-filters'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CatalogPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const query: CatalogQuery = parseCatalogQuery(sp)

  const raw = await serverFetchList<RawVenue>(`/venues?${toSearch(query)}`, { revalidate: 60 })
  const venues = raw.data.map(parseVenue)

  const totalPages = raw.meta ? Math.max(1, Math.ceil(raw.meta.total / raw.meta.limit)) : 1

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Каталог закладів</h1>
        <p className="text-muted">Знайдіть ідеальне місце: рейтинги, чеки, відгуки та зустрічі</p>
      </div>
      {/* Панель фільтрів ліворуч, результати праворуч (на мобільних панель — стрічка над сіткою) */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <VenueFilters initial={query} />
        <div className="min-w-0 flex-1">
          {venues.length === 0 ? (
            <EmptyState
              title="Нічого не знайдено"
              description="Спробуйте змінити пошуковий запит або скинути фільтри."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {venues.map((v) => <VenueCard key={v.id} venue={v} />)}
            </div>
          )}
          <div className="mt-8">
            <Pagination
              page={query.page}
              totalPages={totalPages}
              hrefFor={(p) => catalogHref({ ...query, page: p })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
