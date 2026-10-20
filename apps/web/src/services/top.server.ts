import { serverFetch } from '@/lib/api/server-client'

export interface TopCategoryPublic {
  id: string
  title: string
  venues: {
    id: string
    name: string
    mainPhotoUrl: string | null
    /** TypeORM numeric віддається строкою — парсер нормалізує (ревʼю Stage 4:
     *  RatingStars робив .toFixed на строку → «Щось пішло не так»). */
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
 * Публічний Топ: GET /top (revʼю викладача — розділ «Топ»).
 * Увага (ревʼю Stage 4 C1): serverFetch вже повертає розгорнуте data —
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