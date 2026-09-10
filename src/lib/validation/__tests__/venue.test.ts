import { describe, expect, it } from 'vitest'
import { venueCreateSchema, venueUpdateSchema, csvToArray, WH_DAYS } from '@/lib/validation/venue'

const base = {
  name: 'Бар «Пиво»',
  address: 'вул. Хрещатик, 1',
  averageCheck: 250,
  featureCodes: ['wifi'],
  tagSlugs: ['pyvo'],
}

describe('venueCreateSchema', () => {
  it('валідний мінімум', () => {
    expect(venueCreateSchema.safeParse({ name: 'Бар', address: 'вул. Липова, 1' }).success).toBe(true)
  })
  it('name <3 → помилка', () => {
    expect(venueCreateSchema.safeParse({ ...base, name: 'Ба' }).success).toBe(false)
  })
  it('address <5 → помилка', () => {
    expect(venueCreateSchema.safeParse({ ...base, address: 'вул.' }).success).toBe(false)
  })
  it('averageCheck відʼємний → помилка', () => {
    expect(venueCreateSchema.safeParse({ ...base, averageCheck: -1 }).success).toBe(false)
  })
  it('featureCodes >20 → помилка', () => {
    expect(venueCreateSchema.safeParse({ ...base, featureCodes: Array.from({ length: 21 }, (_, i) => `f${i}`) }).success).toBe(false)
  })
  it('workingHours невалідний діапазон → помилка', () => {
    expect(venueCreateSchema.safeParse({ ...base, workingHours: { monday: '10-20' } }).success).toBe(false)
    expect(venueCreateSchema.safeParse({ ...base, workingHours: { monday: '10:00-22:00' } }).success).toBe(true)
  })
  it('lat/lng поза межами → помилка', () => {
    expect(venueCreateSchema.safeParse({ ...base, latitude: 91 }).success).toBe(false)
    expect(venueCreateSchema.safeParse({ ...base, longitude: -181 }).success).toBe(false)
  })
})

describe('venueUpdateSchema', () => {
  it('усі поля опційні', () => {
    expect(venueUpdateSchema.safeParse({}).success).toBe(true)
  })
  it('name <3 при наявності → помилка', () => {
    expect(venueUpdateSchema.safeParse({ name: 'Ба' }).success).toBe(false)
  })
})

describe('csvToArray / WH_DAYS', () => {
  it('csvToArray тримає пробіли й порожні', () => {
    expect(csvToArray(' wifi , live ,')).toEqual(['wifi', 'live'])
    expect(csvToArray('')).toEqual([])
  })
  it('7 днів', () => {
    expect(WH_DAYS).toHaveLength(7)
  })
})
