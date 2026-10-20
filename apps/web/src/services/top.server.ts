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

/** Публічний Топ: GET /top (revʼю викладача — розділ «Топ»). */
export async function getTop(revalidate = 60): Promise<TopCategoryPublic[]> {
  const res = await serverFetch<{ data: TopCategoryPublic[] }>('/top', {
    revalidate,
  }).catch(() => null)
  return res?.data ?? []
}