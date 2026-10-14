import { describe, expect, it } from 'vitest'
import { parseAdminUser, parseComplaint, ROLE_LABELS, type RawAdminUser, type RawComplaint } from '@/types/admin'

const rawUser = (overrides: Partial<RawAdminUser> = {}): RawAdminUser => ({
  id: 'u1',
  email: 'olya@example.com',
  createdAt: '2026-01-01T00:00:00.000Z',
  roles: ['user'],
  profile: null,
  ...overrides,
})

const rawComplaint = (overrides: Partial<RawComplaint> = {}): RawComplaint => ({
  id: 'c1',
  venueId: 'v1',
  reviewId: null,
  reason: 'fraud',
  text: 'Фейковий заклад',
  status: 'open',
  createdAt: '2026-02-01T00:00:00.000Z',
  ...overrides,
})

describe('parseAdminUser', () => {
  it('name = profile.firstname + lastname, roles фільтрує невідомі коди', () => {
    expect(
      parseAdminUser(
        rawUser({
          roles: ['super_admin', 'x'],
          profile: { firstname: 'Оля', lastname: 'Ковальчук', phone: null, age: null, avatarUrl: null },
        }),
      ),
    ).toEqual({
      id: 'u1',
      email: 'olya@example.com',
      name: 'Оля Ковальчук',
      roles: ['super_admin'],
      createdAt: '2026-01-01T00:00:00.000Z',
    })
  })
  it('profile null → name null', () => {
    expect(parseAdminUser(rawUser()).name).toBeNull()
  })
  it('частковий profile (тільки firstname) → name без «хвоста» і без зайвого пробілу', () => {
    const u = parseAdminUser(rawUser({ profile: { firstname: 'Оля', lastname: null, phone: null, age: null, avatarUrl: null } }))
    expect(u.name).toBe('Оля')
  })
  it('порожній profile (усі поля null) → name null', () => {
    const u = parseAdminUser(rawUser({ profile: { firstname: null, lastname: null, phone: null, age: null, avatarUrl: null } }))
    expect(u.name).toBeNull()
  })
  it('невідомі roles повністю → roles []', () => {
    expect(parseAdminUser(rawUser({ roles: ['x', 'y'] })).roles).toEqual([])
  })
})

describe('ROLE_LABELS', () => {
  it('містить усі 4 ролі', () => {
    expect(Object.keys(ROLE_LABELS).sort()).toEqual(['critic', 'super_admin', 'user', 'venue_admin'])
    expect(ROLE_LABELS.user).toBe('Користувач')
    expect(ROLE_LABELS.venue_admin).toBe('Адмін закладів')
    expect(ROLE_LABELS.super_admin).toBe('Супер-адмін')
    expect(ROLE_LABELS.critic).toBe('Критик')
  })
})

describe('parseComplaint', () => {
  it('поля проходять as-is (без text-обрізання)', () => {
    expect(parseComplaint(rawComplaint())).toEqual({
      id: 'c1',
      venueId: 'v1',
      reviewId: null,
      reason: 'fraud',
      text: 'Фейковий заклад',
      createdAt: '2026-02-01T00:00:00.000Z',
    })
  })
  it('невідомий reason → "other"', () => {
    expect(parseComplaint(rawComplaint({ reason: 'spam' as RawComplaint['reason'] })).reason).toBe('other')
  })
  it('venueId null проходить як null', () => {
    expect(parseComplaint(rawComplaint({ venueId: null })).venueId).toBeNull()
  })
})
