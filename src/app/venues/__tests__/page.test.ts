import { describe, expect, it, vi } from 'vitest'

// redirect() кидає спеціальний NEXT_REDIRECT — мокаємо, щоб тестувати лише наш виклик.
// vi.hoisted: фабрика vi.mock піднімається вище імпортів, звичайна const була б в TDZ.
const redirect = vi.hoisted(() => vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }))
vi.mock('next/navigation', () => ({ redirect }))

import VenuesAliasPage from '@/app/venues/page'

describe('/venues (псевдонім каталогу)', () => {
  it('з параметрами — редірект на /?q=бар', async () => {
    await expect(VenuesAliasPage({ searchParams: Promise.resolve({ q: 'бар' }) }))
      .rejects.toThrow('REDIRECT:/?q=%D0%B1%D0%B0%D1%80')
  })
  it('без параметрів — редірект на /', async () => {
    await expect(VenuesAliasPage({ searchParams: Promise.resolve({}) }))
      .rejects.toThrow('REDIRECT:/')
  })
  it('масивні параметри серіалізуються повторенням ключа', async () => {
    await expect(VenuesAliasPage({ searchParams: Promise.resolve({ tag: ['pyvo', 'sport'] }) }))
      .rejects.toThrow('REDIRECT:/?tag=pyvo&tag=sport')
  })
})
