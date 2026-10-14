// --- Типи «як з бекенда» (raw) ---
// Увага: `passwordHash` підтікає у user у GET /venues/:id/reviews —
// у raw-типі його СВІСНО немає, парсер проєктує лише потрібні поля.
export interface RawReview {
  id: string
  venueId: string
  userId: string
  rating: number
  text: string
  checkPhotoUrl: string | null
  isFeatured: boolean
  createdAt: string
  updatedAt: string
  user?: {
    id: string
    email: string
    roles: string[]
    profile?: { firstname: string | null; lastname: string | null } | null
  } | null
  // /admin/reviews приєднує заклад (leftJoinAndSelect) — для адмін-списку
  venue?: { id: string; name: string } | null
}

// --- Типи після парсингу (для UI) ---
export interface Review {
  id: string
  venueId: string
  rating: number
  text: string
  checkPhotoUrl: string | null
  isFeatured: boolean
  createdAt: string
  updatedAt: string
  author: { firstname: string | null; lastname: string | null }
}

export function parseReview(raw: RawReview): Review {
  return {
    id: raw.id,
    venueId: raw.venueId,
    rating: raw.rating,
    text: raw.text,
    checkPhotoUrl: raw.checkPhotoUrl,
    isFeatured: Boolean(raw.isFeatured),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    author: {
      firstname: raw.user?.profile?.firstname ?? null,
      lastname: raw.user?.profile?.lastname ?? null,
    },
  }
}

// Варіант для адмінки: разом з іменем закладу
export interface AdminReview extends Review {
  venueName: string | null
}

export function parseAdminReview(raw: RawReview): AdminReview {
  return { ...parseReview(raw), venueName: raw.venue?.name ?? null }
}
