import { serverFetch } from '@/lib/api/server-client'

export interface TopCategoryPublic {
  id: string
  title: string
  venues: {
    id: string
    name: string
    mainPhotoUrl: string | null
    ratingAvg: number | null
  }[]
}

/**
 * Публічний Топ: GET /top (revʼю викладача — розділ «Топ»).
 * Увага (ревʼю Stage 4 C1): serverFetch вже повертає розгорнуте data —
 * другий .data тут давав завжди порожній список на живій сторінці.
 */
export async function getTop(revalidate = 60): Promise<TopCategoryPublic[]> {
  return serverFetch<TopCategoryPublic[]>('/top', { revalidate }).catch(
    () => [],
  )
}