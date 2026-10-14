import { describe, expect, it } from 'vitest'
import { reviewFormSchema } from '@/lib/validation/review'

describe('reviewFormSchema', () => {
  it('валідний відгук', () => {
    expect(reviewFormSchema.safeParse({ rating: 4, text: ' Дуже смачне пиво ' }).success).toBe(true)
  })
  it('rating поза 1..5 — відхиляється', () => {
    expect(reviewFormSchema.safeParse({ rating: 0, text: 'x'.repeat(10) }).success).toBe(false)
    expect(reviewFormSchema.safeParse({ rating: 6, text: 'x'.repeat(10) }).success).toBe(false)
    expect(reviewFormSchema.safeParse({ rating: 4.5, text: 'x'.repeat(10) }).success).toBe(false) // не int
  })
  it('текст < 10 або > 2000 — відхиляється', () => {
    expect(reviewFormSchema.safeParse({ rating: 4, text: 'коротко' }).success).toBe(false)
    expect(reviewFormSchema.safeParse({ rating: 4, text: 'x'.repeat(2001) }).success).toBe(false)
  })
  it('текст trim-иться', () => {
    expect(reviewFormSchema.parse({ rating: 4, text: '  нормальний текст  ' }).text).toBe('нормальний текст')
  })
})
