import type { Role } from '@/types/user'

export interface RawAdminUser {
  id: string
  email: string
  createdAt: string
  roles: string[]
  profile: {
    firstname: string | null
    lastname: string | null
    phone: string | null
    age: number | null
    avatarUrl: string | null
  } | null
}

export interface AdminUser {
  id: string
  email: string
  name: string | null
  roles: Role[]
  createdAt: string
}

// Бекенд повертає коди ролей; для UI — українські підписи
export const ROLE_LABELS: Record<Role, string> = {
  user: 'Користувач',
  venue_admin: 'Адмін закладів',
  super_admin: 'Супер-адмін',
  critic: 'Критик',
}

const ROLE_VALUES: Role[] = ['user', 'venue_admin', 'super_admin', 'critic']

// Розвʼязує profile у «Імʼя Прізвище» (без «хвоста» і зайвого пробілу) та
// відкидає невідомі коди ролей, які бекенд міг додати раніше за фронт
export function parseAdminUser(raw: RawAdminUser): AdminUser {
  const name = raw.profile
    ? [raw.profile.firstname, raw.profile.lastname].filter(Boolean).join(' ') || null
    : null
  return {
    id: raw.id,
    email: raw.email,
    name,
    roles: raw.roles.filter((r): r is Role => ROLE_VALUES.includes(r as Role)),
    createdAt: raw.createdAt,
  }
}

export interface RawComplaint {
  id: string
  venueId: string | null
  reviewId: string | null
  reason: 'fake_promo' | 'fraud' | 'other'
  text: string
  status: string
  createdAt: string
}

export interface AdminComplaint {
  id: string
  venueId: string | null
  reviewId: string | null
  reason: 'fake_promo' | 'fraud' | 'other'
  text: string
  createdAt: string
}

// Скарга: поля проходять as-is (обрізання text — у відображенні), невідомий
// reason (бекенд додав новий раніше за фронт) зводиться до 'other'
export function parseComplaint(raw: RawComplaint): AdminComplaint {
  const reason = raw.reason === 'fake_promo' || raw.reason === 'fraud' ? raw.reason : 'other'
  return {
    id: raw.id,
    venueId: raw.venueId,
    reviewId: raw.reviewId,
    reason,
    text: raw.text,
    createdAt: raw.createdAt,
  }
}