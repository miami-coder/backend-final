import { describe, expect, it } from 'vitest'
import { profileUpdateSchema } from '@/lib/validation/profile'

describe('profileUpdateSchema', () => {
  it('порожній обʼєкт валідний', () => {
    expect(profileUpdateSchema.safeParse({}).success).toBe(true)
  })
  it('firstname <2 → помилка', () => {
    expect(profileUpdateSchema.safeParse({ firstname: 'Й' }).success).toBe(false)
  })
  it('age неціле → помилка', () => {
    expect(profileUpdateSchema.safeParse({ age: 25.5 }).success).toBe(false)
  })
})
