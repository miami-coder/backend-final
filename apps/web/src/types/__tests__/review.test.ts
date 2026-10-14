import { describe, expect, it } from 'vitest'
import { parseReview, type RawReview } from '@/types/review'

const raw: RawReview = {
  id: 'r1',
  venueId: 'v1',
  userId: 'u1',
  rating: 5,
  text: 'Класне місце',
  checkPhotoUrl: 'https://x/img.jpg',
  isFeatured: false,
  createdAt: '2026-09-08T10:00:00.000Z',
  updatedAt: '2026-09-08T10:00:00.000Z',
  user: { id: 'u1', email: 'a@b.c', roles: ['user'], profile: { firstname: 'Олег', lastname: 'П' } },
}

describe('parseReview', () => {
  it('мапить автора з user.profile', () => {
    const r = parseReview(raw)
    expect(r.author).toEqual({ firstname: 'Олег', lastname: 'П' })
    expect(r.rating).toBe(5)
    expect(r.checkPhotoUrl).toBe('https://x/img.jpg')
  })
  it('user/profile відсутні → author з null-ами', () => {
    const r = parseReview({ ...raw, user: undefined })
    expect(r.author).toEqual({ firstname: null, lastname: null })
  })
})
