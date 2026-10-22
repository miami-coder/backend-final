import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Острови каталогу в цих місцях не потрібні — тестуємо тільки /top
vi.mock('@/services/top.server', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/services/top.server')>()
  return { ...actual, getTop: vi.fn(), getRecommendedVenues: vi.fn() }
})

import TopPage from '@/app/(routes)/top/page'
import { getTop, getRecommendedVenues } from '@/services/top.server'
import type { RawVenue } from '@/types/venue'

// Сира відповідь BFF (як у каталогу): ratingAvg строкою — parseVenue нормалізує
const venue = (over: Partial<RawVenue> = {}): RawVenue =>
  ({
    id: 'rv1',
    ownerId: 'o1',
    name: 'Бар «Тарантино»',
    description: null,
    address: 'вул. Скарбова, 3',
    latitude: null,
    longitude: null,
    contacts: {},
    workingHours: {},
    averageCheck: null,
    mainPhotoUrl: null,
    status: 'approved',
    ratingAvg: '4.20',
    ratingCount: 3,
    viewCount: 5,
    recommendedBy: 'critic1',
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  }) as RawVenue

const topCategory = {
  id: 'c1',
  title: 'Заклад для тусовки',
  venues: [
    { id: 'v1', name: 'Караоке «Кеш&Cash»', mainPhotoUrl: null, ratingAvg: 4 },
  ],
}

beforeEach(() => {
  vi.mocked(getTop).mockResolvedValue([topCategory])
  vi.mocked(getRecommendedVenues).mockResolvedValue([venue()])
})

// top.page — async-серверний компонент: спершу await, потім статичний рендер
async function html(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToStaticMarkup(await TopPage() as any)
}

describe('TopPage', () => {
  it('підзаголовок — «головні місця України», не місто', async () => {
    const out = await html()
    expect(out).toContain('головні місця України')
    expect(out).not.toContain('Хмельницьк')
  })

  it('є секція «Рекомендовані критиком» з плитками закладів', async () => {
    const out = await html()
    expect(out).toContain('Рекомендовані критиком')
    // плитка — посилання на сторінку закладу
    expect(out).toContain('href="/venues/rv1"')
    expect(out).toContain('Бар «Тарантино»')
    expect(getRecommendedVenues).toHaveBeenCalled()
  })

  it('плитка компактна: фото + назва + зірки, без адреси й тегів (не карта каталогу)', async () => {
    const out = await html()
    const cardChunk = out.slice(
      Math.max(0, out.indexOf('/venues/rv1') - 400),
      out.indexOf('/venues/rv1') + 1200,
    )
    expect(cardChunk).toContain('Бар «Тарантино»')
    // у компакт-варіанті немає адреси каталогової картки
    expect(cardChunk).not.toContain('вул. Скарбова, 3')
    // photo — маленька плитка (h-24), не aspect-[4/3] каталогу
    expect(cardChunk).toMatch(/h-24/)
  })

  it('плитки Топ-категорії — той самий compact-формат, номер місця — бейдж на плитці', async () => {
    const out = await html()
    // караоке з категорії Топу — плитка (фото h-24, лінк), не рядок таблиці
    expect(out).toContain('href="/venues/v1"')
    // бейдж місця 1 — в кутку плитки караоке
    const chunk = out.slice(
      Math.max(0, out.indexOf('/venues/v1') - 900),
      out.indexOf('/venues/v1') + 1200,
    )
    expect(chunk).toMatch(/h-24/)
    expect(chunk).toContain('>1</span>')
    // рядкового формату (h-16 w-24 зліва) більше немає
    expect(chunk).not.toContain('h-16 w-24')
  })

  it('секція критика відсутня, коли рекомендацій немає', async () => {
    vi.mocked(getRecommendedVenues).mockResolvedValue([])
    const out = await html()
    expect(out).not.toContain('Рекомендовані критиком')
    // Топ-категорії виводяться як і було
    expect(out).toContain('Заклад для тусовки')
  })
})