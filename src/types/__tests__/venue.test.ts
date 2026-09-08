import { describe, expect, it } from 'vitest'
import { parseVenue, type RawVenue } from '@/types/venue'

const raw: RawVenue = {
  id: 'v1', ownerId: 'u1', name: 'Бар «Сесія»', description: null,
  address: 'вул. Хрещатик 1', latitude: '50.4501', longitude: '30.5234',
  contacts: { phone: '+380501234567' }, workingHours: { mon: '10:00-23:00' },
  averageCheck: '450.50', mainPhotoUrl: null, status: 'approved',
  ratingAvg: '4.70', ratingCount: 3, viewCount: 100,
  createdAt: '2026-08-01T10:00:00.000Z', updatedAt: '2026-08-02T10:00:00.000Z',
  photos: [{ id: 'p1', venueId: 'v1', url: '/static/venues/v1/a.jpg', sortOrder: 0 }],
  featureAssignments: [{ venueId: 'v1', featureId: 'f1', feature: { id: 'f1', code: 'wifi', name: 'Wi-Fi', icon: '📶' } }],
  venueTags: [{ venueId: 'v1', tagId: 't1', tag: { id: 't1', name: 'Пиво', slug: 'pyvo' } }],
  venueTypeAssignments: [{ venueId: 'v1', typeId: 'ty1', type: { id: 'ty1', name: 'Бар', slug: 'bar' } }],
}

describe('parseVenue', () => {
  it('конвертує рядкові numeric у number', () => {
    const v = parseVenue(raw)
    expect(v.latitude).toBe(50.4501)
    expect(v.averageCheck).toBe(450.5)
    expect(v.ratingAvg).toBe(4.7)
  })
  it('розгортає relations у плоскі масиви', () => {
    const v = parseVenue(raw)
    expect(v.features).toEqual([{ id: 'f1', code: 'wifi', name: 'Wi-Fi', icon: '📶' }])
    expect(v.tags[0].slug).toBe('pyvo')
    expect(v.types[0].slug).toBe('bar')
    expect(v.photos[0].url).toBe('/static/venues/v1/a.jpg')
  })
  it('витримує null-поля', () => {
    const v = parseVenue({ ...raw, latitude: null, longitude: null, averageCheck: null, ratingAvg: null })
    expect(v.latitude).toBeNull()
    expect(v.ratingAvg).toBeNull()
  })
})
