export type NewsCategory = 'general' | 'promo' | 'event'

export interface RawNews {
  id: string
  venueId: string | null
  category: NewsCategory
  title: string
  content: string
  imageUrl: string | null
  status: 'draft' | 'published' | 'archived'
  isPromoted: boolean
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface News {
  id: string
  venueId: string | null
  category: NewsCategory
  title: string
  content: string
  imageUrl: string | null
  status: 'draft' | 'published' | 'archived'
  isPromoted: boolean
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export function parseNews(raw: RawNews): News {
  return {
    id: raw.id,
    venueId: raw.venueId ?? null,
    category: raw.category,
    title: raw.title,
    content: raw.content,
    imageUrl: raw.imageUrl ?? null,
    status: raw.status,
    isPromoted: Boolean(raw.isPromoted),
    publishedAt: raw.publishedAt ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}
