import { describe, expect, it } from 'vitest'
import { newsFormSchema, NEWS_CATEGORIES } from '@/lib/validation/news'

describe('newsFormSchema', () => {
  it('title <5 → помилка', () => {
    expect(newsFormSchema.safeParse({ category: 'promo', title: 'Хело', content: 'Текст якого досить довгий тут точно' }).success).toBe(false)
  })
  it('title >200 → помилка', () => {
    expect(newsFormSchema.safeParse({ category: 'promo', title: 'x'.repeat(201), content: 'Текст якого достатньо' }).success).toBe(false)
  })
  it('content <20 → помилка', () => {
    expect(newsFormSchema.safeParse({ category: 'promo', title: 'Заголовок', content: 'Короткий' }).success).toBe(false)
  })
  it('валідний мінімум', () => {
    expect(newsFormSchema.safeParse({ category: 'event', title: 'Заголовок', content: 'Текст якого достатньо' }).success).toBe(true)
  })
  it('3 категорії', () => {
    expect(NEWS_CATEGORIES.map((c) => c.value)).toEqual(['general', 'promo', 'event'])
  })
})
