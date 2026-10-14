export type HangoutGender = 'male' | 'female' | 'any'
export type HangoutPayer = 'me' | 'split' | 'them'

export type HangoutStatus = 'open' | 'filled' | 'cancelled' | 'completed'

export const HANGOUT_STATUS_LABELS: Record<HangoutStatus, string> = {
  open: 'Відкрита',
  filled: 'Заповнена',
  cancelled: 'Скасована',
  completed: 'Завершена',
}

// --- Типи «як з бекенда» (raw) ---
export interface RawHangout {
  id: string
  venueId: string
  creatorId: string
  date: string // YYYY-MM-DD
  time: string // HH:mm
  purpose: string
  gender: HangoutGender
  groupSize: number
  payer: HangoutPayer
  desiredBudget: string | null // числова колонка прибуває рядком
  status: HangoutStatus
  venue?: { id: string; name: string; address: string; mainPhotoUrl: string | null }
  participants?: { hangoutId: string; userId: string; joinedAt: string; firstname: string; lastname: string }[]
  createdAt: string
}

// --- Типи після парсингу (для UI) ---
export interface Hangout {
  id: string
  venueId: string
  creatorId: string
  date: string
  time: string
  purpose: string
  gender: HangoutGender
  groupSize: number
  payer: HangoutPayer
  desiredBudget: number | null
  status: HangoutStatus
  venue?: { id: string; name: string; address: string; mainPhotoUrl: string | null }
  participants?: { hangoutId: string; userId: string; joinedAt: string; firstname: string; lastname: string }[]
  createdAt: string
}

export function parseHangout(raw: RawHangout): Hangout {
  const budget = raw.desiredBudget === null || raw.desiredBudget === ''
    ? null
    : Number(raw.desiredBudget)
  return {
    id: raw.id,
    venueId: raw.venueId,
    creatorId: raw.creatorId,
    date: raw.date,
    time: raw.time,
    purpose: raw.purpose,
    gender: raw.gender,
    groupSize: raw.groupSize,
    payer: raw.payer,
    desiredBudget: budget !== null && Number.isNaN(budget) ? null : budget,
    status: raw.status,
    venue: raw.venue,
    participants: raw.participants,
    createdAt: raw.createdAt,
  }
}
