// Нормалізований стан фільтрів каталогу — чистий модуль, легко тестувати

export interface CatalogQuery {
  q?: string
  type?: string
  feature: string[]
  tag: string[]
  minCheck?: number
  maxCheck?: number
  minRating?: number
  lat?: number
  lng?: number
  radiusKm?: number
  sort: 'newest' | 'rating' | 'check' | 'name' | 'distance'
  page: number
  limit: number
}

export const DEFAULT_CATALOG_QUERY: CatalogQuery = { feature: [], tag: [], sort: 'newest', page: 1, limit: 10 }

// Допустимі значення сортування
const SORTS = ['rating', 'check', 'newest', 'name', 'distance'] as const

// Число з рядка; масиви та сміття ігноруємо; порожній рядок — як відсутній параметр
// (інакше Number('') === 0 і ?lat=&lng= давало б координати 0;0)
function num(v: string | string[] | undefined): number | undefined {
  if (typeof v !== 'string' || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

// Непорожній рядок; масиви ігноруємо
function str(v: string | string[] | undefined): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined
}

// Бекенд (QueryVenuesDto): minCheck/maxCheck >= 0, minRating 0..5, radiusKm 0.1..100, limit <= 100.
// Невалідні значення відкидаємо (undefined), інакше бекенд відповість 400.
function inRange(v: number | undefined, min: number, max: number): number | undefined {
  return v !== undefined && v >= min && v <= max ? v : undefined
}

export function parseCatalogQuery(sp: Record<string, string | string[] | undefined>): CatalogQuery {
  const lat = num(sp.lat)
  const lng = num(sp.lng)
  const page = num(sp.page)
  const sortRaw = str(sp.sort)
  const sort = (SORTS as readonly string[]).includes(sortRaw ?? '')
    ? (sortRaw as CatalogQuery['sort'])
    : 'newest'
  const hasGeo = lat !== undefined && lng !== undefined
  return {
    q: str(sp.q),
    type: str(sp.type),
    feature: str(sp.feature)?.split(',').filter(Boolean) ?? [],
    tag: str(sp.tag)?.split(',').filter(Boolean) ?? [],
    minCheck: inRange(num(sp.minCheck), 0, Number.MAX_SAFE_INTEGER),
    maxCheck: inRange(num(sp.maxCheck), 0, Number.MAX_SAFE_INTEGER),
    minRating: inRange(num(sp.minRating), 0, 5),
    lat,
    lng,
    radiusKm: inRange(num(sp.radiusKm), 0.1, 100),
    // «distance» без координат не має сенсу — повертаємося до «newest»
    sort: sort === 'distance' && !hasGeo ? 'newest' : sort,
    page: page !== undefined && page >= 1 ? Math.floor(page) : 1,
    limit: DEFAULT_CATALOG_QUERY.limit,
  }
}

// Querystring для fetch бекенда: feature/tag — CSV; порожні поля не серіалізуються; page/limit завжди
export function toSearch(q: CatalogQuery): string {
  const p = new URLSearchParams()
  if (q.q) p.set('q', q.q)
  if (q.type) p.set('type', q.type)
  if (q.feature.length) p.set('feature', q.feature.join(','))
  if (q.tag.length) p.set('tag', q.tag.join(','))
  if (q.minCheck !== undefined) p.set('minCheck', String(q.minCheck))
  if (q.maxCheck !== undefined) p.set('maxCheck', String(q.maxCheck))
  if (q.minRating !== undefined) p.set('minRating', String(q.minRating))
  if (q.lat !== undefined) p.set('lat', String(q.lat))
  if (q.lng !== undefined) p.set('lng', String(q.lng))
  if (q.radiusKm !== undefined) p.set('radiusKm', String(q.radiusKm))
  p.set('sort', q.sort)
  p.set('page', String(q.page))
  p.set('limit', String(q.limit))
  return p.toString()
}

// Готовий href каталогу — спільний для пагінації та фільтрів
export function catalogHref(query: CatalogQuery): string {
  return `/?${toSearch(query)}`
}
