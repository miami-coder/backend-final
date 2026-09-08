import { describe, expect, it } from 'vitest'
import { DEFAULT_CATALOG_QUERY, parseCatalogQuery, toSearch } from '@/lib/venues/query'

describe('parseCatalogQuery', () => {
  it('дефолти без параметрів', () => {
    expect(parseCatalogQuery({})).toEqual(DEFAULT_CATALOG_QUERY)
  })
  it('парсить усі поля', () => {
    const q = parseCatalogQuery({
      q: 'бар', type: 'bar', feature: 'wifi,parking', tag: 'pyvo',
      minCheck: '100', maxCheck: '500', minRating: '4',
      lat: '50.45', lng: '30.52', radiusKm: '5', sort: 'rating', page: '2',
    })
    expect(q).toMatchObject({ q: 'бар', type: 'bar', feature: ['wifi', 'parking'], minCheck: 100, sort: 'rating', page: 2 })
  })
  it('sort=distance без координат → newest', () => {
    expect(parseCatalogQuery({ sort: 'distance' }).sort).toBe('newest')
  })
  it('sort=distance з координатами залишається', () => {
    expect(parseCatalogQuery({ sort: 'distance', lat: '1', lng: '2' }).sort).toBe('distance')
  })
  it('сміттєві числа ігноруються', () => {
    expect(parseCatalogQuery({ minCheck: 'abc', page: '-3' })).toEqual(DEFAULT_CATALOG_QUERY)
  })
  it('порожні lat/lng — як відсутні (не 0;0)', () => {
    const q = parseCatalogQuery({ lat: '', lng: '' })
    expect(q.lat).toBeUndefined()
    expect(q.lng).toBeUndefined()
    expect(toSearch(q)).not.toContain('lat=')
    expect(toSearch(q)).not.toContain('lng=')
  })
  it('sort=distance з порожніми lat/lng → newest', () => {
    expect(parseCatalogQuery({ sort: 'distance', lat: '', lng: '' }).sort).toBe('newest')
  })
})

describe('toSearch', () => {
  it('серіалізує CSV і прибирає порожні', () => {
    const s = toSearch({ ...DEFAULT_CATALOG_QUERY, q: 'бар', feature: ['wifi'], page: 3 })
    expect(s).toContain('q=%D0%B1%D0%B0%D1%80') // закодований 'бар'
    expect(s).toContain('feature=wifi')
    expect(s).toContain('page=3')
    expect(s).toContain('limit=20')
    expect(s).not.toContain('type=')
    expect(s).not.toContain('minCheck=')
  })
})
