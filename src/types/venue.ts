import type { PaginatedMeta } from '@/types/api'

// --- Типи «як з бекенда» (raw) ---
export interface RawVenue {
  id: string
  ownerId: string
  name: string
  description: string | null
  address: string
  latitude: string | null
  longitude: string | null
  contacts: { phone?: string; instagram?: string; facebook?: string; website?: string }
  workingHours: Record<string, string>
  averageCheck: string | null
  mainPhotoUrl: string | null
  status: 'pending' | 'approved' | 'rejected' | 'archived'
  ratingAvg: string | null
  ratingCount: number
  viewCount: number
  createdAt: string
  updatedAt: string
  // Відносини Є лише у елементах GET /venues (list); GET /venues/:id
  // повертає лише owner+profile — тому всі відносини optional
  photos?: { id: string; venueId: string; url: string; sortOrder: number }[]
  featureAssignments?: { venueId: string; featureId: string; feature: { id: string; code: string; name: string; icon: string | null } }[]
  venueTags?: { venueId: string; tagId: string; tag: { id: string; name: string; slug: string } }[]
  venueTypeAssignments?: { venueId: string; typeId: string; type: { id: string; name: string; slug: string } }[]
}

// --- Типи після парсингу (для UI) ---
export interface VenueFeature { id: string; code: string; name: string; icon: string | null }
export interface VenueTag { id: string; name: string; slug: string }
export interface VenueType { id: string; name: string; slug: string }
export interface VenuePhoto { id: string; url: string; sortOrder: number }

export interface Venue {
  id: string
  ownerId: string
  name: string
  description: string | null
  address: string
  latitude: number | null
  longitude: number | null
  contacts: { phone?: string; instagram?: string; facebook?: string; website?: string }
  workingHours: Record<string, string>
  averageCheck: number | null
  mainPhotoUrl: string | null
  status: 'pending' | 'approved' | 'rejected' | 'archived'
  ratingAvg: number | null
  ratingCount: number
  viewCount: number
  createdAt: string
  updatedAt: string
  photos: VenuePhoto[]
  features: VenueFeature[]
  tags: VenueTag[]
  types: VenueType[]
}

function num(v: string | number | null): number | null {
  if (v === null || v === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

export function parseVenue(raw: RawVenue): Venue {
  return {
    id: raw.id,
    ownerId: raw.ownerId,
    name: raw.name,
    description: raw.description,
    address: raw.address,
    latitude: num(raw.latitude),
    longitude: num(raw.longitude),
    contacts: raw.contacts ?? {},
    workingHours: raw.workingHours ?? {},
    averageCheck: num(raw.averageCheck),
    mainPhotoUrl: raw.mainPhotoUrl,
    status: raw.status,
    ratingAvg: num(raw.ratingAvg),
    ratingCount: raw.ratingCount,
    viewCount: raw.viewCount,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    photos: raw.photos ?? [],
    features: (raw.featureAssignments ?? []).map((a) => a.feature),
    tags: (raw.venueTags ?? []).map((a) => a.tag),
    types: (raw.venueTypeAssignments ?? []).map((a) => a.type),
  }
}

export type VenueList = { data: Venue[]; meta?: PaginatedMeta }

// Лейбли статусів — спільні для кабінетних сторінок (список + оболонка закладу)
export const VENUE_STATUS_LABELS: Record<string, string> = {
  pending: 'На модерації',
  approved: 'Схвалений',
  rejected: 'Відхилено',
  archived: 'Заархівовано',
}
