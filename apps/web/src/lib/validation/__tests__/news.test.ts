import { describe, expect, it } from 'vitest'
import { newsFormSchema, adminNewsFormSchema, NEWS_CATEGORIES } from '@/lib/validation/news'

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

describe('adminNewsFormSchema', () => {
  const validBase = { category: 'promo', title: 'Заголовок', content: 'Текст якого достатньо' }

  it('захисний тест: публічна newsFormSchema недоторкана — без status/isPromoted у виході', () => {
    const parsed = newsFormSchema.safeParse(validBase)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(Object.keys(parsed.data).sort()).toEqual(['category', 'content', 'title'])
    }
  })

  it('дефолти: status=published, isPromoted=false', () => {
    const parsed = adminNewsFormSchema.safeParse(validBase)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.status).toBe('published')
      expect(parsed.data.isPromoted).toBe(false)
    }
  })

  it('status=draft|published приймаються, archived — ні', () => {
    expect(adminNewsFormSchema.safeParse({ ...validBase, status: 'draft', isPromoted: true }).success).toBe(true)
    expect(adminNewsFormSchema.safeParse({ ...validBase, status: 'archived' }).success).toBe(false)
  })
})
