import { serverFetch, serverFetchList } from '@/lib/api/server-client'
import type { RawVenue } from '@/types/venue'

export interface TopCategoryPublic {
  id: string
  title: string
  venues: {
    id: string
    name: string
    mainPhotoUrl: string | null
    /** TypeORM numeric віддається строкою — парсер нормалізує (RatingStars
     *  робив .toFixed на строку → «Щось пішло не так»). */
    ratingAvg: number | null
  }[]
}

interface RawTopVenue {
  id: string
  name: string
  mainPhotoUrl?: string | null
  ratingAvg?: string | number | null
}

/**
 * Публічний Топ: GET /top.
 * Увага: serverFetch вже повертає розгорнуте data —
 * другий .data тут давав завжди порожній список на живій сторінці.
 */
export async function getTop(revalidate = 60): Promise<TopCategoryPublic[]> {
  const raw = await serverFetch<
    { id: string; title: string; venues: RawTopVenue[] }[]
  >('/top', { revalidate }).catch(() => [])
  return raw.map((c) => ({
    id: c.id,
    title: c.title,
    venues: c.venues.map((v) => ({
      id: v.id,
      name: v.name,
      mainPhotoUrl: v.mainPhotoUrl ?? null,
      ratingAvg:
        v.ratingAvg == null || v.ratingAvg === '' ? null : Number(v.ratingAvg),
    })),
  }))
}

/**
 * «Рекомендовані критиком» (секція на /top): публічний каталог з фільтром
 * recommended=1 (схвалені + прапор критика). Раніше «вибір критика» був
 * лишень в кабінеті критика — публічного списку не існувало.
 */
export async function getRecommendedVenues(): Promise<RawVenue[]> {
  const res = await serverFetchList<RawVenue>(
    '/venues?recommended=1&limit=12&page=1',
    { revalidate: 0 },
  ).catch(() => ({ data: [] as RawVenue[] }))
  return res.data
}