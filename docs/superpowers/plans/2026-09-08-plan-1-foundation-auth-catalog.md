# План 1 — Фундамент, автентифікація, каталог (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Побудувати фундамент фронтенду «Пиячок»: дизайн-система, BFF-автентифікація з httpOnly-cookie, AgeGate, сторінки входу/реєстрації/OAuth та каталог закладів із пошуком, фільтрами, сортуванням і пагінацією.

**Architecture:** Next.js 16 App Router у режимі BFF: токени NestJS живуть в httpOnly-cookie `piyachok_session`; catch-all route handler `/api/v1/[...path]` проксіює браузерні запити в NestJS з авто-refresh при 401; публічні сторінки — Server Components із server-to-server fetch та revalidate 60 с. Специфіка — у спеки, розділи 2–7.

**Tech Stack:** Next.js 16.3.4, React 19, TypeScript, Tailwind v4, zod, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-08-pyiachok-frontend-design.md` — виконавець ОБОВ'ЯЗКОВО читає спеку перед стартом; план спирається на неї.

## Global Constraints

- Мова UI та всіх коментарів у коді, де доречно: українська; тексти користувача українською.
- Бекенд: `BACKEND_URL` (server-only env, default `http://localhost:3000`), префікс `/api/v1`, dev-порт фронтенду `3001` (`pnpm dev -- -p 3001` або `package.json` script).
- Cookie сесії: ім'я `piyachok_session`, значення `JSON.stringify({accessToken, refreshToken})`, опції: `httpOnly: true; sameSite: 'lax'; path: '/'; maxAge: 30*24*3600; secure: process.env.NODE_ENV === 'production'`.
- Формат успіху бекенда: `{ data, meta? }`; помилки: `{ error: { code, message, details } }`. POST повертає 201. Без обгортки `data`: `auth/register|login|refresh`, analytics, health.
- Numeric-поля бекенда (`ratingAvg`, `averageCheck`, `latitude`, `longitude`, `desiredBudget`) приходять **рядками** — парсимо `Number()` в `types/parse.ts`.
- Next.js 16: `cookies()` асинхронна; `set/delete` тільки в route handlers; `params`/`searchParams` — `Promise` (await); route.ts не може лежати поруч із page.tsx; fetch не кешується дефолтно (кеш — `next: { revalidate: 60 }`); `cacheComponents` НЕ вмикаємо.
- Заборонені залежності: UI-бібліотеки (усі компоненти — кастомні на Tailwind). Дозволені нові: `zod` (runtime), `vitest`, `jsdom`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/jest-dom`, `vite-tsconfig-paths` (dev).
- Шляхи через аліас `@/*` → `src/*` (вже налаштовано у tsconfig).
- Кожен таск завершується зеленим `pnpm typecheck && pnpm lint && pnpm test` та комітом.

**Застереження (з спеки, розділ 3, підсекція «Відомі обмеження»):** `/static/*` бекенд сам не роздає — додаємо rewrite в `next.config.ts`; `passwordHash` у відповідях ігноруємо (у типах його немає).

---

### Task 1: Тестовий фундамент (Vitest + scripts)

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/test/server-only-stub.ts`
- Create: `src/lib/utils/__tests__/smoke.test.ts`
- Modify: `package.json` (scripts, devDependencies)

**Interfaces:**
- Produces: команди `pnpm test` (одноразовий запуск), `pnpm test:watch`, `pnpm typecheck` (`tsc --noEmit`); глобальний setup `@testing-library/jest-dom`; середовище jsdom; stub для пакета `server-only` (він кидає помилку поза React Server середовищем, тому в тестах замінюється на порожній модуль).

- [ ] **Step 1: Встановити залежності**

```bash
pnpm add -D vitest jsdom @vitejs/plugin-react @testing-library/react @testing-library/jest-dom vite-tsconfig-paths
pnpm add zod
```

- [ ] **Step 2: Створити конфіг Vitest**

`vitest.config.ts`:

```ts
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      // server-only кидає поза RSC-середовищем; у тестах це порожній модуль
      'server-only': fileURLToPath(new URL('./src/test/server-only-stub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
```

- [ ] **Step 3: Setup-файл та stub**

`src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

`src/test/server-only-stub.ts`:

```ts
export default {}
```

- [ ] **Step 4: Додати scripts у package.json**

```json
"scripts": {
  "dev": "next dev -p 3001",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

(замінити існуючі scripts; `dev` фіксуємо на порті 3001 — його очікує CORS бекенда)

- [ ] **Step 5: Smoke-тест, що інфраструктура працює**

`src/lib/utils/__tests__/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

describe('інфраструктура тестів', () => {
  it('vitest працює', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 6: Запустити тести**

Run: `pnpm test`
Expected: 1 passed. Потім `pnpm typecheck` — без помилок.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: vitest + typecheck/scripts фундамент"
```

---

### Task 2: Доменні типи + парсинг відповідей API

**Files:**
- Create: `src/types/api.ts`
- Create: `src/types/venue.ts`
- Create: `src/types/user.ts`
- Create: `src/lib/api/parse.ts`
- Test: `src/lib/api/__tests__/parse.test.ts`
- Test: `src/types/__tests__/venue.test.ts`

**Interfaces:**
- Produces (використовуються усіма наступними тасками):

```ts
// src/types/api.ts
export interface PaginatedMeta { page: number; limit: number; total: number; hasMore: boolean }
export class ApiError extends Error {
  constructor(
    public status: number,    // HTTP-статус, напр. 409
    public code: string,      // 'CONFLICT' | 'BAD_REQUEST' | 'UNAUTHORIZED' | ...
    message: string,          // текст бекенда українською
    public details: unknown = null,
  )
}
export function parseData<T>(res: Response): Promise<T>          // розгортає {data: T}; кидає ApiError
export function parseList<T>(res: Response): Promise<{ data: T[]; meta?: PaginatedMeta }>
export function parseRaw<T>(res: Response): Promise<T>           // без обгортки (auth, analytics)

// src/types/venue.ts
export interface Venue {
  id: string; ownerId: string; name: string; description: string | null
  address: string; latitude: number | null; longitude: number | null
  contacts: { phone?: string; instagram?: string; facebook?: string; website?: string }
  workingHours: Record<string, string>
  averageCheck: number | null; mainPhotoUrl: string | null
  status: 'pending' | 'approved' | 'rejected' | 'archived'
  ratingAvg: number | null; ratingCount: number; viewCount: number
  createdAt: string; updatedAt: string
  photos: { id: string; url: string; sortOrder: number }[]
  features: { id: string; code: string; name: string; icon: string | null }[]
  tags: { id: string; name: string; slug: string }[]
  types: { id: string; name: string; slug: string }[]
}
export function parseVenue(raw: RawVenue): Venue   // конвертує рядкові numeric у number
```

- `RawVenue` — тип «як приходить з бекенда» (ratingAvg: string|null, averageCheck: string|null, latitude: string|null, longitude: string|null, `featureAssignments: [{feature: {...}}]`, `venueTags: [{tag: {...}}]`, `venueTypeAssignments: [{type: {...}}]`, `photos`). Оголосити у тому ж файлі.

- [ ] **Step 1: Написати failing-тести парсингу**

`src/lib/api/__tests__/parse.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ApiError, parseData, parseList, parseRaw } from '@/lib/api/parse'

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('parseData', () => {
  it('розгортає {data: T}', async () => {
    const res = jsonRes({ data: { id: '1' } })
    expect(await parseData<{ id: string }>(res)).toEqual({ id: '1' })
  })
  it('кидає ApiError з полів error бекенда', async () => {
    const res = jsonRes({ error: { code: 'NOT_FOUND', message: 'Заклад не знайдено', details: null } }, 404)
    await expect(parseData(res)).rejects.toMatchObject({
      status: 404, code: 'NOT_FOUND', message: 'Заклад не знайдено',
    })
  })
  it('кидає ApiError INTERNAL_ERROR при несподіваному тілі', async () => {
    const res = jsonRes({ smth: 'wrong' })
    await expect(parseData(res)).rejects.toBeInstanceOf(ApiError)
  })
})

describe('parseList', () => {
  it('повертає data + meta', async () => {
    const res = jsonRes({ data: [{ a: 1 }], meta: { page: 1, limit: 20, total: 1, hasMore: false } })
    expect(await parseList<{ a: number }>(res)).toEqual({
      data: [{ a: 1 }],
      meta: { page: 1, limit: 20, total: 1, hasMore: false },
    })
  })
})

describe('parseRaw', () => {
  it('не розгортає обгортку (формат /auth/login)', async () => {
    const res = jsonRes({ accessToken: 'a', refreshToken: 'r', user: { id: 'u' } }, 201)
    expect(await parseRaw<{ accessToken: string }>(res)).toEqual({
      accessToken: 'a', refreshToken: 'r', user: { id: 'u' },
    })
  })
})
```

- [ ] **Step 2: Запустити тести, переконатися, що падають**

Run: `pnpm test`
Expected: FAIL — модуль `@/lib/api/parse` не знайдено.

- [ ] **Step 3: Реалізувати parse.ts**

`src/lib/api/parse.ts`:

```ts
import type { PaginatedMeta } from '@/types/api'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: unknown = null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function errorFromResponse(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string; details?: unknown } }
    if (body.error?.code) {
      return new ApiError(res.status, body.error.code, body.error.message ?? 'Помилка запиту', body.error.details ?? null)
    }
  } catch {
    // не-JSON тіло
  }
  return new ApiError(res.status, 'INTERNAL_ERROR', 'Сервіс тимчасово недоступний')
}

export async function parseData<T>(res: Response): Promise<T> {
  if (!res.ok) throw await errorFromResponse(res)
  const body = (await res.json()) as { data?: T }
  if (!('data' in body)) throw await errorFromResponse(res)
  return body.data as T
}

export async function parseList<T>(res: Response): Promise<{ data: T[]; meta?: PaginatedMeta }> {
  if (!res.ok) throw await errorFromResponse(res)
  return (await res.json()) as { data: T[]; meta?: PaginatedMeta }
}

export async function parseRaw<T>(res: Response): Promise<T> {
  if (!res.ok) throw await errorFromResponse(res)
  return (await res.json()) as T
}
```

`src/types/api.ts`:

```ts
export interface PaginatedMeta {
  page: number
  limit: number
  total: number
  hasMore: boolean
}
```

- [ ] **Step 4: Запустити тести парсингу — мають пройти**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Failing-тести parseVenue (рядкові numeric + розгортання relations)**

`src/types/__tests__/venue.test.ts`:

```ts
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
```

- [ ] **Step 6: Запустити — мають спасти (немає модуля), потім реалізувати**

`src/types/venue.ts` — `RawVenue` (усі numeric — `string | null`, relations «як у бекенда»), `Venue` (numeric — `number | null`), реалізація:

```ts
import type { PaginatedMeta } from '@/types/api'

// --- Типи «як з бекенда» (raw) ---
export interface RawVenue {
  id: string
  ownerId: string
  name: string
  description: string | null
  address: string
  latitude: string | null
  longitude: string | null
  contacts: { phone?: string; instagram?: string; facebook?: string; website?: string }
  workingHours: Record<string, string>
  averageCheck: string | null
  mainPhotoUrl: string | null
  status: 'pending' | 'approved' | 'rejected' | 'archived'
  ratingAvg: string | null
  ratingCount: number
  viewCount: number
  createdAt: string
  updatedAt: string
  photos: { id: string; venueId: string; url: string; sortOrder: number }[]
  featureAssignments: { feature: { id: string; code: string; name: string; icon: string | null } }[]
  venueTags: { tag: { id: string; name: string; slug: string } }[]
  venueTypeAssignments: { type: { id: string; name: string; slug: string } }[]
}

// --- Типи після парсингу (для UI) ---
export interface VenueFeature { id: string; code: string; name: string; icon: string | null }
export interface VenueTag { id: string; name: string; slug: string }
export interface VenueType { id: string; name: string; slug: string }
export interface VenuePhoto { id: string; url: string; sortOrder: number }

export interface Venue {
  id: string
  ownerId: string
  name: string
  description: string | null
  address: string
  latitude: number | null
  longitude: number | null
  contacts: { phone?: string; instagram?: string; facebook?: string; website?: string }
  workingHours: Record<string, string>
  averageCheck: number | null
  mainPhotoUrl: string | null
  status: 'pending' | 'approved' | 'rejected' | 'archived'
  ratingAvg: number | null
  ratingCount: number
  viewCount: number
  createdAt: string
  updatedAt: string
  photos: VenuePhoto[]
  features: VenueFeature[]
  tags: VenueTag[]
  types: VenueType[]
}

function num(v: string | number | null): number | null {
  if (v === null || v === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

export function parseVenue(raw: RawVenue): Venue {
  return {
    id: raw.id,
    ownerId: raw.ownerId,
    name: raw.name,
    description: raw.description,
    address: raw.address,
    latitude: num(raw.latitude),
    longitude: num(raw.longitude),
    contacts: raw.contacts ?? {},
    workingHours: raw.workingHours ?? {},
    averageCheck: num(raw.averageCheck),
    mainPhotoUrl: raw.mainPhotoUrl,
    status: raw.status,
    ratingAvg: num(raw.ratingAvg),
    ratingCount: raw.ratingCount,
    viewCount: raw.viewCount,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    photos: raw.photos ?? [],
    features: (raw.featureAssignments ?? []).map((a) => a.feature),
    tags: (raw.venueTags ?? []).map((a) => a.tag),
    types: (raw.venueTypeAssignments ?? []).map((a) => a.type),
  }
}

export type VenueList = { data: Venue[]; meta?: PaginatedMeta }
```

`src/types/user.ts`:

```ts
export type Role = 'user' | 'venue_admin' | 'super_admin' | 'critic'

export interface SessionUser {
  id: string
  email: string
  roles: Role[]
}

export interface Profile {
  firstname: string | null
  lastname: string | null
  phone: string | null
  age: number | null
  avatarUrl: string | null
}
```

- [ ] **Step 7: Запустити всі тести + typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: доменні типи + парсинг відповідей API (ApiError, parseVenue)"
```

---

### Task 3: Сесія (cookie-обгортка) + server-клієнт

**Files:**
- Create: `src/lib/auth/session.ts`
- Create: `src/lib/api/server-client.ts`
- Test: `src/lib/auth/__tests__/session.test.ts`
- Modify: `.env.local` (create: `BACKEND_URL=http://localhost:3000`)
- Modify: `next.config.ts` (rewrite `/static`)

**Interfaces:**
- Produces:

```ts
// src/lib/auth/session.ts  (server-only)
export const SESSION_COOKIE = 'piyachok_session'
export interface SessionTokens { accessToken: string; refreshToken: string }
export function encodeTokens(t: SessionTokens): string
export function decodeTokens(value: string | undefined | null): SessionTokens | null
export function sessionCookieOptions(): { httpOnly: true; sameSite: 'lax'; path: '/'; maxAge: number; secure: boolean }
export async function getSessionTokens(): Promise<SessionTokens | null>   // читає cookie через cookies()
export async function setSessionCookie(tokens: SessionTokens): Promise<void>   // route handler only
export async function clearSessionCookie(): Promise<void>                     // route handler only
export async function refreshTokens(refreshToken: string): Promise<SessionTokens | null>
// POST `${BACKEND_URL}/api/v1/auth/refresh` {refreshToken}; 201 → нові токени; інше → null

// src/lib/api/server-client.ts (server-only)
export const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000'
export async function serverFetch<T>(path: string, opts?: {
  tokens?: SessionTokens | null   // якщо передано — додає Authorization
  revalidate?: number             // next: { revalidate }; 0 → cache: 'no-store'
  init?: RequestInit
}): Promise<T>                    // розгортає {data} → T (parseData)
export async function serverFetchList<T>(path: string, opts?: {
  tokens?: SessionTokens | null; revalidate?: number; init?: RequestInit
}): Promise<{ data: T[]; meta?: PaginatedMeta }>   // через parseList (зберігає meta)
```

- [ ] **Step 1: Failing-тести чистої логіки cookie**

`src/lib/auth/__tests__/session.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { decodeTokens, encodeTokens, sessionCookieOptions } from '@/lib/auth/session'

describe('сесійний cookie', () => {
  it('encode → decode дає ті самі токени', () => {
    const t = { accessToken: 'a.b.c', refreshToken: 'r.d.e' }
    expect(decodeTokens(encodeTokens(t))).toEqual(t)
  })
  it('decode null/сміття/порожній JSON → null', () => {
    expect(decodeTokens(undefined)).toBeNull()
    expect(decodeTokens('not-json')).toBeNull()
    expect(decodeTokens('{}')).toBeNull() // немає обох полів
  })
  it('опції cookie: httpOnly, lax, 30 днів', () => {
    const o = sessionCookieOptions()
    expect(o.httpOnly).toBe(true)
    expect(o.sameSite).toBe('lax')
    expect(o.path).toBe('/')
    expect(o.maxAge).toBe(30 * 24 * 3600)
  })
})
```

- [ ] **Step 2: Запустити — FAIL (немає модуля)**

Run: `pnpm test`

- [ ] **Step 3: Реалізувати session.ts**

```ts
import 'server-only'
import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'piyachok_session'

export interface SessionTokens {
  accessToken: string
  refreshToken: string
}

export function encodeTokens(t: SessionTokens): string {
  return JSON.stringify(t)
}

export function decodeTokens(value: string | undefined | null): SessionTokens | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<SessionTokens>
    if (typeof parsed.accessToken === 'string' && typeof parsed.refreshToken === 'string') {
      return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken }
    }
  } catch {
    // не-JSON
  }
  return null
}

export function sessionCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 30 * 24 * 3600,
    secure: process.env.NODE_ENV === 'production',
  }
}

export async function getSessionTokens(): Promise<SessionTokens | null> {
  const store = await cookies()
  return decodeTokens(store.get(SESSION_COOKIE)?.value)
}

// Викликати ЛИШЕ в route handlers / server actions
export async function setSessionCookie(tokens: SessionTokens): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, encodeTokens(tokens), sessionCookieOptions())
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 })
}

export async function refreshTokens(refreshToken: string): Promise<SessionTokens | null> {
  const backend = process.env.BACKEND_URL ?? 'http://localhost:3000'
  try {
    const res = await fetch(`${backend}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { accessToken?: string; refreshToken?: string }
    if (!body.accessToken || !body.refreshToken) return null
    return { accessToken: body.accessToken, refreshToken: body.refreshToken }
  } catch {
    return null
  }
}
```

Примітка: `server-only` пакет — він входить у Next.js; якщо TS скаржиться на відсутній модуль — `pnpm add server-only`.

- [ ] **Step 4: Запустити тести — PASS** (`pnpm test`)

- [ ] **Step 5: Реалізувати server-client.ts**

```ts
import 'server-only'
import { parseData, parseList } from '@/lib/api/parse'
import type { PaginatedMeta } from '@/types/api'
import type { SessionTokens } from '@/lib/auth/session'

export const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000'

interface ServerFetchOpts {
  tokens?: SessionTokens | null
  revalidate?: number
  init?: RequestInit
}

async function backendFetch(path: string, opts: ServerFetchOpts = {}) {
  const headers = new Headers(opts.init?.headers)
  if (opts.tokens?.accessToken) headers.set('Authorization', `Bearer ${opts.tokens.accessToken}`)
  if (opts.init?.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
  const cacheOpts =
    opts.revalidate === 0
      ? { cache: 'no-store' as const } // динамічний запит (кабінетні сторінки)
      : opts.revalidate !== undefined
        ? { next: { revalidate: opts.revalidate } }
        : {}
  return fetch(`${BACKEND_URL}/api/v1${path}`, { ...opts.init, headers, ...cacheOpts })
}

export async function serverFetch<T>(path: string, opts?: ServerFetchOpts): Promise<T> {
  const res = await backendFetch(path, opts)
  return parseData<T>(res)
}

export async function serverFetchList<T>(
  path: string,
  opts?: ServerFetchOpts,
): Promise<{ data: T[]; meta?: PaginatedMeta }> {
  const res = await backendFetch(path, opts)
  return parseList<T>(res)
}
```

- [ ] **Step 6: .env.local + next.config.ts**

`.env.local`:

```
BACKEND_URL=http://localhost:3000
```

`next.config.ts`:

```ts
import type { NextConfig } from 'next'

const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3000'

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [{ source: '/static/:path*', destination: `${backendUrl}/static/:path*` }]
  },
}

export default nextConfig
```

- [ ] **Step 7: Брами + commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: усі зелені.

```bash
git add -A
git commit -m "feat: сесійний cookie + server-клієнт + rewrite /static"
```

---

### Task 4: Auth route handlers (login, register, logout) + OAuth (callback, redirect)

**Files:**
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/register/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/api/auth/google/route.ts`
- Create: `src/app/api/auth/facebook/route.ts`
- Create: `src/app/auth/callback/route.ts`
- Test: `src/app/api/auth/__tests__/login.test.ts`
- Test: `src/app/auth/callback/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `setSessionCookie`, `clearSessionCookie`, `refreshTokens`, `BACKEND_URL`, `ApiError`.
- Produces (для Task 7, 9, 11):
  - `POST /api/auth/login` body `{email, password}` → 200 `{ok: true}` + Set-Cookie; помилки бекенда — проксуються як `{error: {code, message}}` з відповідним статусом.
  - `POST /api/auth/register` body = RegisterDto → так само.
  - `POST /api/auth/logout` → 200 `{ok: true}`, cookie видалено (навіть якщо бекенд недоступний).
  - `GET /api/auth/google` / `GET /api/auth/facebook` → 302 на `${BACKEND_URL}/api/v1/auth/{google|facebook}`.
  - `GET /auth/callback?access&refresh` → 302 `/` + Set-Cookie; без параметрів → 302 `/auth/login?error=oauth`.

- [ ] **Step 1: Failing-тести login handler**

`src/app/api/auth/__tests__/login.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const setSpy = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ set: setSpy, get: vi.fn(), delete: vi.fn(), has: vi.fn(() => false) })),
}))

import { POST as login } from '@/app/api/auth/login/route'

const okBackend = {
  ok: true,
  status: 201,
  json: async () => ({ accessToken: 'AT', refreshToken: 'RT', user: { id: 'u1', email: 'a@b.c', roles: ['user'] } }),
}

beforeEach(() => {
  vi.restoreAllMocks()
  setSpy.mockClear()
})

describe('POST /api/auth/login', () => {
  it('успіх: кладе токени в cookie і повертає ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okBackend))
    const res = await login(new Request('http://l/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.c', password: 'Password1' }),
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(setSpy).toHaveBeenCalledWith('piyachok_session', JSON.stringify({ accessToken: 'AT', refreshToken: 'RT' }), expect.objectContaining({ httpOnly: true }))
  })

  it('401 від бекенда проксується клієнту', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Невірний email або пароль', details: null } }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    )))
    const res = await login(new Request('http://l/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@b.c', password: 'wrong' }),
    }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.message).toBe('Невірний email або пароль')
    expect(setSpy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Запустити — FAIL (немає route)**

Run: `pnpm test`

- [ ] **Step 3: Реалізувати auth handlers**

Спільний хелпер `src/app/api/auth/_backend.ts` (приватний модуль, не route):

```ts
import { NextResponse } from 'next/server'

export const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3000'

/** Викликає auth-ендпоінт бекенда; повертає NextResponse або JSON-помилку бекенда. */
export async function postBackend(path: string, body: unknown): Promise<NextResponse> {
  const res = await fetch(`${backendUrl}/api/v1${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    return NextResponse.json(json ?? { error: { code: 'INTERNAL_ERROR', message: 'Сервіс тимчасово недоступний' } }, { status: res.status })
  }
  return NextResponse.json(json)
}
```

`src/app/api/auth/login/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { setSessionCookie } from '@/lib/auth/session'
import { postBackend } from '../_backend'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Некоректний запит' } }, { status: 400 })

  const res = await postBackend('/auth/login', body)
  if (res.status === 200 || res.status === 201) {
    const tokens = (await res.json()) as { accessToken: string; refreshToken: string }
    await setSessionCookie({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken })
    return NextResponse.json({ ok: true })
  }
  return res
}
```

`src/app/api/auth/register/route.ts` — ідентичний login, але `postBackend('/auth/register', body)`.

`src/app/api/auth/logout/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { clearSessionCookie, getSessionTokens, refreshTokens } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest) {
  const tokens = await getSessionTokens()
  if (tokens) {
    // Скасовуємо refresh-токен на бекенді; невдача не блокує вихід
    await fetch(`${process.env.BACKEND_URL ?? 'http://localhost:3000'}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    }).catch(() => null)
  }
  await clearSessionCookie()
  return NextResponse.json({ ok: true })
}
```

`src/app/api/auth/google/route.ts` (facebook — те саме з 'facebook'):

```ts
import { NextResponse } from 'next/server'
import { backendUrl } from '../_backend'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.redirect(`${backendUrl}/api/v1/auth/google`)
}
```

- [ ] **Step 4: Failing-тести OAuth callback, потім реалізація**

`src/app/auth/callback/__tests__/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const setSpy = vi.fn()
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ set: setSpy, get: vi.fn(), delete: vi.fn(), has: vi.fn(() => false) })),
}))

import { GET as callback } from '@/app/auth/callback/route'

beforeEach(() => setSpy.mockClear())

describe('GET /auth/callback', () => {
  it('кладе токени з query в cookie і редіректить на /', async () => {
    const res = await callback(new NextRequest('http://l/auth/callback?access=AT&refresh=RT'))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('http://l/')
    expect(setSpy).toHaveBeenCalledWith('piyachok_session', JSON.stringify({ accessToken: 'AT', refreshToken: 'RT' }), expect.anything())
  })
  it('без параметрів — на логін з error=oauth', async () => {
    const res = await callback(new NextRequest('http://l/auth/callback'))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('/auth/login?error=oauth')
    expect(setSpy).not.toHaveBeenCalled()
  })
})
```

Імпорти вгорі файлу: `import { NextRequest } from 'next/server'`.

`src/app/auth/callback/route.ts` (route.ts — без page.tsx поруч, конфлікт заборонений):

```ts
import { NextRequest, NextResponse } from 'next/server'
import { setSessionCookie } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const access = req.nextUrl.searchParams.get('access')
  const refresh = req.nextUrl.searchParams.get('refresh')
  if (access && refresh) {
    await setSessionCookie({ accessToken: access, refreshToken: refresh })
    return NextResponse.redirect(new URL('/', req.nextUrl.origin))
  }
  return NextResponse.redirect(new URL('/auth/login?error=oauth', req.nextUrl.origin))
}
```

- [ ] **Step 5: Запустити тести — PASS** (`pnpm test`)

- [ ] **Step 6: Брами + commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add -A
git commit -m "feat: BFF auth handlers (login/register/logout) + OAuth redirect і callback"
```

---

### Task 5: Catch-all проксі `/api/v1/[...path]` з авто-refresh

**Files:**
- Create: `src/app/api/v1/[...path]/route.ts`
- Test: `src/app/api/v1/[...path]/__tests__/proxy.test.ts`

**Interfaces:**
- Consumes: `getSessionTokens`, `setSessionCookie`, `refreshTokens`, `SESSION_COOKIE`, `sessionCookieOptions`, `BACKEND_URL`.
- Produces: браузерний клієнт (Task 6) викликає `fetch('/api/v1/<будь-який шлях бекенда>', {method, body})` — відповідь ідентична бекендовій (той самий статус і тіло), але:
  - за наявності сесії додається `Authorization: Bearer`;
  - при 401 з валидним refreshToken: ротація cookie + автоматичний повтор запиту один раз;
  - при мертвій сесії — прокситься той самий 401.

- [ ] **Step 1: Failing-тести проксі**

`src/app/api/v1/[...path]/__tests__/proxy.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

let cookieStore: { value: string | undefined }

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (name === 'piyachok_session' ? { value: cookieStore.value } : undefined),
    set: (name: string, value: string) => { if (name === 'piyachok_session') cookieStore.value = value },
  })),
}))

import { GET as proxyGet } from '@/app/api/v1/[...path]/route'

const jsonRes = (body: unknown, status = 200, headers: Record<string, string> = { 'content-type': 'application/json' }) =>
  new Response(JSON.stringify(body), { status, headers })

const makeCtx = (path: string[]) => ({ params: Promise.resolve({ path }) })

beforeEach(() => {
  cookieStore.value = JSON.stringify({ accessToken: 'OLD_AT', refreshToken: 'REF' })
  vi.restoreAllMocks()
})

describe('проксі /api/v1', () => {
  it('додає Authorization з cookie і проксує відповідь', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect((init?.headers as Headers).get('Authorization')).toBe('Bearer OLD_AT')
      return jsonRes({ data: { ok: 1 } })
    })
    vi.stubGlobal('fetch', fetchMock)
    const res = await proxyGet(new Request('http://l/api/v1/auth/me') as never, makeCtx(['auth', 'me']) as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { ok: 1 } })
  })

  it('при 401 робить refresh, оновлює cookie і повторює запит', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonRes({ error: { code: 'UNAUTHORIZED', message: 'x', details: null } }, 401))
      .mockResolvedValueOnce(jsonRes({ accessToken: 'NEW_AT', refreshToken: 'NEW_RT' }, 201)) // /auth/refresh
      .mockResolvedValueOnce(jsonRes({ data: { id: 'u1' } }))                                  // retry /auth/me
    vi.stubGlobal('fetch', fetchMock)
    const res = await proxyGet(new Request('http://l/api/v1/auth/me') as never, makeCtx(['auth', 'me']) as never)
    expect(res.status).toBe(200)
    expect(cookieStore.value).toBe(JSON.stringify({ accessToken: 'NEW_AT', refreshToken: 'NEW_RT' }))
    const retryInit = fetchMock.mock.calls[2][1] as RequestInit
    expect((retryInit.headers as Headers).get('Authorization')).toBe('Bearer NEW_AT')
  })

  it('мертвий refresh → проксує 401', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonRes({ error: { code: 'UNAUTHORIZED', message: 'x', details: null } }, 401))
      .mockResolvedValueOnce(jsonRes({ error: { code: 'UNAUTHORIZED', message: 'x', details: null } }, 401))
    vi.stubGlobal('fetch', fetchMock)
    const res = await proxyGet(new Request('http://l/api/v1/auth/me') as never, makeCtx(['auth', 'me']) as never)
    expect(res.status).toBe(401)
  })

  it('без сесії не додає Authorization', async () => {
    cookieStore.value = undefined
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect((init?.headers as Headers).get('Authorization')).toBeNull()
      return jsonRes({ data: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    await proxyGet(new Request('http://l/api/v1/venues') as never, makeCtx(['venues']) as never)
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Запустити — FAIL**

Run: `pnpm test`

- [ ] **Step 3: Реалізувати проксі**

`src/app/api/v1/[...path]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import {
  getSessionTokens, refreshTokens, SESSION_COOKIE, sessionCookieOptions, encodeTokens,
} from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3000'

type Ctx = { params: Promise<{ path: string[] }> }

async function forward(req: NextRequest, path: string[], accessToken: string | null): Promise<Response> {
  const target = `${BACKEND}/api/v1/${path.join('/')}${req.nextUrl.search}`
  const headers = new Headers()
  const contentType = req.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  return fetch(target, {
    method: req.method,
    headers,
    body: req.body ?? undefined,
    // @ts-expect-error duplex потрібен для стрімінгового body
    duplex: 'half',
  })
}

async function passthrough(res: Response, newTokens?: string): Promise<NextResponse> {
  const body = await res.arrayBuffer()
  const out = new NextResponse(body, {
    status: res.status,
    headers: res.headers.has('content-type') ? { 'content-type': res.headers.get('content-type')! } : undefined,
  })
  if (newTokens) out.cookies.set(SESSION_COOKIE, newTokens, sessionCookieOptions())
  return out
}

async function handle(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const { path } = await ctx.params
  const tokens = await getSessionTokens()

  let backendRes = await forward(req, path, tokens?.accessToken ?? null)

  // Авто-refresh при 401 (окрім самого refresh-ендпоінта — його клієнти не викликають)
  if (backendRes.status === 401 && tokens?.refreshToken && !path.join('/').startsWith('auth/')) {
    const fresh = await refreshTokens(tokens.refreshToken)
    if (fresh) {
      backendRes = await forward(req, path, fresh.accessToken)
      return passthrough(backendRes, encodeTokens(fresh))
    }
  }
  return passthrough(backendRes)
}

export const GET = handle
export const POST = handle
export const PATCH = handle
export const PUT = handle
export const DELETE = handle
```

- [ ] **Step 4: Запустити тести — PASS**

Run: `pnpm test`
Якщо тести «без сесії» падають через cookie-mock, переконатися, що `getSessionTokens` повертає null, коли value undefined.

- [ ] **Step 5: Брами + commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add -A
git commit -m "feat: catch-all проксі /api/v1 з авто-refresh токенів"
```

---

### Task 6: Клієнтський apiClient + UserProvider

**Files:**
- Create: `src/lib/api/client.ts`
- Create: `src/components/providers/user-provider.tsx`
- Test: `src/lib/api/__tests__/client.test.ts`

**Interfaces:**
- Consumes: `ApiError`, `parseList`-подібне читання (клієнт отримує сире тіло бекенда через проксі).
- Produces:

```ts
// src/lib/api/client.ts  ('use client' сумісний; чистий модуль)
export interface ClientListResult<T> { data: T[]; meta?: PaginatedMeta }
export async function api<T>(path: string, init?: RequestInit): Promise<T>
// fetch(`/api/v1${path}`) → parseData; при ApiError UNAUTHORIZED → window.location.assign('/auth/login?next=' + encodeURIComponent(location.pathname)) і throw
export async function apiList<T>(path: string, init?: RequestInit): Promise<ClientListResult<T>>
export function authApiError(e: unknown): string | null
// якщо e — ApiError, повертає e.message (для показу під формою); інакше null

// src/components/providers/user-provider.tsx ('use client')
export function UserProvider({ initialUser, children }: { initialUser: SessionUser | null; children: ReactNode })
export function useUser(): {
  user: SessionUser | null
  setUser: (u: SessionUser | null) => void
  logout: () => Promise<void>   // POST /api/auth/logout; setUser(null); router.refresh()
}
```

- [ ] **Step 1: Failing-тести apiClient**

`src/lib/api/__tests__/client.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, apiList, authApiError } from '@/lib/api/client'
import { ApiError } from '@/lib/api/parse'

afterEach(() => vi.unstubAllGlobals())

describe('api', () => {
  it('фетчить відносний шлях через проксі і розгортає data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: { id: 'x' } }), { status: 200, headers: { 'content-type': 'application/json' } },
    )))
    expect(await api<{ id: string }>('/auth/me')).toEqual({ id: 'x' })
  })

  it('401 → редірект на логін з next і throw ApiError', async () => {
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { pathname: '/venues/x', assign } })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'x', details: null } }), { status: 401 },
    )))
    await expect(api('/me')).rejects.toBeInstanceOf(ApiError)
    expect(assign).toHaveBeenCalledWith('/auth/login?next=' + encodeURIComponent('/venues/x'))
  })
})

describe('apiList', () => {
  it('повертає data+meta', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: [1], meta: { page: 1, limit: 20, total: 1, hasMore: false } }),
      { status: 200 },
    )))
    expect(await apiList<number>('/venues')).toEqual({ data: [1], meta: { page: 1, limit: 20, total: 1, hasMore: false } })
  })
})

describe('authApiError', () => {
  it('повертає message ApiError', () => {
    expect(authApiError(new ApiError(409, 'CONFLICT', 'Ви вже залишили відгук'))).toBe('Ви вже залишили відгук')
  })
  it('не-ApiError → null', () => {
    expect(authApiError(new Error('x'))).toBeNull()
  })
})
```

- [ ] **Step 2: Запустити — FAIL. Реалізувати client.ts**

```ts
import { ApiError, parseData, parseList } from '@/lib/api/parse'

function redirectToLogin() {
  const next = typeof window !== 'undefined' ? window.location.pathname : '/'
  window.location.assign('/auth/login?next=' + encodeURIComponent(next))
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, init)
  if (res.status === 401) {
    // проксі вже спробував refresh — сесія мертва
    redirectToLogin()
  }
  return parseData<T>(res)
}

export async function apiList<T>(path: string, init?: RequestInit) {
  const res = await fetch(`/api/v1${path}`, init)
  if (res.status === 401) redirectToLogin()
  return parseList<T>(res)
}

export function authApiError(e: unknown): string | null {
  if (e instanceof ApiError) return e.message
  return null
}
```

- [ ] **Step 3: Реалізувати UserProvider**

`src/components/providers/user-provider.tsx`:

```tsx
'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { SessionUser } from '@/types/user'

interface UserContextValue {
  user: SessionUser | null
  setUser: (u: SessionUser | null) => void
  logout: () => Promise<void>
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ initialUser, children }: { initialUser: SessionUser | null; children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(initialUser)
  const router = useRouter()

  // Підтвердження сесії: якщо SSR відрендерив гостя через протермінований
  // access-токен, проксі тут зробить refresh і поверне користувача.
  useEffect(() => {
    let cancelled = false
    fetch('/api/v1/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled || !body?.data) return
        const next = body.data as SessionUser
        setUser((prev) => (prev?.id === next.id ? prev : next))
      })
      .catch(() => null)
    return () => { cancelled = true }
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null)
    setUser(null)
    router.push('/')
    router.refresh()
  }, [router])

  return <UserContext.Provider value={{ user, setUser, logout }}>{children}</UserContext.Provider>
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser має використовуватись всередині UserProvider')
  return ctx
}
```

- [ ] **Step 4: Тести + брами**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS. (UserProvider — верстка; тестується опосередковано в Task 9 компонентними тестами AgeGate-патерну; тут достатньо unit apiClient.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: клієнтський apiClient з 401-редіректом + UserProvider"
```

---

### Task 7: Дизайн-токени + UI-примітиви

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/input.tsx`
- Create: `src/components/ui/select.tsx`
- Create: `src/components/ui/badge.tsx`
- Create: `src/components/ui/rating-stars.tsx`
- Create: `src/components/ui/empty-state.tsx`
- Create: `src/components/ui/skeleton.tsx`
- Create: `src/components/ui/pagination.tsx`
- Create: `src/components/ui/modal.tsx`
- Test: `src/components/ui/__tests__/rating-stars.test.tsx`
- Test: `src/components/ui/__tests__/pagination.test.tsx`

**Interfaces:**
- Produces (Task 8, 9, 10 і плани 2–4):

```tsx
export function Button({ variant?: 'primary'|'secondary'|'ghost'|'danger', size?: 'sm'|'md', ...buttonProps }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?; size? })
export function Input(props: InputHTMLAttributes<HTMLInputElement>)          // з класами Tailwind
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>)
export function Badge({ children, tone?: 'neutral'|'brand'|'success'|'warning' })
export function RatingStars({ value: number | null, count?: number })       // зірки (aria-label «Рейтинг 4.7 з 5»)
export function EmptyState({ title, description, action? }: { title: string; description?: string; action?: ReactNode })
export function Skeleton({ className?: string })
export function Pagination({ page, totalPages, hrefFor }: { page: number; totalPages: number; hrefFor: (p: number) => string })  // <Link>-и; рендериться завжди з однаковою висотою або null, якщо totalPages <= 1
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode })
```

- [ ] **Step 1: Дизайн-токени (globals.css)**

Замінити вміст `src/app/globals.css` (зберегти `@import "tailwindcss";` і налаштування шрифтів із поточного файлу, якщо вони там є):

```css
@import "tailwindcss";

@theme {
  /* Бренд: тепла «пивна» гама */
  --color-brand-50: #fef8ee;
  --color-brand-100: #fcedd5;
  --color-brand-200: #f8d8a8;
  --color-brand-300: #f2bd73;
  --color-brand-400: #ec9f3e;
  --color-brand-500: #e08221;
  --color-brand-600: #c1681a;
  --color-brand-700: #9d4f19;
  --color-brand-800: #7f3f1b;
  --color-brand-900: #68341a;

  --color-surface: #faf9f7;
  --color-ink: #1c1917;
}

body {
  @apply bg-surface text-ink antialiased;
}
```

- [ ] **Step 2: Failing-тести RatingStars і Pagination**

`src/components/ui/__tests__/rating-stars.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RatingStars } from '@/components/ui/rating-stars'

describe('RatingStars', () => {
  it('null → «Немає оцінок»', () => {
    render(<RatingStars value={null} />)
    expect(screen.getByText('Немає оцінок')).toBeInTheDocument()
  })
  it('число з однією десятою і лічильник', () => {
    render(<RatingStars value={4.7} count={12} />)
    expect(screen.getByText('4,7')).toBeInTheDocument()
    expect(screen.getByText(/12 відгук/)).toBeInTheDocument()
  })
})
```

`src/components/ui/__tests__/pagination.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Pagination } from '@/components/ui/pagination'

describe('Pagination', () => {
  it('одна сторінка → нічого не рендерить', () => {
    const { container } = render(<Pagination page={1} totalPages={1} hrefFor={() => '#'} />)
    expect(container).toBeEmptyDOMElement()
  })
  it('кілька сторінок → кнопки навігації', () => {
    render(<Pagination page={2} totalPages={3} hrefFor={(p) => `/?page=${p}`} />)
    expect(screen.getByRole('link', { name: 'Попередня' })).toHaveAttribute('href', '/?page=1')
    expect(screen.getByRole('link', { name: 'Наступна' })).toHaveAttribute('href', '/?page=3')
    expect(screen.getByRole('link', { name: '1' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Запустити — FAIL. Реалізувати примітиви**

`rating-stars.tsx`:

```tsx
export function RatingStars({ value, count }: { value: number | null; count?: number }) {
  if (value === null) return <span className="text-sm text-stone-400">Немає оцінок</span>
  const rounded = Math.round(value * 2) / 2
  const stars = [1, 2, 3, 4, 5]
    .map((i) => (rounded >= i ? '★' : rounded >= i - 0.5 ? '★' : '☆'))
    .join('')
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Рейтинг ${value} з 5`}>
      <span className="text-brand-500">{stars}</span>
      <span className="text-sm font-medium">{value.toFixed(1).replace('.', ',')}</span>
      {count !== undefined && <span className="text-sm text-stone-500">({count} відгуків)</span>}
    </span>
  )
}
```

(половинна зірка відображається звичайною «★» із `opacity-50` на розсуд виконавця; головне — контракти тестів: null → «Немає оцінок», число → «4,7».)

`pagination.tsx`:

```tsx
import Link from 'next/link'

export function Pagination({ page, totalPages, hrefFor }: {
  page: number
  totalPages: number
  hrefFor: (p: number) => string
}) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
  return (
    <nav className="flex items-center gap-2" aria-label="Пагінація">
      {page > 1 && <Link className="rounded-lg border px-3 py-1.5 hover:bg-stone-100" href={hrefFor(page - 1)}>Попередня</Link>}
      {pages.map((p) =>
        p === page
          ? <span key={p} aria-current="page" className="rounded-lg bg-brand-500 px-3 py-1.5 text-white">{p}</span>
          : <Link key={p} className="rounded-lg border px-3 py-1.5 hover:bg-stone-100" href={hrefFor(p)}>{p}</Link>,
      )}
      {page < totalPages && <Link className="rounded-lg border px-3 py-1.5 hover:bg-stone-100" href={hrefFor(page + 1)}>Наступна</Link>}
    </nav>
  )
}
```

Решта примітивів — звичайні Tailwind-обгортки без логіки (Button: варіанти класів через об'єкт-мапу; Input/Select: `w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-brand-500 focus:outline-none`; Modal: `fixed inset-0 z-50 flex items-center justify-center bg-black/50` + ролі `dialog`; EmptyState: центрований блок; Skeleton: `animate-pulse rounded-lg bg-stone-200`).

- [ ] **Step 4: Тести + брами**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: дизайн-токени + UI-примітиви (Button, RatingStars, Pagination, Modal…)"
```

---

### Task 8: Zod-схеми auth + валідація форм

**Files:**
- Create: `src/lib/validation/auth.ts`
- Test: `src/lib/validation/__tests__/auth.test.ts`

**Interfaces:**
- Produces (Task 10):

```ts
export const loginSchema = z.object({ email: z.string().email('Некоректний email'), password: z.string().min(1, 'Вкажіть пароль') })
export type LoginValues = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  firstname: z.string().min(2, 'Мінімум 2 символи'),
  lastname: z.string().min(2, 'Мінімум 2 символи'),
  email: z.string().email('Некоректний email'),
  password: z
    .string()
    .min(8, 'Мінімум 8 символів')
    .regex(/[A-ZА-ЯЁЇІЄҐ]/, 'Потрібна хоча б одна велика літера')
    .regex(/\d/, 'Потрібна хоча б одна цифра'),
  age: z.coerce.number().int().min(18, 'Мінімум 18 років').optional(),
  phone: z.string().optional(),
  acceptEula: z.literal(true, { message: 'Потрібно прийняти угоду користувача' }),
})
export type RegisterValues = z.infer<typeof registerSchema>
```

- [ ] **Step 1: Failing-тести**

`src/lib/validation/__tests__/auth.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { loginSchema, registerSchema } from '@/lib/validation/auth'

describe('loginSchema', () => {
  it('валідний вхід', () => {
    expect(loginSchema.safeParse({ email: 'a@b.c', password: 'x' }).success).toBe(true)
  })
  it('невалідний email', () => {
    expect(loginSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false)
  })
})

describe('registerSchema', () => {
  const valid = {
    firstname: 'Олена', lastname: 'Коваль', email: 'a@b.c',
    password: 'Password1', age: 20, acceptEula: true,
  }
  it('валідна реєстрація', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true)
  })
  it('пароль без цифри відхиляється', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'PasswordOnly' }).success).toBe(false)
  })
  it('пароль без великої літери відхиляється', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'password1' }).success).toBe(false)
  })
  it('age < 18 відхиляється', () => {
    expect(registerSchema.safeParse({ ...valid, age: 17 }).success).toBe(false)
  })
  it('acceptEula false відхиляється', () => {
    expect(registerSchema.safeParse({ ...valid, acceptEula: false }).success).toBe(false)
  })
})
```

- [ ] **Step 2: FAIL → реалізація (код в Interfaces вище) → PASS**

Run: `pnpm test`
Expected: спочатку FAIL, після реалізації PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: zod-схеми авторизації (правила = DTO бекенда)"
```

---

### Task 9: Кореневий layout + Header + Footer + AgeGate

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/components/layout/header.tsx`
- Create: `src/components/layout/footer.tsx`
- Create: `src/components/layout/age-gate.tsx`
- Test: `src/components/layout/__tests__/age-gate.test.tsx`

**Interfaces:**
- Consumes: `UserProvider`, `getSessionTokens`, `serverFetch` (для початкового `SessionUser` у layout), UI-примітиви.
- Produces: `AgeGate` — клієнтська модалка 18+ (sessionStorage `age-confirmed`), блокує контент до підтвердження. `Header` — клієнтський (useUser): лого «Пиячок» → `/`, посилання «Каталог» → `/`, пошукове поле → `/venues?q=`, UserMenu (увійти / профіль+вихід). Пункти «Новини» і «Зустрічі» додаються в Планах 2–3 разом зі сторінками (уникаємо мертвих посилань).

- [ ] **Step 1: Failing-тести AgeGate**

`src/components/layout/__tests__/age-gate.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { AgeGate } from '@/components/layout/age-gate'

beforeEach(() => sessionStorage.clear())

describe('AgeGate', () => {
  it('не показується, якщо в цьому сеансі вже підтверджено', () => {
    sessionStorage.setItem('age-confirmed', '1')
    const { container } = render(<AgeGate />)
    expect(container).toBeEmptyDOMElement()
  })
  it('показує попередження і після натискання ховається і ставить прапорець', () => {
    render(<AgeGate />)
    expect(screen.getByText(/18 років/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Підтверджую/ }))
    expect(sessionStorage.getItem('age-confirmed')).toBe('1')
    expect(screen.queryByText(/18 років/)).not.toBeInTheDocument()
  })
  it('натискання «Мені немає 18» показує текст про вихід', () => {
    render(<AgeGate />)
    fireEvent.click(screen.getByRole('button', { name: /Мені немає 18/ }))
    expect(screen.getByText(/Вийдіть із застосунку/i)).toBeInTheDocument()
    expect(sessionStorage.getItem('age-confirmed')).toBeNull()
  })
})
```

- [ ] **Step 2: FAIL → реалізація AgeGate**

`src/components/layout/age-gate.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

export function AgeGate() {
  const [confirmed, setConfirmed] = useState(true) // до монтування нічого не рендеримо (SSR)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    setConfirmed(sessionStorage.getItem('age-confirmed') === '1')
  }, [])

  if (confirmed) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
        {denied ? (
          <p className="text-lg font-medium">Вийдіть із застосунку. Доступ лише для повнолітніх.</p>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Вікове обмеження</h1>
            <p className="mt-3 text-stone-600">
              Запускаючи цей застосунок, ви погоджуєтесь, що вам є 18 років.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Button onClick={() => { sessionStorage.setItem('age-confirmed', '1'); setConfirmed(true) }}>
                Підтверджую, мені 18+
              </Button>
              <Button variant="secondary" onClick={() => setDenied(true)}>Мені немає 18</Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Header + Footer**

`src/components/layout/header.tsx` ('use client'; клієнтський бо використовує useUser; логотип — текст «🍺 Пиячок»):

```tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUser } from '@/components/providers/user-provider'
import { Button } from '@/components/ui/button'

export function Header() {
  const { user, logout } = useUser()
  const router = useRouter()

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-brand-600">🍺 Пиячок</Link>
        <nav className="flex gap-4 text-stone-600">
          <Link className="hover:text-brand-600" href="/">Каталог</Link>
        </nav>
        <form
          className="ml-auto hidden sm:block"
          onSubmit={(e) => {
            e.preventDefault()
            const q = new FormData(e.currentTarget).get('q')
            router.push(`/venues?q=${encodeURIComponent(String(q ?? ''))}`)
          }}
        >
          <input
            name="q"
            placeholder="Пошук закладів…"
            aria-label="Пошук закладів"
            className="w-56 rounded-lg border border-stone-300 px-3 py-1.5 focus:border-brand-500 focus:outline-none"
          />
        </form>
        {user ? (
          <div className="flex items-center gap-3">
            <Link href="/account" className="text-stone-700 hover:text-brand-600">{user.email}</Link>
            <Button variant="secondary" size="sm" onClick={() => logout()}>Вийти</Button>
          </div>
        ) : (
          <Link href="/auth/login"><Button size="sm">Увійти</Button></Link>
        )}
      </div>
    </header>
  )
}
```

`src/components/layout/footer.tsx` — простий серверний футер: `© 2026 Пиячок · Каталог закладів України`.

- [ ] **Step 4: Кореневий layout**

`src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { getSessionTokens } from '@/lib/auth/session'
import { serverFetch } from '@/lib/api/server-client'
import { UserProvider } from '@/components/providers/user-provider'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { AgeGate } from '@/components/layout/age-gate'
import type { SessionUser } from '@/types/user'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Пиячок — каталог закладів', template: '%s · Пиячок' },
  description: 'Пошук барів, ресторанів та кафе: рейтинги, відгуки, новини та зустрічі.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Гостьовий стан при протермінованому access-токені виправить UserProvider (Task 6)
  let user: SessionUser | null = null
  const tokens = await getSessionTokens()
  if (tokens) {
    try {
      user = await serverFetch<SessionUser>('/auth/me', { tokens, revalidate: 0 })
    } catch {
      user = null
    }
  }

  return (
    <html lang="uk">
      <body>
        <UserProvider initialUser={user}>
          <AgeGate />
          <Header />
          <main className="mx-auto min-h-[70vh] max-w-6xl px-4 py-6">{children}</main>
          <Footer />
        </UserProvider>
      </body>
    </html>
  )
}
```

(Видалити `page.tsx`-контент create-next-app не тут — у Task 10 замінимо саму сторінку. Файл `src/app/page.tsx` наразі лишається як є — build не зламається.)

- [ ] **Step 5: Тести + брами**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS (build важливо — перевірка layout/SSR).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: кореневий layout з сесією + Header/Footer + AgeGate 18+"
```

---

### Task 10: Каталог закладів (головна `/`)

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/lib/venues/query.ts`
- Create: `src/components/features/venues/venue-card.tsx`
- Create: `src/components/features/venues/venue-filters.tsx`
- Create: `src/app/loading.tsx`
- Test: `src/lib/venues/__tests__/query.test.ts`

**Interfaces:**
- Consumes: `serverFetch`, `parseVenue`, `Pagination`, `RatingStars`, `Badge`, `EmptyState`, `Skeleton`.
- Produces:

```ts
// src/lib/venues/query.ts (чистий модуль — легко тестувати)
export interface CatalogQuery {   // нормалізований стан фільтрів
  q?: string; type?: string; feature: string[]; tag: string[]
  minCheck?: number; maxCheck?: number; minRating?: number
  lat?: number; lng?: number; radiusKm?: number
  sort: 'newest' | 'rating' | 'check' | 'name' | 'distance'
  page: number; limit: number
}
export const DEFAULT_CATALOG_QUERY: CatalogQuery
export function parseCatalogQuery(sp: Record<string, string | string[] | undefined>): CatalogQuery
  // читає searchParams; ігнорує невалідні значення; sort 'distance' без lat/lng → 'newest'
export function toSearch(q: CatalogQuery): string
  // querystring для fetch бекенда: feature/tag — CSV; порожні поля не серіалізуються; page/limit завжди
```

- [ ] **Step 1: Failing-тести query.ts**

`src/lib/venues/__tests__/query.test.ts`:

```ts
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
```

- [ ] **Step 2: FAIL → реалізація query.ts → PASS**

```ts
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

export const DEFAULT_CATALOG_QUERY: CatalogQuery = { feature: [], tag: [], sort: 'newest', page: 1, limit: 20 }

const SORTS = ['rating', 'check', 'newest', 'name', 'distance'] as const

function num(v: string | string[] | undefined): number | undefined {
  if (typeof v !== 'string') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined
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
    minCheck: num(sp.minCheck),
    maxCheck: num(sp.maxCheck),
    minRating: num(sp.minRating),
    lat,
    lng,
    radiusKm: num(sp.radiusKm),
    sort: sort === 'distance' && !hasGeo ? 'newest' : sort,
    page: page !== undefined && page >= 1 ? Math.floor(page) : 1,
    limit: DEFAULT_CATALOG_QUERY.limit,
  }
}

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
```

- [ ] **Step 3: VenueCard**

`src/components/features/venues/venue-card.tsx` (серверний):

```tsx
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { RatingStars } from '@/components/ui/rating-stars'
import type { Venue } from '@/types/venue'

export function VenueCard({ venue }: { venue: Venue }) {
  return (
    <Link
      href={`/venues/${venue.id}`}
      className="group block overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-brand-400 hover:shadow-md"
    >
      <div className="aspect-[4/3] overflow-hidden bg-stone-100">
        {venue.mainPhotoUrl ? (
          <img
            src={venue.mainPhotoUrl}
            alt={venue.name}
            className="h-full w-full object-cover transition group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl">🍺</div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-stone-900">{venue.name}</h3>
          <RatingStars value={venue.ratingAvg} />
        </div>
        <p className="mt-1 truncate text-sm text-stone-500">{venue.address}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {venue.averageCheck !== null && (
            <Badge tone="brand">≈ {venue.averageCheck} грн</Badge>
          )}
          {venue.types.map((t) => <Badge key={t.id}>{t.name}</Badge>)}
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: VenueFilters (клієнтський)**

`src/components/features/venues/venue-filters.tsx` ('use client'). Логіка: стан фільтрів — локальний; кнопка «Застосувати»/Enter будує `URLSearchParams` і `router.push('/?' + qs)` (стан у URL — SSR бачить усе). Поля:
- `q` — Input (пошук, init із prop `initial`);
- `sort` — Select: `rating` За рейтингом / `check` За чеком / `newest` Нові / `name` За алфавітом / `distance` Поблизу;
- `type` — Input (slug), `tag` — Input (через кому), `feature` — Input (через кому);
- `minCheck`, `maxCheck`, `minRating` — Input-числа;
- кнопка «Поблизу»: `navigator.geolocation.getCurrentPosition` → встановлює lat/lng/radiusKm=5; при відмові — `<p role="alert">` «Геолокація недоступна — сортування за відстанню вимкнено»;
- кнопка «Скинути» → `router.push('/')`.

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { CatalogQuery } from '@/lib/venues/query'

export function VenueFilters({ initial }: { initial: CatalogQuery }) {
  const router = useRouter()
  const [q, setQ] = useState(initial.q ?? '')
  const [sort, setSort] = useState(initial.sort)
  const [type, setType] = useState(initial.type ?? '')
  const [tag, setTag] = useState(initial.tag.join(', '))
  const [feature, setFeature] = useState(initial.feature.join(', '))
  const [minCheck, setMinCheck] = useState(initial.minCheck?.toString() ?? '')
  const [maxCheck, setMaxCheck] = useState(initial.maxCheck?.toString() ?? '')
  const [minRating, setMinRating] = useState(initial.minRating?.toString() ?? '')
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(
    initial.lat !== undefined && initial.lng !== undefined ? { lat: initial.lat, lng: initial.lng } : null,
  )
  const [geoError, setGeoError] = useState<string | null>(null)

  function apply(e: FormEvent) {
    e.preventDefault()
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (sort !== 'newest') p.set('sort', sort)
    if (type) p.set('type', type)
    if (tag) p.set('tag', tag)
    if (feature) p.set('feature', feature)
    if (minCheck) p.set('minCheck', minCheck)
    if (maxCheck) p.set('maxCheck', maxCheck)
    if (minRating) p.set('minRating', minRating)
    if (geo) {
      p.set('lat', String(geo.lat))
      p.set('lng', String(geo.lng))
      p.set('radiusKm', '5')
    }
    router.push(`/?${p.toString()}`)
  }

  function nearMe() {
    if (!navigator.geolocation) return setGeoError('Геолокація недоступна у вашому браузері')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGeoError(null)
      },
      () => setGeoError('Не вдалося отримати геолокацію — перевірте дозвіл браузера'),
    )
  }

  return (
    <form onSubmit={apply} className="mb-6 rounded-2xl border border-stone-200 bg-white p-4" aria-label="Фільтри каталогу">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">
          Пошук
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Назва або адреса" />
        </label>
        <label className="text-sm">
          Сортування
          <Select value={sort} onChange={(e) => setSort(e.target.value as CatalogQuery['sort'])}>
            <option value="newest">Нові</option>
            <option value="rating">За рейтингом</option>
            <option value="check">За середнім чеком</option>
            <option value="name">За алфавітом</option>
            <option value="distance" disabled={!geo}>Поблизу (потрібна геолокація)</option>
          </Select>
        </label>
        <label className="text-sm">
          Тип закладу (slug)
          <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="напр. bar" />
        </label>
        <label className="text-sm">
          Теги (через кому)
          <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="pyvo, sport" />
        </label>
        <label className="text-sm">
          Фічі (через кому)
          <Input value={feature} onChange={(e) => setFeature(e.target.value)} placeholder="wifi, parking" />
        </label>
        <label className="text-sm">
          Чек від
          <Input type="number" min="0" value={minCheck} onChange={(e) => setMinCheck(e.target.value)} />
        </label>
        <label className="text-sm">
          Чек до
          <Input type="number" min="0" value={maxCheck} onChange={(e) => setMaxCheck(e.target.value)} />
        </label>
        <label className="text-sm">
          Рейтинг від
          <Input type="number" min="0" max="5" step="0.5" value={minRating} onChange={(e) => setMinRating(e.target.value)} />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit">Застосувати</Button>
        <Button type="button" variant="secondary" onClick={nearMe}>📍 Поблизу</Button>
        {geo && <span className="text-sm text-stone-500">Радіус 5 км</span>}
        <Button type="button" variant="ghost" onClick={() => router.push('/')}>Скинути</Button>
      </div>
      {geoError && <p role="alert" className="mt-2 text-sm text-red-600">{geoError}</p>}
    </form>
  )
}
```

- [ ] **Step 5: Головна сторінка**

Замінити `src/app/page.tsx`:

```tsx
import { serverFetchList } from '@/lib/api/server-client'
import { parseVenue, type RawVenue } from '@/types/venue'
import { parseCatalogQuery, toSearch, type CatalogQuery } from '@/lib/venues/query'
import { VenueCard } from '@/components/features/venues/venue-card'
import { VenueFilters } from '@/components/features/venues/venue-filters'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CatalogPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const query: CatalogQuery = parseCatalogQuery(sp)

  const raw = await serverFetchList<RawVenue>(`/venues?${toSearch(query)}`, { revalidate: 60 })
  const venues = raw.data.map(parseVenue)

  const totalPages = raw.meta ? Math.max(1, Math.ceil(raw.meta.total / raw.meta.limit)) : 1

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Каталог закладів</h1>
        <p className="text-stone-500">Знайдіть ідеальне місце: рейтинги, чеки, відгуки та зустрічі</p>
      </div>
      <VenueFilters initial={query} />
      {venues.length === 0 ? (
        <EmptyState
          title="Нічого не знайдено"
          description="Спробуйте змінити пошуковий запит або скинути фільтри."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((v) => <VenueCard key={v.id} venue={v} />)}
        </div>
      )}
      <div className="mt-8">
        <Pagination
          page={query.page}
          totalPages={totalPages}
          hrefFor={(p) => {
            const qs = toSearch({ ...query, page: p })
            return `/?${qs}`
          }}
        />
      </div>
    </div>
  )
}
```

`src/app/loading.tsx` (скелетон каталогу):

```tsx
export default function Loading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-64 animate-pulse rounded-2xl bg-stone-200" />
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Ручна верифікація (бекенд має бути запущений)**

Run: `cd /home/palamar/Desktop/dev/backend-final && pnpm start:dev` (в окремому терміналі; якщо БД не піднята — `docker compose up -d`), потім `pnpm dev` тут.
Expected: `http://localhost:3001/` — каталог з даними; фільтри змінюють URL і результати; пагінація працює; empty state при `?q=неможливийзапит`.

- [ ] **Step 7: Брами + commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`

```bash
git add -A
git commit -m "feat: каталог закладів з пошуком, фільтрами, сортуванням і пагінацією"
```

---

### Task 11: Сторінки входу та реєстрації

**Files:**
- Create: `src/app/auth/login/page.tsx`
- Create: `src/app/auth/register/page.tsx`
- Test: `src/app/auth/__tests__/login-form.test.tsx`

**Interfaces:**
- Consumes: `loginSchema`, `registerSchema`, `authApiError`, `useUser`, `useRouter`, `useSearchParams`.
- Produces: `/auth/login` та `/auth/register` (клієнтські форми); після успіху — `router.push(next)` (санітизований: лише шляхи, що починаються з `/` і не з `//`) або `/`; після логіна — `setUser(...)` + `router.refresh()`.
- Обидві сторінки — клієнтські компоненти в `Suspense`-обгортці (бо `useSearchParams`): `export default function Page() { return <Suspense fallback={null}><LoginForm/></Suspense> }`.

- [ ] **Step 1: Failing-тести форми логіна**

`src/app/auth/__tests__/login-form.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import { LoginForm } from '@/app/auth/login/login-form'

describe('LoginForm', () => {
  it('показує помилку бекенда при 401', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Невірний email або пароль', details: null } }),
      { status: 401 },
    )))
    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.c' } })
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Увійти' }))
    await waitFor(() => expect(screen.getByText('Невірний email або пароль')).toBeInTheDocument())
  })

  it('клієнтська валідація: не валідний email не йде в мережу', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nope' } })
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Увійти' }))
    await waitFor(() => expect(screen.getByText('Некоректний email')).toBeInTheDocument())
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: FAIL → реалізувати LoginForm**

`src/app/auth/login/login-form.tsx` ('use client'):

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUser } from '@/components/providers/user-provider'
import { authApiError } from '@/lib/api/client'
import { loginSchema } from '@/lib/validation/auth'
import type { SessionUser } from '@/types/user'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setUser } = useUser()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = loginSchema.safeParse({ email, password })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Перевірте поля')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      if (res.ok) {
        const me = await fetch('/api/v1/auth/me').then((r) => (r.ok ? r.json() : null))
        if (me?.data) setUser(me.data as SessionUser)
        const next = searchParams.get('next')
        const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
        router.push(safeNext)
        router.refresh()
        return
      }
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      setError(body?.error?.message ?? 'Не вдалося увійти')
    } catch {
      setError('Сервіс тимчасово недоступний')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
      <h1 className="text-xl font-bold">Вхід</h1>
      {searchParams.get('error') === 'oauth' && (
        <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">Не вдалося увійти через соцмережу. Спробуйте ще раз.</p>
      )}
      <label className="block text-sm">
        Email
        <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="block text-sm">
        Пароль
        <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full">{loading ? 'Входимо…' : 'Увійти'}</Button>
      <div className="flex justify-between gap-2 text-sm">
        <Link className="text-brand-600 hover:underline" href="/auth/register">Реєстрація</Link>
        <a className="text-brand-600 hover:underline" href="/api/auth/google">Увійти через Google</a>
        <a className="text-brand-600 hover:underline" href="/api/auth/facebook">Facebook</a>
      </div>
    </form>
  )
}
```

`src/app/auth/login/page.tsx`:

```tsx
import { Suspense } from 'react'
import { LoginForm } from './login-form'

export const metadata = { title: 'Вхід' }

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
```

- [ ] **Step 3: Запустити тести — PASS**

- [ ] **Step 4: Реєстрація (без окремих unit-тестів — та сама схема, що LoginForm)**

`src/app/auth/register/register-form.tsx` — 'use client'; поля: firstname, lastname, email, password, age (опц.), phone (опц.), acceptEula (checkbox, обов'язковий); валідація `registerSchema` (помилки zod — над полем, через об'єкт помилок полів); сабміт `POST /api/auth/register` → такий самий флоу, як login (me → setUser → next → refresh); показ помилки бекенда (409 «email зайнято», 409 EULA).

`src/app/auth/register/page.tsx` — Suspense-обгортка, як у login.

- [ ] **Step 5: Ручна верифікація**

`pnpm dev`; перевірити: вхід з валідними даними → редірект на `/`; невірний пароль → інлайн «Невірний email або пароль»; реєстрація без галочки EULA → клієнтська помилка; `?next=/` works; кнопка Google веде на бекендовий OAuth (якщо ключі бекенда не налаштовані — прийде помилкова сторінка провайдера, це очікувано).

- [ ] **Step 6: Брами + commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`

```bash
git add -A
git commit -m "feat: сторінки входу і реєстрації + OAuth-кнопки"
```

---

### Task 12: not-found / error-сторінки + README

**Files:**
- Create: `src/app/not-found.tsx`
- Create: `src/app/error.tsx`
- Create: `src/app/venues/[id]/not-found.tsx` (заготовка: переюзаний текст; сама сторінка — План 2)
- Modify: `README.md`

**Interfaces:**
- Consumes: `Button`, `EmptyState`.
- Produces: глобальні 404/помилки рендерингу.

- [ ] **Step 1: Реалізація**

`src/app/not-found.tsx`:

```tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <p className="text-6xl">🍺</p>
      <h1 className="mt-4 text-2xl font-bold">Сторінку не знайдено</h1>
      <p className="mt-2 text-stone-500">Можливо, посилання застаріло або сторінку видалено.</p>
      <Link className="mt-6 inline-block rounded-lg bg-brand-500 px-4 py-2 text-white hover:bg-brand-600" href="/">
        До каталогу
      </Link>
    </div>
  )
}
```

`src/app/error.tsx` ('use client' — файлова конвенція; кнопка retry):

```tsx
'use client'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-bold">Щось пішло не так</h1>
      <p className="mt-2 text-stone-500">Сервіс тимчасово недоступний. Спробуйте ще раз.</p>
      <button className="mt-6 rounded-lg bg-brand-500 px-4 py-2 text-white hover:bg-brand-600" onClick={reset}>
        Повторити
      </button>
    </div>
  )
}
```

- [ ] **Step 2: README**

Додати в `README.md` розділ «Запуск»: backend `http://localhost:3000` (pnpm start:dev у backend-final), frontend `pnpm dev` → `http://localhost:3001`, `.env.local` з `BACKEND_URL`, брами `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

- [ ] **Step 3: Бари + commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`

```bash
git add -A
git commit -m "feat: 404/error-сторінки + README"
```

---

## Після виконання плану

Фінальний чекліст Плану 1:
- [ ] `pnpm build` без помилок
- [ ] каталог рендериться SSR з бекенда; фільтри/сортування/пагінація в URL
- [ ] логін/реєстрація встановлюють httpOnly-cookie; `document.cookie` НЕ містить `piyachok_session` (httpOnly)
- [ ] OAuth-кнопки ведуть на бекенд; колбек `?access&refresh` → cookie → `/`
- [ ] AgeGate з'являється один раз на сеанс
- [ ] усі тести зелені

Далі: **План 2** (сторінка закладу, відгуки, обране, скарги, «Пиячок», маршрут) — пишеться після виконання Плану 1.
