export type HangoutGender = 'male' | 'female' | 'any'
export type HangoutPayer = 'me' | 'split' | 'them'

// --- Типи «як з бекенда» (raw) ---
export interface RawHangout {
  id: string
  venueId: string
  userId: string
  date: string // YYYY-MM-DD
  time: string // HH:mm
  purpose: string
  gender: HangoutGender
  groupSize: number
  payer: HangoutPayer
  desiredBudget: string | null // числова колонка прибуває рядком
  status: 'open' | 'closed'
  createdAt: string
}

// --- Типи після парсингу (для UI) ---
export interface Hangout {
  id: string
  venueId: string
  date: string
  time: string
  purpose: string
  gender: HangoutGender
  groupSize: number
  payer: HangoutPayer
  desiredBudget: number | null
  status: 'open' | 'closed'
  createdAt: string
}

export function parseHangout(raw: RawHangout): Hangout {
  const budget = raw.desiredBudget === null || raw.desiredBudget === ''
    ? null
    : Number(raw.desiredBudget)
  return {
    id: raw.id,
    venueId: raw.venueId,
    date: raw.date,
    time: raw.time,
    purpose: raw.purpose,
    gender: raw.gender,
    groupSize: raw.groupSize,
    payer: raw.payer,
    desiredBudget: budget !== null && Number.isNaN(budget) ? null : budget,
    status: raw.status,
    createdAt: raw.createdAt,
  }
}
