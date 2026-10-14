// --- Типи «як з бекенда» (raw): проекція GET /me/favorites ---
export interface RawFavoriteVenue {
  id: string
  name: string
  address: string
  ratingAvg: string | null
  mainPhotoUrl: string | null
}

// --- Типи після парсингу (для UI) ---
export interface FavoriteVenue {
  id: string
  name: string
  address: string
  ratingAvg: number | null
  mainPhotoUrl: string | null
}

export function parseFavoriteVenue(raw: RawFavoriteVenue): FavoriteVenue {
  const rating = raw.ratingAvg === null || raw.ratingAvg === '' ? null : Number(raw.ratingAvg)
  return {
    id: raw.id,
    name: raw.name,
    address: raw.address,
    ratingAvg: rating !== null && Number.isNaN(rating) ? null : rating,
    mainPhotoUrl: raw.mainPhotoUrl,
  }
}
