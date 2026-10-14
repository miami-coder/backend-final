import { describe, expect, it } from 'vitest'
import { parseFavoriteVenue, type RawFavoriteVenue } from '@/types/favorite'

const raw: RawFavoriteVenue = {
  id: 'v1', name: 'Бар «Стара Пивна»', address: 'м. Київ', ratingAvg: '4.7', mainPhotoUrl: null,
}

describe('parseFavoriteVenue', () => {
  it('ratingAvg string → number', () => {
    const f = parseFavoriteVenue(raw)
    expect(f.ratingAvg).toBe(4.7)
    expect(f.name).toBe('Бар «Стара Пивна»')
  })
  it('ratingAvg null → null', () => {
    expect(parseFavoriteVenue({ ...raw, ratingAvg: null }).ratingAvg).toBeNull()
  })
})
