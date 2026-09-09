# План 2 — Сторінка закладу, відгуки, обране, скарги, «Пиячок», маршрут + резидуали Плану 1 (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Побудувати публічну сторінку закладу `/venues/[id]` з галереєю, графіком роботи, контактами, клікабельними тегами, записом перегляду і кнопкою «Маршрут»; відгуки (список/форма/редагування/видалення), обране (кнопка + `/account/favorites`), скаргу, форму «Пиячок»; закрити резидуали Плану 1 з SDD-леджеру.

**Architecture:** Продовження BFF-архітектури Плану 1: публічна сторінка закладу — Server Component з `revalidate: 60`; усі мутації (відгук, обране, скарга, «Пиячок») — клієнтські через `api()` → проксі `/api/v1/[...path]` → NestJS. Ключовий факт бекенда: **ендпоінта «один заклад з relations» не існує** — `GET /venues/:id` повертає лише core + owner, photos/tags/features/types є тільки в елементах списку `GET /venues`, тож сторінка збагачується пошуком за точною назвою з graceful degradation.

**Tech Stack:** Next.js 16.3.4 (App Router, React 19), TypeScript, Tailwind v4, zod, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-08-pyiachok-frontend-design.md` — виконавець ОБОВ'ЯЗКОВО читає спеку перед стартом. Next.js 16 має breaking changes — звірятися з `node_modules/next/dist/docs/` (зокрема `01-app/03-api-reference/03-file-conventions/dynamic-routes.md`, `page.md`, `not-found.md`, `error.md`; `params`/`searchParams` — `Promise`, await обов'язковий).

## Global Constraints

- Мова UI, коментарів у коді й тестів: українська.
- Бекенд: `BACKEND_URL` (default `http://localhost:3000`), префікс `/api/v1`, dev-порт фронтенду `3001`.
- Формат успіху: `{ data, meta? }`; помилки: `{ error: { code, message } }` (поле `details` бекенд НІКОЛИ не заповнює — клієнтські помилки полів DTO не маппити на поля, показувати `message` інлайн, fallback «Сервіс тимчасово недоступний»).
- **Усі POST повертають 201** (на бекенді немає `@HttpCode`). `DELETE /reviews/:id` → 200 з ПОРОЖНІМ тілом (парсити через `parseEmpty`, не `parseData`).
- **Рядкові numeric**: `ratingAvg`, `averageCheck`, `latitude/longitude`, `desiredBudget` — парсити `Number()` в API-шарі. `rating`, `groupSize` — числа.
- `passwordHash` підтікає у `owner` (`GET /venues/:id`) та `user` (`GET /venues/:id/reviews`) — типи цих полів НЕ містять, парсери проєктують лише потрібні поля.
- `GET /venues/:id`: лише approved, інакше 404 «Заклад не знайдено»; relations відсутні (див. Architecture).
- `GET /venues/:id/reviews?sort=`: валідні значення лише `newest|oldest|highest|lowest` (невалідне → 500 на бекенді, тому фронт посилає тільки їх).
- Обране: `POST/DELETE /me/favorites/:venueId`, список `GET /me/favorites?page&limit` (projection `{id, name, address, ratingAvg(рядок), mainPhotoUrl}`); ендпоінта «статус обраного» нема — початковий стан рахуємо серверно зі списку.
- Скарга: `POST /complaints` `{venueId?, reviewId?, reason, text}`; `venueId` АБО `reviewId` обов'язкові (інакше 400), `reason` ∈ `fake_promo|fraud|other`, `text` ≥ 20.
- «Пиячок»: `POST /venues/:venueId/hangouts` `{date: 'YYYY-MM-DD' (не в минулому), time: 'HH:mm', purpose 10–500, gender ∈ male|female|any, groupSize int 1–20, payer ∈ me|split|them, desiredBudget? 0–100000}`; join — БЕЗ тіла.
- `POST /venues/:id/view` — публічний, 201 `{data:{recorded}}`, тіло `{sessionId}` (≤64 симв.; дедуплікація бекенда 30 хв за sessionId).
- Клієнтські запити — через `api()`/`apiList()`/`apiVoid()` (`src/lib/api/client.ts`); серверні — `serverFetch()`/`serverFetchList()` (`src/lib/api/server-client.ts`).
- Заборонені залежності: UI-бібліотеки. Нових залежностей План 2 НЕ додає.
- Кожен таск завершується зеленим `pnpm typecheck && pnpm lint && pnpm test` та комітом (виконання — у worktree, гілка `plan-2-venue-page`).

---

### Task 1: Модернізація vitest-конфігу (прибрати всі 3 попередження)

**Files:**
- Delete: `vitest.config.ts`
- Create: `vitest.config.mts`
- Modify: `package.json` (видалити `vite-tsconfig-paths` з devDependencies, `@types/node` ^20 → ^22)

**Interfaces:**
- Consumes: `src/test/setup.ts`, `src/test/server-only-stub.ts` (без змін).
- Produces: той самий контракт конфігурації (jsdom, setupFiles, globals, аліас `server-only`), але: ESM-конфіг (прибирає попередження `configLoader: 'native'`), нативний `resolve.tsconfigPaths` (прибирає попередження про deprecated-плагін), без плагіна `vite-tsconfig-paths`.

- [ ] **Step 1: Новий конфіг `vitest.config.mts`**

```mts
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// .mts (ESM): інакше Vite 8 лає «ESM syntax in a file loaded as CommonJS».
// pool лишаємо дефолтним: перевірено 2026-09-09 — vmThreads ламає
// vi.stubGlobal('window') у client.test.ts («Cannot redefine property: window»);
// порада «create jsdom once per worker» — лише performance-натяк, не помилка.
export default defineConfig({
  plugins: [react()],
  resolve: {
    // нативна підтримка tsconfig paths у Vite 8 (замість vite-tsconfig-paths)
    tsconfigPaths: true,
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

- [ ] **Step 2: Видалити deprecated-плагін і bump типів Node**

```bash
pnpm remove vite-tsconfig-paths
pnpm add -D @types/node@^22
rm vitest.config.ts
```

- [ ] **Step 3: Запустити бари**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: 59/59 PASS; у виводі НЕМАЄ попереджень про `configLoader: 'native'` і про плагін `vite-tsconfig-paths`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: vitest-конфіг на ESM + нативний tsconfigPaths (Vite 8)"
```

---

### Task 2: A11y-пас — Modal (Escape + focus-trap), AgeGate (inert-контент + вихід зі стану відмови), AppShell

**Files:**
- Modify: `src/components/ui/modal.tsx`
- Modify: `src/components/layout/age-gate.tsx`
- Create: `src/components/layout/app-shell.tsx`
- Modify: `src/app/layout.tsx`
- Test: `src/components/ui/__tests__/modal.test.tsx`
- Test: `src/components/layout/__tests__/age-gate.test.tsx` (додати кейси)
- Test: `src/components/layout/__tests__/app-shell.test.tsx`

**Interfaces:**
- Consumes: `Button`, `useSyncExternalStore`-механіка AgeGate (вже існує), `UserProvider`.
- Produces:
  - `Modal({ open, onClose, title, children })` — Escape закриває, фокус потрапляє в діалог, Tab циклічний усередині, фокус повертається на тригер після закриття. Використовується Tasks 12–13 (ComplaintForm, HangoutForm).
  - `useAgeConfirmed(): boolean` — експортований хук з `age-gate.tsx` (той самий sessionStorage-store).
  - `AppShell({ children })` — клієнтська обгортка Header/main/Footer; поки AgeGate видимий, обгортка має `inert` (контент недоступний клавіатурі/скрін-рідеру). Рендериться в root layout замість ручного AgeGate+Header+main+Footer.

- [ ] **Step 1: Failing-тести Modal**

`src/components/ui/__tests__/modal.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from '@/components/ui/modal'

describe('Modal (a11y)', () => {
  it('Escape закриває діалог', () => {
    const onClose = vi.fn()
    render(<Modal open onClose={onClose} title="Тест"><p>Контент</p></Modal>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('фокусується на першому елементі при відкритті та повертається після закриття', () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'Тригер'
    document.body.appendChild(trigger)
    trigger.focus()
    const { unmount } = render(
      <Modal open onClose={() => {}} title="Тест">
        <button>Перший</button>
      </Modal>,
    )
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Перший' }))
    unmount()
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })

  it('Tab на останньому елементі циклічно повертається до першого', () => {
    render(
      <Modal open onClose={() => {}} title="Тест">
        <button>Один</button>
        <button>Два</button>
      </Modal>,
    )
    const [first, last] = screen.getAllByRole('button').filter((b) => b.textContent !== '×')
    // «×» (закрити) — перший focusable у панелі, тому цикл: × → Один → Два → ×
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(first.previousElementSibling)
  })
})
```

- [ ] **Step 2: Запустити — FAIL (Escape не реалізовано)**

Run: `pnpm test src/components/ui/__tests__/modal.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Реалізувати Modal з Escape/focus-trap**

`src/components/ui/modal.tsx` замінити повністю:

```tsx
'use client'

import { useEffect, useRef, type ReactNode } from 'react'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'

export function Modal({ open, onClose, title, children }: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            aria-label="Закрити"
            onClick={onClose}
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-ink"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Failing-тести AppShell + AgeGate-відмова**

`src/components/layout/__tests__/app-shell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

import { AppShell } from '@/components/layout/app-shell'
import { UserProvider } from '@/components/providers/user-provider'

const renderShell = () =>
  render(
    <UserProvider initialUser={null}>
      <AppShell><p>Контент сторінки</p></AppShell>
    </UserProvider>,
  )

beforeEach(() => {
  sessionStorage.clear()
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null, { status: 401 }))))
})

describe('AppShell (AgeGate inert)', () => {
  it('поки гейт не підтверджено — контент inert, гейт видимий', () => {
    const { container } = renderShell()
    expect(container.firstChild).toHaveAttribute('inert')
    expect(screen.getByRole('button', { name: /Підтверджую/ })).toBeInTheDocument()
  })
  it('після підтвердження — контент доступний, гейту нема', () => {
    sessionStorage.setItem('age-confirmed', '1')
    const { container } = renderShell()
    expect(container.firstChild).not.toHaveAttribute('inert')
    expect(screen.queryByText(/18 років/)).not.toBeInTheDocument()
  })
})
```

Додати в `src/components/layout/__tests__/age-gate.test.tsx`:

```tsx
  it('зі стану відмови можна повернутися до підтвердження', () => {
    render(<AgeGate />)
    fireEvent.click(screen.getByRole('button', { name: /Мені немає 18/ }))
    expect(screen.getByText(/Вийдіть із застосунку/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Повернутися/ }))
    expect(screen.getByText(/18 років/)).toBeInTheDocument()
  })
```

- [ ] **Step 5: Запустити — FAIL, потім реалізувати**

`src/components/layout/age-gate.tsx`: експортувати хук і додати кнопку повернення:

```tsx
'use client'

import { useCallback, useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'

// sessionStorage недоступний під час SSR: серверний снапшот — «підтверджено»
// (до гідратації нічого не рендеримо), клієнтський читає прапорець сеансу.
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return sessionStorage.getItem('age-confirmed') === '1'
}

function getServerSnapshot() {
  return true
}

export function useAgeConfirmed(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function AgeGate() {
  const confirmed = useAgeConfirmed()
  const [denied, setDenied] = useState(false)

  const confirm = useCallback(() => {
    sessionStorage.setItem('age-confirmed', '1')
    listeners.forEach((listener) => listener())
  }, [])

  if (confirmed) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
        {denied ? (
          <>
            <p className="text-lg font-medium">Вийдіть із застосунку. Доступ лише для повнолітніх.</p>
            <Button variant="ghost" className="mt-3" onClick={() => setDenied(false)}>Повернутися</Button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Вікове обмеження</h1>
            <p className="mt-3 text-stone-600">
              Запускаючи цей застосунок, ви погоджуєтесь, що вам є 18 років.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Button onClick={confirm}>
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

`src/components/layout/app-shell.tsx`:

```tsx
'use client'

// Обгортка застосунку: поки AgeGate не підтверджено, увесь контент
// недоступний клавіатурі та скрін-рідеру (inert — React 19 підтримує як boolean-проп)
import type { ReactNode } from 'react'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { AgeGate, useAgeConfirmed } from '@/components/layout/age-gate'

export function AppShell({ children }: { children: ReactNode }) {
  const confirmed = useAgeConfirmed()
  return (
    <>
      <div inert={!confirmed}>
        <Header />
        <main className="mx-auto min-h-[70vh] max-w-6xl px-4 py-6">{children}</main>
        <Footer />
      </div>
      <AgeGate />
    </>
  )
}
```

`src/app/layout.tsx` — замінити вміст `<UserProvider>…</UserProvider>` на:

```tsx
        <UserProvider initialUser={user}>
          <AppShell>{children}</AppShell>
        </UserProvider>
```


Видалити імпорти `Header`, `Footer`, `AgeGate` з layout.tsx (вони тепер всередині AppShell). Імпортувати `AppShell`.

- [ ] **Step 6: Усі тести + бари**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS (build перевіряє SSR layout).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(a11y): Modal Escape+focus-trap, AgeGate inert-контент через AppShell"
```

---

### Task 3: OAuth-колбек без токенів в історії браузера

**Проблема (резидентуал):** поточний `route.ts` робить 302 з `/auth/callback?access=…&refresh=…` на `/` — на цей проміжний URL не можна викликати `history.replaceState`, бо на ньому не виконується жоден клієнтський JS, і запис з обома токенами лишається в історії.

**Рішення:** колбек стає клієнтською сторінкою: читає токени з query, надсилає їх тілом в новий route handler `POST /api/auth/oauth` (валідація через `/auth/me` — як у поточного route.ts, login-CSRF hardening зберігається), той ставить httpOnly-cookie; сторінка витирає URL через `history.replaceState` ДО переходу.

**Files:**
- Delete: `src/app/auth/callback/route.ts`
- Delete: `src/app/auth/callback/__tests__/route.test.ts`
- Create: `src/app/auth/callback/page.tsx`
- Create: `src/app/auth/callback/callback-client.tsx`
- Create: `src/app/api/auth/oauth/route.ts`
- Test: `src/app/auth/callback/__tests__/callback-client.test.tsx`
- Test: `src/app/api/auth/__tests__/oauth.test.ts`

**Interfaces:**
- Consumes: `setSessionCookie`, `serverFetch`, `Suspense`/`useSearchParams`-патерн форм.
- Produces: `POST /api/auth/oauth` body `{accessToken, refreshToken}` → 200 `{ok:true}` + Set-Cookie (токени валідні) | 401 `{error:{code:'UNAUTHORIZED', message:'Токени невалідні'}}` | 400 (нема полів). Сторінка `/auth/callback?access&refresh` → cookie + `history.replaceState` + `router.replace('/')`; без параметрів/при невдачі → replaceState на `/auth/login` + екран помилки з посиланням.

- [ ] **Step 1: Failing-тести route handler'а**

`src/app/api/auth/__tests__/oauth.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const setSpy = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ set: setSpy, get: vi.fn(), delete: vi.fn(), has: vi.fn(() => false) })),
}))

import { POST as oauth } from '@/app/api/auth/oauth/route'

const meOk = new Response(JSON.stringify({ data: { id: 'u1', email: 'a@b.c', roles: ['user'] } }), {
  status: 200, headers: { 'content-type': 'application/json' },
})

beforeEach(() => {
  setSpy.mockClear()
  vi.restoreAllMocks()
})

describe('POST /api/auth/oauth', () => {
  it('валідні токени: кладе cookie, повертає ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => meOk))
    const res = await oauth(new Request('http://l/api/auth/oauth', {
      method: 'POST',
      body: JSON.stringify({ accessToken: 'AT', refreshToken: 'RT' }),
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(setSpy).toHaveBeenCalledWith('piyachok_session', JSON.stringify({ accessToken: 'AT', refreshToken: 'RT' }), expect.objectContaining({ httpOnly: true }))
  })

  it('невалідні токени (401 від /auth/me): 401 клієнту, cookie НЕ ставиться', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    )))
    const res = await oauth(new Request('http://l/api/auth/oauth', {
      method: 'POST',
      body: JSON.stringify({ accessToken: 'BAD', refreshToken: 'RT' }),
    }))
    expect(res.status).toBe(401)
    expect(setSpy).not.toHaveBeenCalled()
  })

  it('без полів — 400', async () => {
    const res = await oauth(new Request('http://l/api/auth/oauth', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Реалізувати `src/app/api/auth/oauth/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { setSessionCookie } from '@/lib/auth/session'
import { serverFetch } from '@/lib/api/server-client'
import type { SessionUser } from '@/types/user'

export const dynamic = 'force-dynamic'

// Токени приходять тілом з клієнтської сторінки колбеку (не з URL, який бачить історія).
// Перед встановленням cookie валідуємо access-токен на бекенді (login-CSRF hardening).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { accessToken?: string; refreshToken?: string } | null
  if (!body?.accessToken || !body?.refreshToken) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Некоректний запит' } }, { status: 400 })
  }
  const tokens = { accessToken: body.accessToken, refreshToken: body.refreshToken }
  try {
    await serverFetch<SessionUser>('/auth/me', { tokens, revalidate: 0 })
  } catch {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Токени невалідні' } }, { status: 401 })
  }
  await setSessionCookie(tokens)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Тести клієнта колбеку**

`src/app/auth/callback/__tests__/callback-client.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const replaceState = vi.fn()
const routerReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplace }),
  useSearchParams: () => new URLSearchParams('access=AT&refresh=RT'),
}))

import { CallbackClient } from '@/app/auth/callback/callback-client'

const okRes = () => new Response(JSON.stringify({ ok: true }), { status: 200 })

beforeEach(() => {
  replaceState.mockClear()
  routerReplace.mockClear()
  vi.restoreAllMocks()
  vi.spyOn(window.history, 'replaceState').mockImplementation(replaceState)
})

describe('CallbackClient', () => {
  it('надсилає токени ТІЛОМ на /api/auth/oauth, витирає URL і йде на /', async () => {
    const fetchMock = vi.fn(async () => okRes())
    vi.stubGlobal('fetch', fetchMock)
    render(<CallbackClient />)
    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith('/'))
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/auth/oauth')
    expect(String(init.body)).not.toContain('AT') // токени в тілі, не в URL
    // replaceState витирає callback-URL з історії ДО переходу
    expect(replaceState).toHaveBeenCalledWith(null, '', '/')
    const scrubbedUrls = replaceState.mock.calls.map((c) => String(c[2]))
    expect(scrubbedUrls.every((u) => !u.includes('access=') && !u.includes('refresh='))).toBe(true)
  })

  it('невалідні токени: витирає URL і показує помилку з посиланням на логін', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })))
    render(<CallbackClient />)
    await waitFor(() => expect(screen.getByRole('link', { name: /Спробувати знову/ })).toBeInTheDocument())
    expect(replaceState).toHaveBeenCalledWith(null, '', '/auth/login')
    expect(routerReplace).not.toHaveBeenCalledWith('/')
  })
})
```

- [ ] **Step 4: Реалізувати сторінку колбеку**

`src/app/auth/callback/page.tsx`:

```tsx
import { Suspense } from 'react'
import { CallbackClient } from './callback-client'

export const metadata = { title: 'Завершення входу' }

export default function CallbackPage() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-stone-500">Завершуємо вхід…</p>}>
      <CallbackClient />
    </Suspense>
  )
}
```

`src/app/auth/callback/callback-client.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

export function CallbackClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const access = searchParams.get('access')
    const refresh = searchParams.get('refresh')

    async function finish() {
      let ok = false
      if (access && refresh) {
        try {
          const res = await fetch('/api/auth/oauth', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            // токени йдуть тілом, щоб не потрапити в жоден URL
            body: JSON.stringify({ accessToken: access, refreshToken: refresh }),
          })
          ok = res.ok
        } catch {
          ok = false
        }
      }
      if (cancelled) return
      // ВИТИРАЄМО callback-URL (з токенами) з поточного запису історії ДО переходу
      const destination = ok ? '/' : '/auth/login'
      window.history.replaceState(null, '', destination)
      if (ok) router.replace(destination)
      else setFailed(true)
    }

    finish()
    return () => { cancelled = true }
  }, [router, searchParams])

  if (failed) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">Не вдалося увійти</h1>
        <p className="mt-2 text-stone-500">Токени застаріли або невалідні.</p>
        <Link className="mt-6 inline-block rounded-lg bg-brand-500 px-4 py-2 text-white hover:bg-brand-600" href="/auth/login">
          Спробувати знову
        </Link>
      </div>
    )
  }
  return <p className="py-16 text-center text-stone-500">Завершуємо вхід…</p>
}
```

- [ ] **Step 5: Видалити старі файли, запустити тести**

```bash
git rm src/app/auth/callback/route.ts src/app/auth/callback/__tests__/route.test.ts
pnpm test
```

Expected: PASS (нові тести зелені; файл route.ts видалено — конфлікту page.tsx/route.ts немає).

- [ ] **Step 6: Бари + commit**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
git add -A
git commit -m "fix(oauth): колбек-сторінка замість redirect — токени в тілі POST, history.replaceState витирає URL"
```

---

### Task 4: /venues-редірект + харденінг каталогу

**Проблема (резидентуали):** спека (рядок 171) обіцяє пошук через `/venues?q=`, але каталог живе на `/`; фільтри `apply()` хардкодять `radiusKm=5`; `parseCatalogQuery` пропускає від'ємні/абсурдні `minCheck/minRating/radiusKm` (бекенд відповість 400); `PaginatedMeta.total/limit` не перетворюються в числа (ділення в page.tsx працює лише через JS-коерцію).

**Рішення:** `/venues` стає тонким 302-редіректом на `/` зі збереженням усіх query-параметрів (обидві поведінки зі спеки працюють; саму спеку не міняємо).

**Files:**
- Create: `src/app/venues/page.tsx`
- Test: `src/app/venues/__tests__/page.test.ts`
- Modify: `src/lib/venues/query.ts`
- Modify: `src/lib/venues/__tests__/query.test.ts` (додати кейси)
- Modify: `src/components/features/venues/venue-filters.tsx`
- Modify: `src/lib/api/parse.ts` (`parseList` — числова коерція meta)
- Modify: `src/lib/api/__tests__/parse.test.ts` (додати кейс)
- Modify: `src/app/page.tsx` (Pagination через `catalogHref`)

**Interfaces:**
- Consumes: `toSearch`, `Pagination`, `parseList`.
- Produces:
  - `GET /venues?<params>` → 307-редірект `/?<params>` (нативний `redirect()` з `next/navigation`).
  - `parseCatalogQuery` відкидає невалідні числа: `minCheck/maxCheck < 0`, `minRating ∉ [0,5]`, `radiusKm ∉ [0.1,100]` → параметр ігнорується.
  - `catalogHref(query: CatalogQuery): string` — готовий href каталогу `'/?…'` (спільний для `/` і `/account/favorites` не потрібен — тільки каталог; використовується page.tsx).
  - `parseList` повертає meta з гарантовано числовими `page/limit/total` і boolean `hasMore`.

- [ ] **Step 1: Failing-тести sanitize + catalogHref**

Додати в `src/lib/venues/__tests__/query.test.ts`:

```ts
describe('sanitize каталогу', () => {
  it('відʼємні minCheck/maxCheck ігноруються', () => {
    expect(parseCatalogQuery({ minCheck: '-50', maxCheck: '-1' }).minCheck).toBeUndefined()
    expect(parseCatalogQuery({ minCheck: '-50' }).maxCheck).toBeUndefined()
  })
  it('minRating поза 0..5 ігнорується', () => {
    expect(parseCatalogQuery({ minRating: '6' }).minRating).toBeUndefined()
    expect(parseCatalogQuery({ minRating: '-1' }).minRating).toBeUndefined()
    expect(parseCatalogQuery({ minRating: '4.5' }).minRating).toBe(4.5)
  })
  it('radiusKm поза 0.1..100 ігнорується', () => {
    expect(parseCatalogQuery({ radiusKm: '0' }).radiusKm).toBeUndefined()
    expect(parseCatalogQuery({ radiusKm: '200' }).radiusKm).toBeUndefined()
    expect(parseCatalogQuery({ radiusKm: '5' }).radiusKm).toBe(5)
  })
})

describe('catalogHref', () => {
  it('будує /?… для пагінації', () => {
    expect(catalogHref({ ...DEFAULT_CATALOG_QUERY, page: 2 })).toBe('/?sort=newest&page=2&limit=20')
  })
})
```

(імпорт: додати `catalogHref` до існуючого `import { … } from '@/lib/venues/query'`.)

- [ ] **Step 2: Failing-тест редіректу /venues**

`src/app/venues/__tests__/page.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

// redirect() кидає спеціальний NEXT_REDIRECT — мокаємо, щоб тестувати лише наш виклик
const redirect = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) })
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
})
```

- [ ] **Step 3: Failing-тест числової meta**

Додати в `src/lib/api/__tests__/parse.test.ts` (у `describe('parseList')`):

```ts
  it('meta з рядкових значень коерціюється в числа', async () => {
    const res = jsonRes({ data: [1], meta: { page: '2', limit: '20', total: '40', hasMore: 1 } })
    expect(await parseList<number>(res)).toEqual({
      data: [1],
      meta: { page: 2, limit: 20, total: 40, hasMore: true },
    })
  })
```

- [ ] **Step 4: Реалізація — query.ts**

У `src/lib/venues/query.ts`: в `parseCatalogQuery` замінити рядки повернення числових полів на санітизовані та додати `catalogHref`:

```ts
// Бекенд (QueryVenuesDto): minCheck/maxCheck >= 0, minRating 0..5, radiusKm 0.1..100.
// Невалідні значення відкидаємо (undefined), інакше бекенд відповість 400.
function inRange(v: number | undefined, min: number, max: number): number | undefined {
  return v !== undefined && v >= min && v <= max ? v : undefined
}
```

У тілі `parseCatalogQuery`:

```ts
  const minCheckRaw = num(sp.minCheck)
  const maxCheckRaw = num(sp.maxCheck)
  const minRatingRaw = num(sp.minRating)
  const radiusKmRaw = num(sp.radiusKm)
  return {
    // …(q/type/feature/tag/lat/lng/sort/page/limit — без змін)…
    minCheck: inRange(minCheckRaw, 0, Number.MAX_SAFE_INTEGER),
    maxCheck: inRange(maxCheckRaw, 0, Number.MAX_SAFE_INTEGER),
    minRating: inRange(minRatingRaw, 0, 5),
    radiusKm: inRange(radiusKmRaw, 0.1, 100),
    // sort/page — без змін
  }
```

В кінець файлу:

```ts
// Готовий href каталогу — спільний для пагінації та фільтрів
export function catalogHref(query: CatalogQuery): string {
  return `/?${toSearch(query)}`
}
```

- [ ] **Step 5: Реалізація — редірект-сторінка**

`src/app/venues/page.tsx`:

```tsx
import { redirect } from 'next/navigation'

// /venues?q=… — зручний псевдонім каталогу (спека §5: пошук → /venues?q=):
// сам каталог живе на /, тут лише перенаправляємо зі збереженням параметрів
export default async function VenuesAliasPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string' && value !== '') qs.set(key, value)
    else if (Array.isArray(value)) for (const v of value) qs.append(key, v)
  }
  redirect(qs.size > 0 ? `/?${qs.toString()}` : '/')
}
```

- [ ] **Step 6: Реалізація — parseList і venue-filters**

У `src/lib/api/parse.ts` замінити `parseList`:

```ts
// Бекенд іноді повертає числову meta рядками — коерцюємо, щоб UI не рахував ділення на рядках
export async function parseList<T>(res: Response): Promise<{ data: T[]; meta?: PaginatedMeta }> {
  if (!res.ok) throw await errorFromResponse(res)
  const body = (await res.json()) as { data?: T[]; meta?: Partial<PaginatedMeta> }
  const rawMeta = body.meta
  const meta: PaginatedMeta | undefined = rawMeta
    ? {
        page: Number(rawMeta.page),
        limit: Number(rawMeta.limit),
        total: Number(rawMeta.total),
        hasMore: Boolean(rawMeta.hasMore),
      }
    : undefined
  return { data: body.data ?? [], meta }
}
```

У `src/components/features/venues/venue-filters.tsx`: `radiusKm` — стан замість хардкоду (ініціалізація з `initial`, поле «Радіус (км)»):

```tsx
  const [radiusKm, setRadiusKm] = useState(initial.radiusKm?.toString() ?? '5')
```

У `apply()`:

```tsx
    if (geo) {
      p.set('lat', String(geo.lat))
      p.set('lng', String(geo.lng))
      p.set('radiusKm', radiusKm)
    }
```

У сітці полів (після «Рейтинг від») додати:

```tsx
        <label className="text-sm">
          Радіус (км)
          <Input type="number" min="0.1" max="100" step="0.5" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} />
        </label>
```

і замінити `{geo && <span className="text-sm text-stone-500">Радіус 5 км</span>}` на `{geo && <span className="text-sm text-stone-500">Поблизу, радіус {radiusKm} км</span>}`.

У `src/app/page.tsx` — `hrefFor` через `catalogHref`:

```tsx
        <Pagination
          page={query.page}
          totalPages={totalPages}
          hrefFor={(p) => catalogHref({ ...query, page: p })}
        />
```

- [ ] **Step 7: Тести + бари + commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS.

```bash
git add -A
git commit -m "fix: /venues-редірект на каталог, sanitize фільтрів, числова meta, radiusKm без хардкоду"
```

---

### Task 5: Фікси форм і error-механіки (login /auth/me, register aria, error.tsx-логування)

**Проблема (резидентуали):** (а) при успішному логіні падіння запиту `/auth/me` ловиться загальним `catch` — форма показує «Сервіс недоступний», хоча сесія ВЖЕ встановлена, і користувач не потрапляє на `next`; (б) помилки полів register-form рендеряться всередині `<label>` — забруднюють accessible name полів; (в) `error.tsx` отримує проп `error`, але не логує його (немає жодного hook для звітності).

**Files:**
- Modify: `src/app/auth/login/login-form.tsx`
- Modify: `src/app/auth/__tests__/login-form.test.tsx` (додати кейс)
- Modify: `src/app/auth/register/register-form.tsx`
- Test: `src/app/auth/__tests__/register-form.test.tsx` (новий файл)
- Modify: `src/app/error.tsx`

**Interfaces:**
- Consumes: `useUser`, `Button`, `Input`, `registerSchema`, `retry`-проп `error.tsx`.
- Produces: ті самі сигнатури; змінена поведінка — логін редіректить завжди після `res.ok` (навіть якщо `/auth/me` впав), register-поля пов'язані з помилками через `aria-describedby`, `error.tsx` логує `error` через `console.error`.

- [ ] **Step 1: Failing-тести**

Додати в `src/app/auth/__tests__/login-form.test.tsx`:

```tsx
  it('успішний логін + падіння /auth/me — все одно редірект (сесія встановлена)', async () => {
    const push = vi.fn()
    vi.mock('next/navigation', () => ({
      useRouter: () => ({ push, refresh: vi.fn() }),
      useSearchParams: () => new URLSearchParams(),
    }))
    // login → 200 ok; /auth/me → мережева помилка
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockRejectedValueOnce(new TypeError('network')))
    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.c' } })
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'Password1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Увійти' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/'))
    expect(screen.queryByText('Сервіс тимчасово недоступний')).not.toBeInTheDocument()
  })
```

(цей тест мокає `next/navigation` всередині — винесіть `const push = vi.fn()` у область видима обома, або замініть існуючий верхній `vi.mock('next/navigation', …)` так, щоб `useRouter` повертав `{ push, refresh }` з зовнішніх змінних: оголосіть `const push = vi.fn()` над `vi.mock` і вкажіть `useRouter: () => ({ push, refresh: vi.fn() })`.)

`src/app/auth/__tests__/register-form.test.tsx` (новий):

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/components/providers/user-provider', () => ({
  useUser: () => ({ user: null, setUser: vi.fn(), logout: vi.fn() }),
}))

import { RegisterForm } from '@/app/auth/register/register-form'

describe('RegisterForm (a11y помилок полів)', () => {
  it('помилка поля НЕ всередині label, пов'язана через aria-describedby', () => {
    render(<RegisterForm />)
    fireEvent.click(screen.getByRole('button', { name: /Зареєструватися/ }))
    const error = screen.getByText('Мінімум 2 символи') // помилка «Ім'я»
    expect(error).not.toHaveProperty('closest', undefined)
    // помилка не вкладена в label поля
    expect(error.closest('label')).toBeNull()
    const input = screen.getByLabelText('Ім\'я', { selector: 'input' })
    expect(input.getAttribute('aria-describedby')).toContain('firstname-error')
  })
})
```

- [ ] **Step 2: Запустити — FAIL**

Run: `pnpm test src/app/auth`
Expected: FAIL.

- [ ] **Step 3: Фікс login-form**

У `src/app/auth/login/login-form.tsx` замінити блок успіху:

```tsx
      if (res.ok) {
        // Сесія ВЖЕ встановлена — /auth/me лише для UI-стану; його падіння
        // не повинно блокувати редірект (інакше «Сервіс недоступний» при живій сесії)
        try {
          const me = await fetch('/api/v1/auth/me').then((r) => (r.ok ? r.json() : null))
          if (me?.data) setUser(me.data as SessionUser)
        } catch {
          // пропускаємо — router.refresh() добуде користувача в layout
        }
        const next = searchParams.get('next')
        const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
        router.push(safeNext)
        router.refresh()
        return
      }
```

- [ ] **Step 4: Фікс register-form (помилки поза label + aria-describedby)**

У `src/app/auth/register/register-form.tsx` для КОЖНОГО поля замінити патерн

```tsx
      <label className="block text-sm">
        Ім&apos;я
        {fieldErrors.firstname && <span role="alert" className="block text-red-600">{fieldErrors.firstname}</span>}
        <Input value={firstname} autoComplete="given-name" onChange={(e) => setFirstname(e.target.value)} />
      </label>
```

на (структура: label містить лише назву + поле; помилка — сусід, прив'язаний `aria-describedby`):

```tsx
      <div className="text-sm">
        <label htmlFor="reg-firstname">
          Ім&apos;я
        </label>
        <Input
          id="reg-firstname"
          aria-describedby={fieldErrors.firstname ? 'reg-firstname-error' : undefined}
          value={firstname}
          autoComplete="given-name"
          onChange={(e) => setFirstname(e.target.value)}
        />
        {fieldErrors.firstname && (
          <span id="reg-firstname-error" role="alert" className="mt-1 block text-red-600">{fieldErrors.firstname}</span>
        )}
      </div>
```

Те саме для `lastname`, `email`, `password`, `age`, `phone` (ідентифікатори `reg-lastname`, `reg-email`, `reg-password`, `reg-age`, `reg-phone`).

- [ ] **Step 5: Фікс error.tsx**

`src/app/error.tsx` замінити повністю:

```tsx
'use client'

import { useEffect } from 'react'

// Глобальна межа помилок рендерингу (конвенція файлів Next.js — error.tsx у корені app).
// retry() повторно запитує RSC-пейлоад і лише потім скидає стан межі — на відміну від
// reset(), який рендерить уже отриманий (помилковий) пейлоад і миттєво знову «падає»
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  // reporting-hook: поки немає Sentry/сервісу — консоль; digest попередньо виводимо
  useEffect(() => {
    console.error('[GlobalError]', error?.digest ?? '', error)
  }, [error])

  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-bold">Щось пішло не так</h1>
      <p className="mt-2 text-stone-500">Сервіс тимчасово недоступний. Спробуйте ще раз.</p>
      <button className="mt-6 rounded-lg bg-brand-500 px-4 py-2 text-white hover:bg-brand-600" onClick={retry}>
        Повторити
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Тести + бари + commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS.

```bash
git add -A
git commit -m "fix: логін редіректить при падінні /auth/me, aria-помилки полів реєстрації, error.tsx логує"
```

---

### Task 6: Пропущені edge-тести Плану 1 (+ SSR-guard у client.ts)

**Проблема (резидентуал):** список edge-кейсів з SDD-леджеру: refreshTokens/serverFetch, non-JSON error-body, api() non-401 ApiError, SSR redirectToLogin, межі firstname/lastname/age, Button-in-form за межами дефолтів. Один із них (SSR 401) виявляє справжній баг: `redirectToLogin()` читає `typeof window !== 'undefined'` для `next`, але потім безумовно кличе `window.location.assign` — на SSR це ReferenceError.

**Files:**
- Modify: `src/lib/auth/__tests__/session.test.ts` (refreshTokens)
- Create: `src/lib/api/__tests__/server-client.test.ts`
- Modify: `src/lib/api/__tests__/parse.test.ts` (non-JSON error body)
- Modify: `src/lib/api/__tests__/client.test.ts` (non-401, SSR)
- Modify: `src/lib/api/client.ts` (SSR-guard)
- Modify: `src/lib/validation/__tests__/auth.test.ts` (межі полів)
- Modify: `src/components/ui/__tests__/button.test.tsx` (type override)

**Interfaces:**
- Consumes: існуючі модулі; змінюється лише `redirectToLogin()` (додається SSR-guard, публічна сигнатура не міняється).
- Produces: `redirectToLogin` безпечний без window; решта — лише тести.

- [ ] **Step 1: Failing-тести**

`src/lib/api/__tests__/client.test.ts` — додати:

```ts
describe('api: edge-кейси', () => {
  it('non-401 ApiError (409) — кидає помилку бекенда, БЕЗ редіректу', async () => {
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { pathname: '/x', assign } })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { code: 'CONFLICT', message: 'Ви вже залишили відгук', details: null } }),
      { status: 409, headers: { 'content-type': 'application/json' } },
    )))
    await expect(api('/me/whatever')).rejects.toMatchObject({ status: 409, message: 'Ви вже залишили відгук' })
    expect(assign).not.toHaveBeenCalled()
  })

  it('401 без window (SSR) — відхиляється ApiError, без ReferenceError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'x', details: null } }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    )))
    const originalWindow = globalThis.window
    vi.stubGlobal('window', undefined)
    await expect(api('/me')).rejects.toBeInstanceOf(ApiError)
    vi.stubGlobal('window', originalWindow)
  })
})
```

`src/lib/auth/__tests__/session.test.ts` — додати:

```ts
describe('refreshTokens', () => {
  it('201 з новими токенами → повертає їх', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ accessToken: 'NEW_AT', refreshToken: 'NEW_RT' }),
      { status: 201, headers: { 'content-type': 'application/json' } },
    )))
    expect(await refreshTokens('RT')).toEqual({ accessToken: 'NEW_AT', refreshToken: 'NEW_RT' })
  })
  it('401 → null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })))
    expect(await refreshTokens('DEAD')).toBeNull()
  })
  it('мережева помилка → null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network') }))
    expect(await refreshTokens('RT')).toBeNull()
  })
})
```

(імпорт: додати `refreshTokens` до імпорту з `@/lib/auth/session`.)

`src/lib/api/__tests__/server-client.test.ts` (новий):

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { serverFetch } from '@/lib/api/server-client'

afterEach(() => vi.unstubAllGlobals())

const ok = () => new Response(JSON.stringify({ data: { id: 'x' } }), {
  status: 200, headers: { 'content-type': 'application/json' },
})

describe('serverFetch', () => {
  it('revalidate: 0 → cache: no-store', async () => {
    const fetchMock = vi.fn(async () => ok())
    vi.stubGlobal('fetch', fetchMock)
    await serverFetch('/venues/x', { revalidate: 0 })
    const init = fetchMock.mock.calls[0][1] as RequestInit & { cache?: string }
    expect(init.cache).toBe('no-store')
  })
  it('revalidate: 60 → next.revalidate = 60', async () => {
    const fetchMock = vi.fn(async () => ok())
    vi.stubGlobal('fetch', fetchMock)
    await serverFetch('/venues', { revalidate: 60 })
    const init = fetchMock.mock.calls[0][1] as RequestInit & { next?: { revalidate?: number } }
    expect(init.next?.revalidate).toBe(60)
  })
  it('tokens → Authorization Bearer', async () => {
    const fetchMock = vi.fn(async () => ok())
    vi.stubGlobal('fetch', fetchMock)
    await serverFetch('/me/reviews', { tokens: { accessToken: 'AT', refreshToken: 'RT' } })
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer AT')
  })
  it('body без content-type → проставляється application/json', async () => {
    const fetchMock = vi.fn(async () => ok())
    vi.stubGlobal('fetch', fetchMock)
    await serverFetch('/complaints', { init: { method: 'POST', body: JSON.stringify({ a: 1 }) } })
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Headers).get('content-type')).toBe('application/json')
  })
})
```

`src/lib/api/__tests__/parse.test.ts` — додати:

```ts
  it('не-JSON error-тіло (HTML 502) → ApiError INTERNAL_ERROR', async () => {
    const res = new Response('<html>Bad Gateway</html>', { status: 502, headers: { 'content-type': 'text/html' } })
    await expect(parseData(res)).rejects.toMatchObject({
      status: 502, code: 'INTERNAL_ERROR', message: 'Сервіс тимчасово недоступний',
    })
  })
```

`src/lib/validation/__tests__/auth.test.ts` — додати:

```ts
  it('межі полів реєстрації', () => {
    expect(registerSchema.safeParse({ ...valid, firstname: 'О' }).success).toBe(false)   // 1 символ
    expect(registerSchema.safeParse({ ...valid, lastname: 'К' }).success).toBe(false)   // 1 символ
    expect(registerSchema.safeParse({ ...valid, age: 18 }).success).toBe(true)          // межа 18 включно
    expect(registerSchema.safeParse({ ...valid, age: '20' }).success).toBe(true)        // coerce рядок
  })
```

`src/components/ui/__tests__/button.test.tsx` — додати:

```tsx
  it('type="submit" у пропсах ПЕРЕПИСУЄ дефолт button (сабміт у формі працює)', () => {
    const onSubmit = vi.fn()
    render(
      <form onSubmit={(e) => { e.preventDefault(); onSubmit() }}>
        <Button type="submit">Надіслати</Button>
      </form>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Надіслати' }))
    expect(onSubmit).toHaveBeenCalledOnce()
  })
```

- [ ] **Step 2: Запустити — SSR-тест має FAIL (ReferenceError), решта — по коду**

Run: `pnpm test`
Expected: FAIL у `401 без window (SSR)` (TypeError/ReferenceError замість ApiError) — це і є баг.

- [ ] **Step 3: SSR-guard у client.ts**

У `src/lib/api/client.ts`:

```ts
function redirectToLogin() {
  // SSR (window відсутній): редірект неможливий — проксі повернув 401,
  // server-скрипт просто отримає ApiError від виклику
  if (typeof window === 'undefined' || !window.location) return
  const next = window.location.pathname
  // Свідомо повне перезавантаження: сесія мертва, стан застосунку невалідний
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign('/auth/login?next=' + encodeURIComponent(next))
}
```

- [ ] **Step 4: Тести + бари + commit**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS.

```bash
git add -A
git commit -m "test: edge-кейси Плану 1 (refresh/serverFetch/parse/client/валідація/Button) + SSR-guard 401-редіректу"
```

---

### Task 7: Доменні типи і парсери (відгук, пиячок, обране) + format-утиліти

**Проблема:** для сторінки закладу потрібні типи сутностей, яких ще немає (відгук, «пиячок», обране), а в `RawVenue` відносини (photos/tags/types/features) обов'язкові — хоча `GET /venues/:id` їх НЕ повертає (лише owner+profile). Плюс резидуал-рекомендація: `lib/utils/format.ts` для грошей/дат до накопичення ad-hoc форматування.

**Бекенд-контракт (факти):**
- Відгук: `rating` — number; `user` приєднано з `profile`; `checkPhotoUrl` є; `desiredBudget`-подібні числові колонки прибувають РЯДКАМИ.
- Обране (`GET /me/favorites`): проекція `{id, name, address, ratingAvg (string|null), mainPhotoUrl}` — БЕЗ повного RawVenue.
- «Пиячок»: `desiredBudget` — number на вході, STRING на виході.

**Files:**
- Create: `src/types/review.ts`
- Create: `src/types/hangout.ts`
- Create: `src/types/favorite.ts`
- Modify: `src/types/venue.ts` (відносини → optional)
- Create: `src/lib/utils/format.ts`
- Test: `src/types/__tests__/review.test.ts`
- Test: `src/types/__tests__/hangout.test.ts`
- Test: `src/types/__tests__/favorite.test.ts`
- Test: `src/lib/utils/__tests__/format.test.ts`

**Interfaces:**
- Consumes: `parseVenue` (вже толерує `?? []` — цей таск лише вирівнює типи).
- Produces (для Tasks 9-14):
  - `parseReview(raw: RawReview): Review`; `Review` має `author: { firstname: string | null; lastname: string | null }`, `rating: number`, `checkPhotoUrl: string | null`, `isFeatured: boolean`.
  - `parseHangout(raw: RawHangout): Hangout`; `Hangout.desiredBudget: number | null`.
  - `parseFavoriteVenue(raw: RawFavoriteVenue): FavoriteVenue`; `FavoriteVenue.ratingAvg: number | null`.
  - `formatMoney(v: number | null): string`, `formatDate(iso: string): string`, `formatDateTime(iso: string): string`.

- [ ] **Step 1: Failing-тести**

`src/types/__tests__/review.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseReview, type RawReview } from '@/types/review'

const raw: RawReview = {
  id: 'r1',
  venueId: 'v1',
  userId: 'u1',
  rating: 5,
  text: 'Класне місце',
  checkPhotoUrl: 'https://x/img.jpg',
  isFeatured: false,
  createdAt: '2026-09-08T10:00:00.000Z',
  updatedAt: '2026-09-08T10:00:00.000Z',
  user: { id: 'u1', email: 'a@b.c', roles: ['user'], profile: { firstname: 'Олег', lastname: 'П' } },
}

describe('parseReview', () => {
  it('мапить автора з user.profile', () => {
    const r = parseReview(raw)
    expect(r.author).toEqual({ firstname: 'Олег', lastname: 'П' })
    expect(r.rating).toBe(5)
    expect(r.checkPhotoUrl).toBe('https://x/img.jpg')
  })
  it('user/profile відсутні → author з null-ами', () => {
    const r = parseReview({ ...raw, user: undefined })
    expect(r.author).toEqual({ firstname: null, lastname: null })
  })
})
```

`src/types/__tests__/hangout.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseHangout, type RawHangout } from '@/types/hangout'

const raw: RawHangout = {
  id: 'h1',
  venueId: 'v1',
  userId: 'u1',
  date: '2026-09-10',
  time: '19:30',
  purpose: 'Пошук компанії на дегустацію',
  gender: 'any',
  groupSize: 3,
  payer: 'split',
  desiredBudget: '350',
  status: 'open',
  createdAt: '2026-09-08T10:00:00.000Z',
}

describe('parseHangout', () => {
  it('desiredBudget string → number', () => {
    expect(parseHangout(raw).desiredBudget).toBe(350)
  })
  it('desiredBudget null → null', () => {
    expect(parseHangout({ ...raw, desiredBudget: null }).desiredBudget).toBeNull()
  })
})
```

`src/types/__tests__/favorite.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseFavoriteVenue, type RawFavoriteVenue } from '@/types/favorite'

const raw: RawFavoriteVenue = {
  id: 'v1', name: 'Бар «Стара Пивна»', address: 'м. Київ', ratingAvg: '4.7', mainPhotoUrl: null,
}

describe('parseFavoriteVenue', () => {
  it('ratingAvg string → number', () => {
    const f = parseFavoriteVenue(raw)
    expect(f.ratingAvg).toBe(4.7)
    expect(f.name).toBe('Бар «Стара Пивна»')
  })
  it('ratingAvg null → null', () => {
    expect(parseFavoriteVenue({ ...raw, ratingAvg: null }).ratingAvg).toBeNull()
  })
})
```

`src/lib/utils/__tests__/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatMoney } from '@/lib/utils/format'

describe('formatMoney', () => {
  it('округлює до цілих ₴', () => {
    expect(formatMoney(450)).toBe('450 ₴')
    expect(formatMoney(450.9)).toBe('451 ₴')
  })
  it('null → —', () => {
    expect(formatMoney(null)).toBe('—')
  })
})

describe('formatDate', () => {
  it('uk-формат', () => {
    expect(formatDate('2026-09-08T10:00:00.000Z')).toMatch(/^8 вересня 2026/)
  })
})

describe('formatDateTime', () => {
  it('uk-формат з часом', () => {
    expect(formatDateTime('2026-09-08T10:00:00.000Z')).toMatch(/2026/)
    expect(formatDateTime('2026-09-08T10:00:00.000Z')).toMatch(/\d{2}:\d{2}/)
  })
})
```

- [ ] **Step 2: Запустити — FAIL**

Run: `pnpm test src/types src/lib/utils`
Expected: FAIL (модулів не існує).

- [ ] **Step 3: Реалізація**

`src/types/review.ts`:

```ts
// --- Типи «як з бекенда» (raw) ---
export interface RawReview {
  id: string
  venueId: string
  userId: string
  rating: number
  text: string
  checkPhotoUrl: string | null
  isFeatured: boolean
  createdAt: string
  updatedAt: string
  user?: {
    id: string
    email: string
    roles: string[]
    profile?: { firstname: string | null; lastname: string | null } | null
  } | null
}

// --- Типи після парсингу (для UI) ---
export interface Review {
  id: string
  venueId: string
  rating: number
  text: string
  checkPhotoUrl: string | null
  isFeatured: boolean
  createdAt: string
  updatedAt: string
  author: { firstname: string | null; lastname: string | null }
}

export function parseReview(raw: RawReview): Review {
  return {
    id: raw.id,
    venueId: raw.venueId,
    rating: raw.rating,
    text: raw.text,
    checkPhotoUrl: raw.checkPhotoUrl,
    isFeatured: Boolean(raw.isFeatured),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    author: {
      firstname: raw.user?.profile?.firstname ?? null,
      lastname: raw.user?.profile?.lastname ?? null,
    },
  }
}
```

`src/types/hangout.ts`:

```ts
export type HangoutGender = 'male' | 'female' | 'any'
export type HangoutPayer = 'me' | 'split' | 'them'

// --- Типи «як з бекенда» (raw) ---
export interface RawHangout {
  id: string
  venueId: string
  userId: string
  date: string            // YYYY-MM-DD
  time: string            // HH:mm
  purpose: string
  gender: HangoutGender
  groupSize: number
  payer: HangoutPayer
  desiredBudget: string | null  // числова колонка прибуває рядком
  status: 'open' | 'closed'
  createdAt: string
}

// --- Типи після парсингу (для UI) ---
export interface Hangout {
  id: string
  venueId: string
  date: string
  time: string
  purpose: string
  gender: HangoutGender
  groupSize: number
  payer: HangoutPayer
  desiredBudget: number | null
  status: 'open' | 'closed'
  createdAt: string
}

export function parseHangout(raw: RawHangout): Hangout {
  const budget = raw.desiredBudget === null || raw.desiredBudget === ''
    ? null
    : Number(raw.desiredBudget)
  return {
    id: raw.id,
    venueId: raw.venueId,
    date: raw.date,
    time: raw.time,
    purpose: raw.purpose,
    gender: raw.gender,
    groupSize: raw.groupSize,
    payer: raw.payer,
    desiredBudget: budget !== null && Number.isNaN(budget) ? null : budget,
    status: raw.status,
    createdAt: raw.createdAt,
  }
}
```

`src/types/favorite.ts`:

```ts
// --- Типи «як з бекенда» (raw): проекція GET /me/favorites ---
export interface RawFavoriteVenue {
  id: string
  name: string
  address: string
  ratingAvg: string | null
  mainPhotoUrl: string | null
}

// --- Типи після парсингу (для UI) ---
export interface FavoriteVenue {
  id: string
  name: string
  address: string
  ratingAvg: number | null
  mainPhotoUrl: string | null
}

export function parseFavoriteVenue(raw: RawFavoriteVenue): FavoriteVenue {
  const rating = raw.ratingAvg === null || raw.ratingAvg === '' ? null : Number(raw.ratingAvg)
  return {
    id: raw.id,
    name: raw.name,
    address: raw.address,
    ratingAvg: rating !== null && Number.isNaN(rating) ? null : rating,
    mainPhotoUrl: raw.mainPhotoUrl,
  }
}
```

`src/types/venue.ts` — зробити відносини optional (щоб `GET /venues/:id` без relations проходив типи; `parseVenue` уже толерує `?? []`):

```ts
  // Відносини Є лише у елементах GET /venues (list); GET /venues/:id
  // повертає лише owner+profile — тому всі відносини optional
  photos?: { id: string; venueId: string; url: string; sortOrder: number }[]
  featureAssignments?: { venueId: string; featureId: string; feature: { id: string; code: string; name: string; icon: string | null } }[]
  venueTags?: { venueId: string; tagId: string; tag: { id: string; name: string; slug: string } }[]
  venueTypeAssignments?: { venueId: string; typeId: string; type: { id: string; name: string; slug: string } }[]
```

`src/lib/utils/format.ts`:

```ts
const money = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  maximumFractionDigits: 0,
})

export function formatMoney(v: number | null): string {
  if (v === null || Number.isNaN(v)) return '—'
  return money.format(v)
}

const dateFmt = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('uk-UA', {
  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d)
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : dateTimeFmt.format(d)
}
```

- [ ] **Step 4: Тести + бари + commit**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS (існуючі тести типів venue не ламаються — parseVenue не мінявся).

```bash
git add -A
git commit -m "feat: типи відгуку/пиячка/обраного + парсери, RawVenue relations optional, format-утиліти"
```

---

### Task 8: Zod-схеми (відгук, скарга, «Пиячок»)

**Files:**
- Create: `src/lib/validation/review.ts`
- Create: `src/lib/validation/complaint.ts`
- Create: `src/lib/validation/hangout.ts`
- Test: `src/lib/validation/__tests__/review.test.ts`
- Test: `src/lib/validation/__tests__/complaint.test.ts`
- Test: `src/lib/validation/__tests__/hangout.test.ts`

**Interfaces:**
- Consumes: патерн з `src/lib/validation/auth.ts` (zod-first, `z.infer` для типу форми, `z.string().trim()`).
- Produces (для Tasks 11-13):
  - `reviewFormSchema: z.ZodObject<{ rating: number; text: string }>` + `type ReviewFormValues`.
  - `complaintFormSchema` (venueId/reviewId через refine — рівно один) + `type ComplaintFormValues`.
  - `hangoutFormSchema` (date не в минулому) + `type HangoutFormValues`.

- [ ] **Step 1: Failing-тести**

`src/lib/validation/__tests__/review.test.ts`:

```ts
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
```

`src/lib/validation/__tests__/complaint.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { complaintFormSchema } from '@/lib/validation/complaint'

const text = 'c'.repeat(20)

describe('complaintFormSchema', () => {
  it('venueId-варіант валідний', () => {
    expect(complaintFormSchema.safeParse({ venueId: 'uuid-1', reason: 'fraud', text }).success).toBe(true)
  })
  it('reviewId-варіант валідний', () => {
    expect(complaintFormSchema.safeParse({ reviewId: 'uuid-2', reason: 'other', text }).success).toBe(true)
  })
  it('без venueId і reviewId — відхилено', () => {
    expect(complaintFormSchema.safeParse({ reason: 'other', text }).success).toBe(false)
  })
  it('ОДНОЧАСНО venueId і reviewId — відхилено (бекенд вимагає XOR)', () => {
    expect(complaintFormSchema.safeParse({ venueId: 'a', reviewId: 'b', reason: 'other', text }).success).toBe(false)
  })
  it('reason поза enum / text < 20 — відхилено', () => {
    expect(complaintFormSchema.safeParse({ venueId: 'a', reason: 'spam', text }).success).toBe(false)
    expect(complaintFormSchema.safeParse({ venueId: 'a', reason: 'other', text: 'мало символів' }).success).toBe(false)
  })
})
```

`src/lib/validation/__tests__/hangout.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { hangoutFormSchema } from '@/lib/validation/hangout'

const today = () => new Date().toISOString().slice(0, 10)
const base = { date: today(), time: '19:30', purpose: 'Шукаю компанію на дегустацію', gender: 'any', groupSize: 3, payer: 'me' }

describe('hangoutFormSchema', () => {
  it('валідний пиячок', () => {
    expect(hangoutFormSchema.safeParse(base).success).toBe(true)
  })
  it('бажаний бюджет: рядок коерциться в число, опційний', () => {
    expect(hangoutFormSchema.parse({ ...base, desiredBudget: '350' }).desiredBudget).toBe(350)
    expect(hangoutFormSchema.safeParse({ ...base }).success).toBe(true)
  })
  it('desiredBudget 0..100000, поза — відхилено', () => {
    expect(hangoutFormSchema.safeParse({ ...base, desiredBudget: 100001 }).success).toBe(false)
    expect(hangoutFormSchema.safeParse({ ...base, desiredBudget: -1 }).success).toBe(false)
  })
  it('минула дата — відхилено', () => {
    const past = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    expect(hangoutFormSchema.safeParse({ ...base, date: past }).success).toBe(false)
  })
  it('дата/час формату: YYYY-MM-DD / HH:mm', () => {
    expect(hangoutFormSchema.safeParse({ ...base, date: '08.09.2026' }).success).toBe(false)
    expect(hangoutFormSchema.safeParse({ ...base, time: '25:00' }).success).toBe(false)
  })
  it('purpose 10..500, groupSize int 1..20', () => {
    expect(hangoutFormSchema.safeParse({ ...base, purpose: 'коротко' }).success).toBe(false)
    expect(hangoutFormSchema.safeParse({ ...base, groupSize: 21 }).success).toBe(false)
    expect(hangoutFormSchema.safeParse({ ...base, groupSize: 2.5 }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Запустити — FAIL**

Run: `pnpm test src/lib/validation`
Expected: FAIL (схем не існує).

- [ ] **Step 3: Реалізація**

`src/lib/validation/review.ts`:

```ts
import { z } from 'zod'

export const reviewFormSchema = z.object({
  rating: z.number({ message: 'Оцініть заклад' }).int().min(1, 'Мінімум 1').max(5, 'Максимум 5'),
  text: z.string().trim().min(10, 'Мінімум 10 символів').max(2000, 'Максимум 2000 символів'),
})

export type ReviewFormValues = z.infer<typeof reviewFormSchema>
```

`src/lib/validation/complaint.ts`:

```ts
import { z } from 'zod'

export const COMPLAINT_REASONS = [
  { value: 'fake_promo', label: 'Фейкова акція' },
  { value: 'fraud', label: 'Шахрайство' },
  { value: 'other', label: 'Інше' },
] as const

export const complaintFormSchema = z
  .object({
    venueId: z.string().uuid().optional(),
    reviewId: z.string().uuid().optional(),
    reason: z.enum(['fake_promo', 'fraud', 'other']),
    text: z.string().trim().min(20, 'Опишіть проблему детальніше (мінімум 20 символів)'),
  })
  .refine((v) => Boolean(v.venueId) !== Boolean(v.reviewId), {
    message: 'Скарга має бути або на заклад, або на відгук',
    path: ['venueId'],
  })

export type ComplaintFormValues = z.infer<typeof complaintFormSchema>
```

`src/lib/validation/hangout.ts`:

```ts
import { z } from 'zod'

const dateRe = /^\d{4}-\d{2}-\d{2}$/
const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/

export const HANGOUT_GENDERS = [
  { value: 'any', label: 'Будь-хто' },
  { value: 'male', label: 'Чоловіки' },
  { value: 'female', label: 'Жінки' },
] as const

export const HANGOUT_PAYERS = [
  { value: 'me', label: 'Я плачу' },
  { value: 'split', label: 'Ділити порівну' },
  { value: 'them', label: 'Платить компанія' },
] as const

export const hangoutFormSchema = z
  .object({
    date: z.string().regex(dateRe, 'Формат дати: YYYY-MM-DD').refine(
      (d) => d >= new Date().toISOString().slice(0, 10),
      'Дата не може бути в минулому',
    ),
    time: z.string().regex(timeRe, 'Формат часу: HH:mm'),
    purpose: z.string().trim().min(10, 'Мінімум 10 символів').max(500, 'Максимум 500 символів'),
    gender: z.enum(['any', 'male', 'female']),
    groupSize: z.coerce.number().int('Ціле число').min(1, 'Мінімум 1').max(20, 'Максимум 20'),
    payer: z.enum(['me', 'split', 'them']),
    desiredBudget: z.coerce.number().min(0).max(100000, 'Максимум 100000').optional(),
  })

export type HangoutFormValues = z.infer<typeof hangoutFormSchema>
```

- [ ] **Step 4: Тести + бари + commit**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS.

```bash
git add -A
git commit -m "feat: zod-схеми відгуку, скарги, пиячка з граничними тестами"
```

---

### Task 9: Сторінка закладу `/venues/[id]`

**Бекенд-контракт (факти):**
- `GET /venues/:id` — авторитетне джерело з 404-семантикою (не-approved → 404), але повертає ЛИШЕ `owner` + `owner.profile` — БЕЗ photos/features/tags/types.
- Повні відносини — лише в елементах `GET /venues` (list). Окремого `GET /me/venues/:id` немає.
- Обхід: `GET /venues?q=<encodeURIComponent(name)>&limit=100` → знайти елемент з `id === detail.id`. Якщо не знайшли (заклад поза першими 100 результатів пошуку за назвою) — толерантна деградація: рендеримо те, що є (без галереї/тегів/фіч).
- `POST /venues/:id/view` — публічний, 201 `{data:{recorded}}`, тіло `{sessionId}` (≤64 символів; дедуп 30 хв по sessionId).

**Files:**
- Modify: `src/app/venues/[id]/page.tsx` (замінити стаб)
- Modify: `src/app/venues/[id]/loading.tsx` (Skeleton)
- Modify: `src/app/venues/[id]/not-found.tsx` (текст, не стаб)
- Create: `src/components/features/venues/photo-gallery.tsx`
- Create: `src/components/features/venues/working-hours.tsx`
- Create: `src/components/features/venues/view-recorder.tsx`
- Create: `src/lib/venues/route-url.ts`
- Test: `src/components/features/venues/__tests__/working-hours.test.tsx`
- Test: `src/components/features/venues/__tests__/view-recorder.test.tsx`
- Test: `src/lib/venues/__tests__/route-url.test.ts`

**Interfaces:**
- Consumes: `Venue`, `parseVenue` (Task 7 optional-relations), `formatMoney` (Task 7), `serverFetch`/`serverFetchList`, `RatingStars`, `Skeleton`, `Button`, `notFound()`, `redirect()` НЕ потрібен.
- Produces (для Tasks 10-13): серверна сторінка з sections — `{gallery, info, description}`; точка монтування `<FavoriteButton venueId>` (Task 10), `ReviewList` + `ReviewForm` (Task 11), `ComplaintButton` (Task 12), `HangoutButton` (Task 13), `RouteButton`. `routeUrl({latitude, longitude, address, name}): string`.
- УВАГА: `params` і `searchParams` у Next 16 — Promise, await.

- [ ] **Step 1: Failing-тести**

`src/lib/venues/__tests__/route-url.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { routeUrl } from '@/lib/venues/route-url'

describe('routeUrl', () => {
  it('є координати → Google Maps dir-URL з lat,lng', () => {
    const url = routeUrl({ latitude: 50.4477, longitude: 30.5227, address: 'Хрещатик 1', name: 'Бар' })
    expect(url).toBe('https://www.google.com/maps/dir/?api=1&destination=50.4477,30.5227')
  })
  it('без координат → search за «назва, адреса» (encodeURIComponent)', () => {
    const url = routeUrl({ latitude: null, longitude: null, address: 'Хрещатик 1', name: 'Бар «П»' })
    expect(url).toBe(
      'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Бар «П», Хрещатик 1'),
    )
  })
})
```

`src/components/features/venues/__tests__/view-recorder.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ViewRecorder } from '@/components/features/venues/view-recorder'

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
  sessionStorage.clear()
})

describe('ViewRecorder', () => {
  it('маунт → один POST /venues/:id/view з sessionId з localStorage', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { recorded: true } }), {
      status: 201, headers: { 'content-type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ViewRecorder venueId="v1" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/venues/v1/view')
    const body = JSON.parse(init.body)
    expect(typeof body.sessionId).toBe('string')
    expect(body.sessionId.length).toBeGreaterThan(0)
    expect(body.sessionId.length).toBeLessThanOrEqual(64)
  })
  it('StrictMode-подвійний ефект → все одно один запит (guard)', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ViewRecorder venueId="v1" />)
    render(<ViewRecorder venueId="v1" />) // другий рендер — не дублює
    await new Promise((r) => setTimeout(r, 10))
    expect(fetchMock).toHaveBeenCalledOnce()
  })
  it('помилка мережі → тихо (fire-and-forget, без error boundary)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network') }))
    render(<ViewRecorder venueId="v1" />)
    await new Promise((r) => setTimeout(r, 10))
    expect(screen.queryByText(/Помилка/i)).not.toBeInTheDocument()
  })
})
```

`src/components/features/venues/__tests__/working-hours.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WorkingHours } from '@/components/features/venues/working-hours'

describe('WorkingHours', () => {
  it('мапить uk-мітки днів', () => {
    render(<WorkingHours hours={{ mon: '10:00-22:00', sat: '11:00-23:00' }} />)
    expect(screen.getByText('Понеділок')).toBeInTheDocument()
    expect(screen.getByText('Субота')).toBeInTheDocument()
    expect(screen.getByText('10:00-22:00')).toBeInTheDocument()
  })
  it('невідомий ключ дня → показує ключ як є (fallback)', () => {
    render(<WorkingHours hours={{ weird: '10:00-22:00' }} />)
    expect(screen.getByText('weird')).toBeInTheDocument()
  })
  it('порожні години → не рендериться', () => {
    const { container } = render(<WorkingHours hours={{}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Запустити — FAIL**

Run: `pnpm test src/lib/venues src/components/features/venues`
Expected: FAIL (файлів не існує).

- [ ] **Step 3: route-url + компоненти**

`src/lib/venues/route-url.ts`:

```ts
// Зовнішній маршрут у Google Maps. Окремий модуль — легкий юніт-тест і єдине
// місце зміни, якщо знадобиться інший провайдер карт.
export function routeUrl(venue: {
  latitude: number | null
  longitude: number | null
  address: string
  name: string
}): string {
  if (venue.latitude !== null && venue.longitude !== null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.name}, ${venue.address}`)}`
}
```

`src/components/features/venues/view-recorder.tsx`:

```tsx
'use client'

import { useEffect, useRef } from 'react'

// Лічильник переглядів: публічний POST /venues/:id/view (BFF-проксі).
// Fire-and-forget: помилки ігноруємо — лічильник не критичний для UI.
const KEY = 'view-session-id'

export function ViewRecorder({ venueId }: { venueId: string }) {
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true

    let sessionId: string
    try {
      sessionId = localStorage.getItem(KEY) ?? ''
    } catch {
      sessionId = ''
    }
    if (!sessionId) {
      sessionId = (crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random()}`).slice(0, 64)
      try {
        localStorage.setItem(KEY, sessionId)
      } catch {
        // приватний режим — ок, сесія ефемерна
      }
    }

    fetch(`/api/v1/venues/${venueId}/view`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId.slice(0, 64) }),
    }).catch(() => {})
  }, [venueId])

  return null
}
```

`src/components/features/venues/working-hours.tsx`:

```tsx
const DAY_LABELS: Record<string, string> = {
  mon: 'Понеділок',
  tue: 'Вівторок',
  wed: 'Середа',
  thu: 'Четвер',
  fri: 'П’ятниця',   // U+2019 — типографський апостроф, уникає \'-екранування
  sat: 'Субота',
  sun: 'Неділя',
}

export function WorkingHours({ hours }: { hours: Record<string, string> }) {
  const entries = Object.entries(hours ?? {})
  if (entries.length === 0) return null
  return (
    <dl className="space-y-1 text-sm">
      {entries.map(([day, value]) => (
        <div key={day} className="flex justify-between gap-4">
          <dt className="text-stone-500">{DAY_LABELS[day] ?? day}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
```

(примітка: `fri` використовує U+2019 — типографський апостроф; це водночас коректна українська типографіка і спосіб уникнути `\'`-екранування. У JSX-тексті сторінки використано `&apos;` — там розмітка, не рядок.)

`src/components/features/venues/photo-gallery.tsx`:

```tsx
import type { VenuePhoto } from '@/types/venue'

// Галерея закладу: головне фото + решта. Фото URL — абсолютні з бекенда
// (mainPhotoUrl/photos[].url); порожній список → не рендеримо.
export function PhotoGallery({ mainPhotoUrl, photos }: { mainPhotoUrl: string | null; photos: VenuePhoto[] }) {
  const urls = [mainPhotoUrl, ...photos.map((p) => p.url)].filter((u): u is string => Boolean(u))
  if (urls.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl bg-stone-100 text-stone-400">
        Немає фото
      </div>
    )
  }
  const [first, ...rest] = urls
  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- зовнішні URL з бекенда, не оптимізуємо */}
      <img src={first} alt="" className="h-64 w-full rounded-xl object-cover" />
      {rest.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {rest.slice(0, 8).map((url, i) => (
            /* eslint-disable-next-line @next/next/no-img-element -- зовнішні URL з бекенда */
            <img key={url + i} src={url} alt="" className="h-20 w-full rounded-lg object-cover" />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Сторінка + loading + not-found**

`src/app/venues/[id]/page.tsx` (замінити стаб повністю):

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RatingStars } from '@/components/ui/rating-stars'
import { PhotoGallery } from '@/components/features/venues/photo-gallery'
import { RouteButton } from '@/components/features/venues/route-button'
import { ViewRecorder } from '@/components/features/venues/view-recorder'
import { WorkingHours } from '@/components/features/venues/working-hours'
import { serverFetch, serverFetchList } from '@/lib/api/server-client'
import { formatMoney } from '@/lib/utils/format'
import { parseVenue, type RawVenue } from '@/types/venue'

interface Props {
  params: Promise<{ id: string }>
}

async function getVenue(id: string) {
  // Авторитетне джерело з 404-семантикою (не-approved → 404 на бекенді)
  const detail = await serverFetch<RawVenue>(`/venues/${id}`, { revalidate: 60 }).catch(() => null)
  if (!detail) return null

  // GET /venues/:id не повертає photos/tags/types/features (лише owner) —
  // збагачуємо через list-пошук за назвою; деградація тиха, якщо не знайшли
  let relations: RawVenue | null = null
  try {
    const list = await serverFetchList<RawVenue>(
      `/venues?q=${encodeURIComponent(detail.name)}&limit=100`,
      { revalidate: 60 },
    )
    relations = list.find((v) => v.id === detail.id) ?? null
  } catch {
    relations = null
  }

  return parseVenue(relations ?? detail)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const venue = await getVenue(id)
  return { title: venue ? `${venue.name} — Пиячок` : 'Заклад — Пиячок' }
}

export default async function VenuePage({ params }: Props) {
  const { id } = await params
  const venue = await getVenue(id)
  if (!venue) notFound()

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8">
      <ViewRecorder venueId={venue.id} />

      <PhotoGallery mainPhotoUrl={venue.mainPhotoUrl} photos={venue.photos} />

      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{venue.name}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-stone-500">
          <RatingStars value={venue.ratingAvg} />
          {venue.ratingCount > 0 && <span>{venue.ratingCount} відгуків</span>}
          <span aria-hidden>·</span>
          <span>Середній чек: {formatMoney(venue.averageCheck)}</span>
        </div>
        <p className="text-stone-600">{venue.address}</p>
        {venue.types.length > 0 && (
          <p className="text-sm text-stone-500">
            {venue.types.map((t) => t.name).join(' · ')}
          </p>
        )}
      </header>

      <div className="flex flex-wrap gap-3">
        <RouteButton venue={venue} />
        {/* Точка монтування: FavoriteButton (Task 10), ComplaintButton (Task 12), HangoutButton (Task 13) */}
      </div>

      {venue.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {venue.tags.map((tag) => (
            <Link
              key={tag.id}
              href={`/venues?tag=${tag.slug}`}
              className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600 hover:bg-stone-200"
            >
              #{tag.name}
            </Link>
          ))}
        </div>
      )}

      {venue.features.length > 0 && (
        <section aria-label="Особливості" className="flex flex-wrap gap-2">
          {venue.features.map((f) => (
            <span key={f.id} className="rounded-lg border border-stone-200 px-3 py-1 text-xs">
              {f.icon ? `${f.icon} ` : ''}{f.name}
            </span>
          ))}
        </section>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        {Object.keys(venue.workingHours).length > 0 && (
          <section aria-label="Години роботи">
            <h2 className="mb-2 font-semibold">Години роботи</h2>
            <WorkingHours hours={venue.workingHours} />
          </section>
        )}

        <section aria-label="Контакти">
          <h2 className="mb-2 font-semibold">Контакти</h2>
          <ul className="space-y-1 text-sm">
            {venue.contacts.phone && <li><a className="text-brand-600 hover:underline" href={`tel:${venue.contacts.phone}`}>{venue.contacts.phone}</a></li>}
            {venue.contacts.instagram && <li><a className="text-brand-600 hover:underline" href={venue.contacts.instagram} target="_blank" rel="noopener noreferrer">Instagram</a></li>}
            {venue.contacts.facebook && <li><a className="text-brand-600 hover:underline" href={venue.contacts.facebook} target="_blank" rel="noopener noreferrer">Facebook</a></li>}
            {venue.contacts.website && <li><a className="text-brand-600 hover:underline" href={venue.contacts.website} target="_blank" rel="noopener noreferrer">Сайт</a></li>}
            {!venue.contacts.phone && !venue.contacts.instagram && !venue.contacts.facebook && !venue.contacts.website && <li className="text-stone-400">Не вказано</li>}
          </ul>
        </section>
      </div>

      {venue.description && (
        <section aria-label="Опис">
          <h2 className="mb-2 font-semibold">Про заклад</h2>
          <p className="whitespace-pre-line text-stone-700">{venue.description}</p>
        </section>
      )}

      {/* Точка монтування: ReviewList + ReviewForm (Task 11) */}
    </div>
  )
}
```

`src/components/features/venues/route-button.tsx`:

```tsx
import { routeUrl } from '@/lib/venues/route-url'
import type { Venue } from '@/types/venue'

export function RouteButton({ venue }: { venue: Pick<Venue, 'latitude' | 'longitude' | 'address' | 'name'> }) {
  return (
    <a
      href={routeUrl(venue)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
    >
      Прокласти маршрут
    </a>
  )
}
```

`src/app/venues/[id]/loading.tsx` (замінити існуючий animate-pulse на Skeleton — резидуал 12):

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8">
      <Skeleton className="h-64 w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-10 w-44 rounded-lg" />
      <div className="grid gap-8 md:grid-cols-2">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <Skeleton className="h-24 w-full" />
    </div>
  )
}
```


`src/app/venues/[id]/not-found.tsx` (замінити мертвий стаб):

```tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-bold">Заклад не знайдено</h1>
      <p className="mt-2 text-stone-500">Заклад не знайдено або видалений.</p>
      <Link className="mt-6 inline-block text-brand-600 hover:underline" href="/">
        До каталогу
      </Link>
    </div>
  )
}
```

- [ ] **Step 5: Спека — відомі обмеження**

Додати в `docs/superpowers/specs/2026-09-08-pyiachok-frontend-design.md` §3 (Відомі обмеження) новий пункт:

```markdown
7. Бекенд не має ендпоінту «один заклад із повними відносинами» (`GET /venues/:id` повертає лише owner+profile, повні photos/tags/types/features — лише в елементах `GET /venues`). Сторінка закладу збагачує дані list-пошуком `?q=<назва>&limit=100` з пошуком за id; якщо елемент не знайдено (наприклад, заклад поза першими 100 результатами), сторінка рендериться без галереї/тегів/фіч — тиха деградація.
```

- [ ] **Step 6: Тести + бари + commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS (сторінка — server-компонент; тести сторінки не потрібні, ручна перевірка в браузері).

```bash
git add -A
git commit -m "feat: сторінка закладу /venues/[id] — галерея, години, контакти, теги/фічі, view-recorder, маршрут"
```

---

### Task 10: Toast + FavoriteButton

**Бекенд-контракт (факти):**
- Обране: `POST /me/favorites/:venueId` → 201 `{data:{venueId}}`; `DELETE /me/favorites/:venueId` → 200; `GET /me/favorites` — проекція (Task 7). Статусу «чи в обраному» НЕ існує — початковий стан визначаємо list-запитом.

**Files:**
- Create: `src/components/ui/toast.tsx`
- Modify: `src/app/layout.tsx` (ToastProvider всередині UserProvider)
- Create: `src/components/features/venues/favorite-button.tsx`
- Modify: `src/app/venues/[id]/page.tsx` (монтування + initialFavorite)
- Test: `src/components/ui/__tests__/toast.test.tsx`
- Test: `src/components/features/venues/__tests__/favorite-button.test.tsx`

**Interfaces:**
- Consumes: `useUser` (UserProvider), `api()` (client.ts), `Modal` не потрібен, `Button`.
- Produces: `ToastProvider` (проп `children`), `useToast(): { toast: (message: string, tone?: 'success' | 'error') => void }`; `FavoriteButton({ venueId, initialFavorite })` — 'use client', гостю — Link на логін.

- [ ] **Step 1: Failing-тести**

`src/components/ui/__tests__/toast.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast } from '@/components/ui/toast'

function Trigger() {
  const { toast } = useToast()
  return (
    <button onClick={() => toast('Додано до обраного', 'success')}>
      Показати
    </button>
  )
}

describe('ToastProvider', () => {
  it('toast() → повідомлення в aria-live region', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Показати' }))
    expect(screen.getByRole('status')).toHaveTextContent('Додано до обраного')
  })
  it('авто-зникнення через 4 с', async () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Показати' }))
    expect(screen.getByRole('status')).toHaveTextContent('Додано до обраного')
    vi.advanceTimersByTime(4500)
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    vi.useRealTimers()
  })
})
```

`src/components/features/venues/__tests__/favorite-button.test.tsx`:

```tsx
import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { FavoriteButton } from '@/components/features/venues/favorite-button'

afterEach(() => vi.unstubAllGlobals())

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}))

function renderWithProviders(ui: ReactNode, user: { id: string } | null) {
  return render(
    <UserProvider initialUser={user as never}>
      <ToastProvider>{ui}</ToastProvider>
    </UserProvider>,
  )
}

describe('FavoriteButton', () => {
  it('гість → Link на /auth/login?next=/venues/v1', () => {
    renderWithProviders(<FavoriteButton venueId="v1" initialFavorite={false} />, null)
    const link = screen.getByRole('link', { name: /обране/i })
    expect(link).toHaveAttribute('href', '/auth/login?next=/venues/v1')
  })

  it('клік «додати» → оптимістично ♥, POST успіх → лишається', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { venueId: 'v1' } }), {
      status: 201, headers: { 'content-type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<FavoriteButton venueId="v1" initialFavorite={false} />, { id: 'u1' })
    fireEvent.click(screen.getByRole('button', { name: /додати до обраного/i }))
    // оптимістичний стан одразу
    expect(screen.getByRole('button', { name: /в обраному/i })).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/me/favorites/v1')
    // і лишається після відповіді
    expect(screen.getByRole('button', { name: /в обраному/i })).toBeInTheDocument()
  })

  it('POST 500 → відкат + toast помилки', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Internal Server Error', { status: 500 })))
    renderWithProviders(<FavoriteButton venueId="v1" initialFavorite={false} />, { id: 'u1' })
    fireEvent.click(screen.getByRole('button', { name: /додати до обраного/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/не вдалося/i))
    expect(screen.getByRole('button', { name: /додати до обраного/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Запустити — FAIL**

Run: `pnpm test src/components/ui/__tests__/toast.test.tsx src/components/features/venues/__tests__/favorite-button.test.tsx`
Expected: FAIL (модулів немає).

- [ ] **Step 3: ToastProvider**

`src/components/ui/toast.tsx`:

```tsx
'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

interface ToastItem { id: number; message: string; tone: 'success' | 'error' }

interface ToastApi {
  toast: (message: string, tone?: 'success' | 'error') => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const toast = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    const id = nextId.current++
    setItems((prev) => [...prev, { id, message, tone }])
    // авто-приховування: таймер на кожен toast окремо
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const api = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* aria-live: скрін-рідери оголошують появу повідомлень */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`rounded-lg px-4 py-2 text-sm text-white shadow-lg ${
              t.tone === 'error' ? 'bg-red-600' : 'bg-stone-800'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast має використовуватись всередині ToastProvider')
  return ctx
}
```

`src/app/layout.tsx` — обгорнути дерево всередині UserProvider:

```tsx
<UserProvider initialUser={user}>
  <ToastProvider>
    <AppShell>{children}</AppShell>
  </ToastProvider>
</UserProvider>
```

(додати `import { ToastProvider } from '@/components/ui/toast'`.)

- [ ] **Step 4: FavoriteButton**

`src/components/features/venues/favorite-button.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useUser } from '@/components/providers/user-provider'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'

export function FavoriteButton({ venueId, initialFavorite }: { venueId: string; initialFavorite: boolean }) {
  const { user } = useUser()
  const { toast } = useToast()
  const router = useRouter()
  const [favorite, setFavorite] = useState(initialFavorite)
  const [pending, startTransition] = useTransition()

  if (!user) {
    return (
      <Link
        href={`/auth/login?next=/venues/${venueId}`}
        className="inline-flex items-center rounded-lg border border-stone-300 px-4 py-2 text-sm hover:bg-stone-100"
      >
        ♡ Обране
      </Link>
    )
  }

  async function toggle() {
    const was = favorite
    setFavorite(!was) // оптимістично
    try {
      if (!was) {
        await api(`/me/favorites/${venueId}`, { method: 'POST' })
      } else {
        await api(`/me/favorites/${venueId}`, { method: 'DELETE' })
      }
      startTransition(() => router.refresh())
    } catch {
      setFavorite(was) // відкат
      toast('Не вдалося оновити обране. Спробуйте ще раз.', 'error')
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={favorite}
      className="inline-flex items-center rounded-lg border border-stone-300 px-4 py-2 text-sm hover:bg-stone-100"
    >
      {favorite ? '♥ В обраному' : '♡ Додати до обраного'}
    </button>
  )
}
```

- [ ] **Step 5: Інтеграція в сторінку закладу**

У `src/app/venues/[id]/page.tsx`:

1. Імпорти: `getSessionTokens` з `@/lib/auth/session`, `FavoriteButton`.
2. У `VenuePage` після отримання venue:

```tsx
  // Початковий стан обраного: ендпоінту «чи в обраному» на бекенді немає —
  // визначаємо за list-проекцією /me/favorites
  const tokens = await getSessionTokens()
  let initialFavorite = false
  if (tokens) {
    try {
      const favs = await serverFetchList<{ id: string }>('/me/favorites?limit=100', {
        tokens,
        revalidate: 0,
      })
      initialFavorite = favs.some((f) => f.id === id)
    } catch {
      initialFavorite = false
    }
  }
```

3. У блоці кнопок (замість коментаря «Точка монтування: FavoriteButton …»):

```tsx
        <FavoriteButton venueId={venue.id} initialFavorite={initialFavorite} />
        <RouteButton venue={venue} />
```

(RouteButton вже там — приберіть дублікат, якщо він уже відрендерений у списку кнопок.)

- [ ] **Step 6: Тести + бари + commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS.

```bash
git add -A
git commit -m "feat: ToastProvider + FavoriteButton з оптимістичним оновленням та відкатом"
```

---

### Task 11: Відгуки — список, форма, редагування, видалення

**Бекенд-контракт (факти):**
- `GET /venues/:id/reviews?sort=&page=&limit=` — sort лише `newest|oldest|highest|lowest` (інше → 500 на бекенді; frontend валідує сам), joins user+profile, поля `checkPhotoUrl`, `isFeatured`; стандартна пагінація.
- Створення відгуку — multipart (файл `checkPhoto` опційно), успіх → 201.
- Редагування — `PATCH /reviews/:id` JSON `{rating, text}`; видалення — `DELETE /reviews/:id` → 200 з ПОРОЖНІМ тілом (звідси `apiVoid`).
- `GET /me/reviews` — щоб знайти «мій відгук» на заклад (ендпоінту «мій відгук на заклад X» немає).
- 409 від бекенда: «Ви вже залишили відгук» (другий create).

**Files:**
- Modify: `src/lib/api/parse.ts` (`parseEmpty`)
- Modify: `src/lib/api/client.ts` (`apiVoid`)
- Create: `src/components/ui/textarea.tsx`
- Create: `src/components/features/venues/review-list.tsx`
- Create: `src/components/features/venues/review-form.tsx`
- Modify: `src/app/venues/[id]/page.tsx` (секція відгуків)
- Test: `src/lib/api/__tests__/parse.test.ts` (parseEmpty)
- Test: `src/lib/api/__tests__/client.test.ts` (apiVoid)
- Test: `src/components/features/venues/__tests__/review-form.test.tsx`

**Interfaces:**
- Consumes: `Review`/`parseReview` (Task 7), `reviewFormSchema` (Task 8), `Pagination` + `catalogHref`-патерн (Task 4 — тут свій `hrefFor`), `formatDateTime` (Task 7), `RatingStars`, `useUser`, `useToast` (Task 10), `api()`/`apiVoid()`.
- Produces: `parseEmpty(res: Response): Promise<void>` (кидає ApiError, якщо !res.ok); `apiVoid(path: string, init?: RequestInit): Promise<void>` (401 → redirectToLogin); `Textarea` (`({className, ...props}) => JSX, як Input`); `ReviewList({ venueId, sort, page })` (server) і `ReviewForm({ venueId, myReview })` ('use client').

- [ ] **Step 1: Failing-тести**

Додати в `src/lib/api/__tests__/parse.test.ts`:

```ts
  it('parseEmpty: ok → void, !ok → ApiError', async () => {
    await expect(parseEmpty(new Response(null, { status: 200 }))).resolves.toBeUndefined()
    const res403 = new Response(
      JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Не ваш відгук', details: null } }),
      { status: 403, headers: { 'content-type': 'application/json' } },
    )
    await expect(parseEmpty(res403)).rejects.toMatchObject({ status: 403, message: 'Не ваш відгук' })
  })
```

Додати в `src/lib/api/__tests__/client.test.ts`:

```ts
  it('apiVoid: DELETE 200 порожнє тіло → резолвиться void (без parse JSON)', async () => {
    vi.stubGlobal('window', { location: { pathname: '/venues/v1', assign: vi.fn() } })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })))
    await expect(apiVoid('/reviews/r1', { method: 'DELETE' })).resolves.toBeUndefined()
  })
```

`src/components/features/venues/__tests__/review-form.test.tsx`:

```tsx
import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { ReviewForm } from '@/components/features/venues/review-form'

afterEach(() => vi.unstubAllGlobals())

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

function renderWithProviders(ui: ReactNode, user: { id: string } | null) {
  return render(
    <UserProvider initialUser={user as never}>
      <ToastProvider>{ui}</ToastProvider>
    </UserProvider>,
  )
}

const valid = { rating: 5, text: 'Чудовий заклад' }
const ok201 = () => new Response(JSON.stringify({ data: { id: 'r1' } }), {
  status: 201, headers: { 'content-type': 'application/json' },
})

describe('ReviewForm (створення)', () => {
  it('клік без оцінки → помилка валідації, fetch НЕ викликається', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<ReviewForm venueId="v1" myReview={null} />, { id: 'u1' })
    fireEvent.change(screen.getByLabelText(/Відгук/i), { target: { value: valid.text } })
    fireEvent.click(screen.getByRole('button', { name: /Надіслати відгук/i }))
    expect(screen.getByText('Оцініть заклад')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('файл > 5MB → клієнтська помилка, fetch НЕ викликається', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<ReviewForm venueId="v1" myReview={null} />, { id: 'u1' })
    fireEvent.change(screen.getByLabelText(/Відгук/i), { target: { value: valid.text } })
    fireEvent.click(screen.getByRole('radio', { name: /5/i }))
    const bigFile = new File(['x'.repeat(6 * 1024 * 1024)], 'check.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText(/Фото чеку/i), { target: { files: [bigFile] } })
    fireEvent.click(screen.getByRole('button', { name: /Надіслати відгук/i }))
    expect(await screen.findByText(/не більше 5 МБ/i)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('успіх → multipart POST, router.refresh()', async () => {
    const fetchMock = vi.fn(async () => ok201())
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<ReviewForm venueId="v1" myReview={null} />, { id: 'u1' })
    fireEvent.change(screen.getByLabelText(/Відгук/i), { target: { value: valid.text } })
    fireEvent.click(screen.getByRole('radio', { name: /5/i }))
    fireEvent.click(screen.getByRole('button', { name: /Надіслати відгук/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/venues/v1/reviews')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('409 → показує повідомлення бекенда', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { code: 'CONFLICT', message: 'Ви вже залишили відгук про цей заклад', details: null } }),
      { status: 409, headers: { 'content-type': 'application/json' } },
    )))
    renderWithProviders(<ReviewForm venueId="v1" myReview={null} />, { id: 'u1' })
    fireEvent.change(screen.getByLabelText(/Відгук/i), { target: { value: valid.text } })
    fireEvent.click(screen.getByRole('radio', { name: /5/i }))
    fireEvent.click(screen.getByRole('button', { name: /Надіслати відгук/i }))
    expect(await screen.findByText(/Ви вже залишили відгук/i)).toBeInTheDocument()
  })
})

describe('ReviewForm (редагування/видалення наявного)', () => {
  it('edit-режим: PATCH JSON {rating,text}', async () => {
    const fetchMock = vi.fn(async () => ok201())
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(
      <ReviewForm venueId="v1" myReview={{ id: 'r1', rating: 3, text: 'Було нормально' }} />,
      { id: 'u1' },
    )
    fireEvent.change(screen.getByLabelText(/Відгук/i), { target: { value: 'Стало ще краще' } })
    fireEvent.click(screen.getByRole('button', { name: /Зберегти/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/reviews/r1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ rating: 3, text: 'Стало ще краще' })
  })

  it('видалення → DELETE + router.refresh()', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(
      <ReviewForm venueId="v1" myReview={{ id: 'r1', rating: 3, text: 'x'.repeat(10) }} />,
      { id: 'u1' },
    )
    fireEvent.click(screen.getByRole('button', { name: /Видалити відгук/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/reviews/r1')
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE')
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('гість → посилання на логін', () => {
    renderWithProviders(<ReviewForm venueId="v1" myReview={null} />, null)
    const link = screen.getByRole('link', { name: /Увійдіть/i })
    expect(link).toHaveAttribute('href', '/auth/login?next=/venues/v1')
  })
})
```

- [ ] **Step 2: Запустити — FAIL**

Run: `pnpm test src/lib/api src/components/features/venues/__tests__/review-form.test.tsx`
Expected: FAIL.

- [ ] **Step 3: parseEmpty + apiVoid**

У `src/lib/api/parse.ts` (поруч з parseData) — додати експорт:

```ts
// DELETE (напр. /reviews/:id) відповідає 200 з ПОРОЖНІМ тілом — JSON не парсимо.
// !ok → кидає ApiError (errorFromResponse — приватна функція цього ж модуля).
export async function parseEmpty(res: Response): Promise<void> {
  if (!res.ok) await errorFromResponse(res)
}
```

У `src/lib/api/client.ts`:

```ts
import { ApiError, parseEmpty } from './parse'

export async function apiVoid(path: string, init?: RequestInit): Promise<void> {
  const res = await fetch(`/api/v1${path}`, init)
  if (res.status === 401) {
    redirectToLogin()
    throw new ApiError(401, 'UNAUTHORIZED', 'Сесія завершена')
  }
  await parseEmpty(res)
}
```

(приведіть до фактичної струкри client.ts: якщо `api()` будує запит через спільний helper, `apiVoid` має слідувати тому ж патерну — Authorization з accessToken,credentials same-origin; головна відмінність — parseEmpty замість parseData.)

- [ ] **Step 4: Textarea**

`src/components/ui/textarea.tsx` (за патерном Input):

```tsx
import type { TextareaHTMLAttributes } from 'react'

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`min-h-24 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none ${className}`}
      {...props}
    />
  )
}
```

(якщо Input у `src/components/ui/input.tsx` має інший набір класів/форк-патерн — скопіюйте його, замінивши тег; важлива лише зовнішня поведінка: `<textarea>` що приймає стандартні пропси.)

- [ ] **Step 5: ReviewList**

`src/components/features/venues/review-list.tsx` (server-компонент):

```tsx
import Link from 'next/link'
import { RatingStars } from '@/components/ui/rating-stars'
import { Pagination } from '@/components/ui/pagination'
import { serverFetchList } from '@/lib/api/server-client'
import { formatDateTime } from '@/lib/utils/format'
import { parseReview, type RawReview, type Review } from '@/types/review'

const SORTS = [
  { value: 'newest', label: 'Найновіші' },
  { value: 'oldest', label: 'Найстаріші' },
  { value: 'highest', label: 'Найвищі оцінки' },
  { value: 'lowest', label: 'Найнижчі оцінки' },
] as const

export const REVIEW_LIMIT = 10

export async function ReviewList({ venueId, sort, page }: { venueId: string; sort: string; page: number }) {
  const safeSort = SORTS.some((s) => s.value === sort) ? sort : 'newest'
  const raw = await serverFetchList<RawReview>(
    `/venues/${venueId}/reviews?sort=${safeSort}&page=${page}&limit=${REVIEW_LIMIT}`,
    { revalidate: 0 },
  )
  const reviews: Review[] = raw.data.map(parseReview)
  // meta опціональна за типом serverFetchList — дефолт без неї: одна порожня сторінка
  const totalPages = Math.max(1, Math.ceil((raw.meta?.total ?? 0) / (raw.meta?.limit || REVIEW_LIMIT)))

  return (
    <section aria-label="Відгуки" className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SORTS.map((s) => (
          <Link
            key={s.value}
            href={`/venues/${venueId}?sort=${s.value}${page > 1 ? `&page=${page}` : ''}`}
            aria-current={safeSort === s.value ? 'true' : undefined}
            className={`rounded-full px-3 py-1 text-xs ${
              safeSort === s.value ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {reviews.length === 0 && (
        <p className="rounded-xl bg-stone-50 p-6 text-center text-stone-500">
          Відгуків ще немає — будьте першим!
        </p>
      )}

      <ul className="space-y-4">
        {reviews.map((r) => (
          <li key={r.id} className="rounded-xl border border-stone-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {r.author.firstname || r.author.lastname
                  ? [r.author.firstname, r.author.lastname].filter(Boolean).join(' ')
                  : 'Користувач'}
              </span>
              <span className="text-xs text-stone-400">{formatDateTime(r.createdAt)}</span>
            </div>
            <div className="mt-1"><RatingStars value={r.rating} /></div>
            <p className="mt-2 whitespace-pre-line text-stone-700">{r.text}</p>
            <div className="mt-2 flex items-center gap-3">
              {r.isFeatured && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                  Рекомендований критиком
                </span>
              )}
              {r.checkPhotoUrl && (
                /* eslint-disable-next-line @next/next/no-img-element -- зовнішній URL з бекенда */
                <img src={r.checkPhotoUrl} alt="Фото чеку" className="h-16 rounded-lg" />
              )}
            </div>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} hrefFor={(p) => `/venues/${venueId}?sort=${safeSort}&page=${p}`} />
      )}
    </section>
  )
}
```


- [ ] **Step 6: ReviewForm**

`src/components/features/venues/review-form.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { useUser } from '@/components/providers/user-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { ApiError, api, apiVoid } from '@/lib/api/client'
import { reviewFormSchema } from '@/lib/validation/review'

const MAX_FILE = 5 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

interface MyReview { id: string; rating: number; text: string }

export function ReviewForm({ venueId, myReview }: { venueId: string; myReview: MyReview | null }) {
  const { user } = useUser()
  const { toast } = useToast()
  const router = useRouter()
  const [rating, setRating] = useState(myReview?.rating ?? 0)
  const [text, setText] = useState(myReview?.text ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!user) {
    return (
      <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">
        Щоб залишити відгук,{' '}
        <Link className="text-brand-600 hover:underline" href={`/auth/login?next=/venues/${venueId}`}>
          увійдіть
        </Link>{' '}
        або зареєструйтеся.
      </p>
    )
  }

  async function submit() {
    setError(null)
    const parsed = reviewFormSchema.safeParse({ rating, text })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Перевірте поля')
      return
    }
    const file = fileRef.current?.files?.[0]
    if (file) {
      if (!ALLOWED.includes(file.type)) {
        setError('Фото: лише JPEG, PNG або WebP')
        return
      }
      if (file.size > MAX_FILE) {
        setError('Фото не більше 5 МБ')
        return
      }
    }

    setSaving(true)
    try {
      if (!myReview) {
        const fd = new FormData()
        fd.set('rating', String(parsed.data.rating))
        fd.set('text', parsed.data.text)
        if (file) fd.set('checkPhoto', file)
        // multipart без content-type (браузер ставить boundary сам); ApiError НЕ кидається
        // автоматично — fetch повертає !ok, тіло розбираємо через errMessage
        const res = await fetch(`/api/v1/venues/${venueId}/reviews`, { method: 'POST', body: fd })
        if (!res.ok) throw new ApiError(res.status, 'ERROR', await errMessage(res))
      } else {
        await api(`/reviews/${myReview.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(parsed.data),
        })
      }
      toast(myReview ? 'Відгук оновлено' : 'Дякуємо за відгук!')
      router.refresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Сервіс тимчасово недоступний')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!myReview) return
    if (!window.confirm('Видалити ваш відгук?')) return
    try {
      await apiVoid(`/reviews/${myReview.id}`, { method: 'DELETE' })
      toast('Відгук видалено')
      router.refresh()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Не вдалося видалити відгук', 'error')
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-stone-200 p-4">
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Оцінка</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input
                type="radio"
                name="rating"
                value={n}
                checked={rating === n}
                onChange={() => setRating(n)}
                className="sr-only"
              />
              <span className={`text-2xl ${rating >= n ? 'text-amber-400' : 'text-stone-300'}`} aria-hidden>
                ★
              </span>
              <span className="sr-only">{n}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor="review-text" className="block text-sm font-medium">
        Відгук
      </label>
      <Textarea
        id="review-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Розкажіть про враження (мінімум 10 символів)"
      />

      {!myReview && (
        <div className="text-sm">
          <label htmlFor="review-check" className="block">
            Фото чеку (необов'язково, до 5 МБ)
          </label>
          <input
            ref={fileRef}
            id="review-check"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="mt-1"
          />
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="button" variant="primary" onClick={submit} disabled={saving}>
          {myReview ? 'Зберегти зміни' : 'Надіслати відгук'}
        </Button>
        {myReview && (
          <Button type="button" variant="danger" onClick={remove}>
            Видалити відгук
          </Button>
        )}
      </div>
    </div>
  )
}

// витягнути message з помилкового тіла (може бути не-JSON)
async function errMessage(res: Response): Promise<string> {
  try {
    const body = await res.clone().json()
    return body?.error?.message ?? 'Сервіс тимчасово недоступний'
  } catch {
    return 'Сервіс тимчасово недоступний'
  }
}
```

- [ ] **Step 7: Інтеграція в сторінку**

У `src/app/venues/[id]/page.tsx`:

1. Props: `searchParams?: Promise<{ sort?: string; page?: string }>` (await).
2. В `VenuePage`, після initialFavorite:

```tsx
  const sort = sp?.sort ?? 'newest'
  const page = Math.max(1, Number(sp?.page ?? 1) || 1)

  // мій відгук на цей заклад (ендпоінту «мій відгук на X» немає — шукаємо в /me/reviews)
  let myReview: { id: string; rating: number; text: string } | null = null
  if (tokens) {
    try {
      const mine = await serverFetchList<{ id: string; venueId: string; rating: number; text: string }>(
        '/me/reviews?limit=100',
        { tokens, revalidate: 0 },
      )
      const found = mine.find((r) => r.venueId === id)
      if (found) myReview = { id: found.id, rating: found.rating, text: found.text }
    } catch {
      myReview = null
    }
  }
```

3. Замість коментаря «Точка монтування: ReviewList + ReviewForm»:

```tsx
      <section aria-label="Відгуки" className="space-y-4">
        <h2 className="text-xl font-semibold">Відгуки</h2>
        <ReviewForm venueId={venue.id} myReview={myReview} />
        <ReviewList venueId={venue.id} sort={sort} page={page} />
      </section>
```

(де `sp` — результат `await searchParams`; якщо `searchParams` необов'язковий проп — `const sp = (await searchParams) ?? {}`.)

- [ ] **Step 8: Тести + бари + commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS.

```bash
git add -A
git commit -m "feat: відгуки — список з сортуванням/пагінацією, форма (multipart/редагування/видалення), apiVoid"
```

---

### Task 12: Форма скарги

**Бекенд-контракт (факти):** `POST /complaints` тіло `{venueId? | reviewId?, reason: 'fake_promo'|'fraud'|'other', text ≥ 20}`; venueId XOR reviewId (інакше 422); створення → 201.

**Files:**
- Create: `src/components/features/complaints/complaint-button.tsx` ('use client': кнопка + Modal + форма; використовується і на сторінці закладу, і в ReviewList біля чужих відгуків)
- Modify: `src/app/venues/[id]/page.tsx` (кнопка скарги на заклад)
- Test: `src/components/features/complaints/__tests__/complaint-button.test.tsx`

**Interfaces:**
- Consumes: `complaintFormSchema` + `COMPLAINT_REASONS` (Task 8), `Modal` (Task 2 — Escape/focus-trap уже є), `Textarea` (Task 11), `Button`, `api()`, `useUser`, `useToast` (Task 10).
- Produces: `ComplaintButton({ target: { venueId?: string; reviewId?: string }, label?: string })` — самодостатній клієнтський компонент.

- [ ] **Step 1: Failing-тест**

`src/components/features/complaints/__tests__/complaint-button.test.tsx`:

```tsx
import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { ComplaintButton } from '@/components/features/complaints/complaint-button'

afterEach(() => vi.unstubAllGlobals())

function renderWithProviders(ui: ReactNode, user: { id: string } | null) {
  return render(
    <UserProvider initialUser={user as never}>
      <ToastProvider>{ui}</ToastProvider>
    </UserProvider>,
  )
}

const ok201 = () => new Response(JSON.stringify({ data: { id: 'c1' } }), {
  status: 201, headers: { 'content-type': 'application/json' },
})

describe('ComplaintButton', () => {
  it('гість → посилання на логін (без модалки)', () => {
    renderWithProviders(<ComplaintButton target={{ venueId: 'v1' }} />, null)
    expect(screen.getByRole('link', { name: /Скарга/i })).toHaveAttribute('href', '/auth/login?next=/venues/v1')
  })

  it('відкриття модалки, валідація тексту < 20 → помилка, без запиту', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<ComplaintButton target={{ venueId: 'v1' }} />, { id: 'u1' })
    fireEvent.click(screen.getByRole('button', { name: /Скарга/i }))
    fireEvent.change(screen.getByLabelText(/Опис/i), { target: { value: 'коротко' } })
    fireEvent.click(screen.getByRole('button', { name: /Надіслати скаргу/i }))
    expect(await screen.findByText(/мінімум 20/i)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('успіх → POST /complaints з venueId, toast, модалка закривається', async () => {
    const fetchMock = vi.fn(async () => ok201())
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<ComplaintButton target={{ venueId: 'v1' }} />, { id: 'u1' })
    fireEvent.click(screen.getByRole('button', { name: /Скарга/i }))
    fireEvent.change(screen.getByLabelText(/Опис/i), { target: { value: 'тут недостатньо символів' } })
    fireEvent.click(screen.getByRole('button', { name: /Надіслати скаргу/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/complaints')
    expect(JSON.parse(init.body)).toMatchObject({ venueId: 'v1', reason: 'other', text: 'тут недостатньо символів' })
  })

  it('reason вибирається і потрапляє в тіло', async () => {
    const fetchMock = vi.fn(async () => ok201())
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<ComplaintButton target={{ reviewId: 'r1' }} label="Скарга на відгук" />, { id: 'u1' })
    fireEvent.click(screen.getByRole('button', { name: /Скарга на відгук/i }))
    fireEvent.change(screen.getByLabelText(/Причина/i), { target: { value: 'fraud' } })
    fireEvent.change(screen.getByLabelText(/Опис/i), { target: { value: 'тут недостатньо символів' } })
    fireEvent.click(screen.getByRole('button', { name: /Надіслати скаргу/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ reviewId: 'r1', reason: 'fraud' })
  })
})
```

- [ ] **Step 2: Запустити — FAIL**

Run: `pnpm test src/components/features/complaints`
Expected: FAIL.

- [ ] **Step 3: Реалізація**

`src/components/features/complaints/complaint-button.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useUser } from '@/components/providers/user-provider'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { ApiError, api } from '@/lib/api/client'
import { COMPLAINT_REASONS, complaintFormSchema } from '@/lib/validation/complaint'

interface Props {
  target: { venueId?: string; reviewId?: string }
  label?: string
  loginNext: string
}

export function ComplaintButton({ target, label = 'Скарга', loginNext }: Props) {
  const { user } = useUser()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<'fake_promo' | 'fraud' | 'other'>('other')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  if (!user) {
    return (
      <Link
        href={`/auth/login?next=${encodeURIComponent(loginNext)}`}
        className="inline-flex items-center rounded-lg border border-stone-300 px-4 py-2 text-sm hover:bg-stone-100"
      >
        ⚑ {label}
      </Link>
    )
  }

  async function submit() {
    setError(null)
    const parsed = complaintFormSchema.safeParse({ ...target, reason, text })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Перевірте поля')
      return
    }
    setSending(true)
    try {
      await api('/complaints', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      toast('Скаргу надіслано. Модератори розглянуть її.')
      setOpen(false)
      setText('')
      setReason('other')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Сервіс тимчасово недоступний')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        ⚑ {label}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Подати скаргу">
        <div className="space-y-3">
          <div className="text-sm">
            <label htmlFor="complaint-reason" className="mb-1 block">
              Причина
            </label>
            <select
              id="complaint-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as typeof reason)}
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
            >
              {COMPLAINT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="text-sm">
            <label htmlFor="complaint-text" className="mb-1 block">
              Опис (мінімум 20 символів)
            </label>
            <Textarea
              id="complaint-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Опишіть проблему детально"
            />
          </div>

          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Скасувати
            </Button>
            <Button type="button" variant="primary" onClick={submit} disabled={sending}>
              Надіслати скаргу
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
```


- [ ] **Step 4: Інтеграція в сторінку**

У `src/app/venues/[id]/page.tsx`, у блоці кнопок поруч з FavoriteButton:

```tsx
        <ComplaintButton target={{ venueId: venue.id }} loginNext={`/venues/${venue.id}`} />
```

- [ ] **Step 5: Тести + бари + commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS.

```bash
git add -A
git commit -m "feat: форма скарги (Modal) на заклад, venueId XOR reviewId, причина+опис"
```

---

### Task 13: «Пиячок» — форма пошуку компанії (безпека + модалка)

**Спека (§5):** кнопка «Знайти пиячку» на сторінці закладу відкриває модалку; ПЕРШИМ кроком — попередження про безпеку (зустрічі з незнайомцями: публічні місця, не пересилати гроші, повідомити близьких). Підтвердження зберігається в localStorage — вдругерть форма відкривається одразу (прапорець «більше не показувати»).

**Бекенд-контракт (факти):** `POST /venues/:venueId/hangouts` JSON `{date YYYY-MM-DD (не в минулому), time HH:mm, purpose 10-500, gender male|female|any, groupSize int 1-20, payer me|split|them, desiredBudget? 0-100000}` → 201.

**Files:**
- Create: `src/components/features/hangouts/hangout-button.tsx`
- Modify: `src/app/venues/[id]/page.tsx` (кнопка)
- Test: `src/components/features/hangouts/__tests__/hangout-button.test.tsx`

**Interfaces:**
- Consumes: `hangoutFormSchema`, `HANGOUT_GENDERS`, `HANGOUT_PAYERS` (Task 8), `Modal` (Task 2), `Textarea` (Task 11), `Button`, `api()`, `useUser`, `useToast` (Task 10).
- Produces: `HangoutButton({ venueId, loginNext })` — 'use client', двокрокова модалка (safety → form).

- [ ] **Step 1: Failing-тест**

`src/components/features/hangouts/__tests__/hangout-button.test.tsx`:

```tsx
import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { HangoutButton } from '@/components/features/hangouts/hangout-button'

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
})
beforeEach(() => window.localStorage.clear())

function renderWithProviders(ui: ReactNode, user: { id: string } | null) {
  return render(
    <UserProvider initialUser={user as never}>
      <ToastProvider>{ui}</ToastProvider>
    </UserProvider>,
  )
}

const today = () => new Date().toISOString().slice(0, 10)
const ok201 = () => new Response(JSON.stringify({ data: { id: 'h1' } }), {
  status: 201, headers: { 'content-type': 'application/json' },
})

function fillForm() {
  fireEvent.change(screen.getByLabelText(/Дата/i), { target: { value: today() } })
  fireEvent.change(screen.getByLabelText(/Час/i), { target: { value: '19:30' } })
  fireEvent.change(screen.getByLabelText(/Мета/i), { target: { value: 'Шукаю компанію на дегустацію' } })
}

describe('HangoutButton', () => {
  it('гість → посилання на логін', () => {
    renderWithProviders(<HangoutButton venueId="v1" loginNext="/venues/v1" />, null)
    expect(screen.getByRole('link', { name: /пиячку/i })).toHaveAttribute('href', '/auth/login?next=/venues/v1')
  })

  it('перше відкриття → попередження про безпеку; підтвердження → форма; прапор у localStorage', async () => {
    renderWithProviders(<HangoutButton venueId="v1" loginNext="/venues/v1" />, { id: 'u1' })
    fireEvent.click(screen.getByRole('button', { name: /пиячку/i }))
    expect(screen.getByText(/безпек/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Зрозуміло, продовжити/i }))
    expect(screen.getByLabelText(/Мета/i)).toBeInTheDocument()
    expect(window.localStorage.getItem('hangout-safety-ack')).toBe('1')
  })

  it('повторне відкриття (прапор збережено) → форма одразу', () => {
    window.localStorage.setItem('hangout-safety-ack', '1')
    renderWithProviders(<HangoutButton venueId="v1" loginNext="/venues/v1" />, { id: 'u1' })
    fireEvent.click(screen.getByRole('button', { name: /пиячку/i }))
    expect(screen.getByLabelText(/Мета/i)).toBeInTheDocument()
    expect(screen.queryByText(/попередженн/i)).not.toBeInTheDocument()
  })

  it('минула дата → помилка валідації, без запиту', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    window.localStorage.setItem('hangout-safety-ack', '1')
    renderWithProviders(<HangoutButton venueId="v1" loginNext="/venues/v1" />, { id: 'u1' })
    fireEvent.click(screen.getByRole('button', { name: /пиячку/i }))
    const past = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    fireEvent.change(screen.getByLabelText(/Дата/i), { target: { value: past } })
    fireEvent.change(screen.getByLabelText(/Час/i), { target: { value: '19:30' } })
    fireEvent.change(screen.getByLabelText(/Мета/i), { target: { value: 'Шукаю компанію на дегустацію' } })
    fireEvent.click(screen.getByRole('button', { name: /Створити/i }))
    expect(await screen.findByText(/минулому/i)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('успіх → POST /venues/v1/hangouts з валідним тілом, toast, закриття', async () => {
    const fetchMock = vi.fn(async () => ok201())
    vi.stubGlobal('fetch', fetchMock)
    window.localStorage.setItem('hangout-safety-ack', '1')
    renderWithProviders(<HangoutButton venueId="v1" loginNext="/venues/v1" />, { id: 'u1' })
    fireEvent.click(screen.getByRole('button', { name: /пиячку/i }))
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: /Створити/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/venues/v1/hangouts')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toMatchObject({
      date: today(), time: '19:30', purpose: 'Шукаю компанію на дегустацію',
      gender: 'any', groupSize: 2, payer: 'me',
    })
  })
})
```

- [ ] **Step 2: Запустити — FAIL**

Run: `pnpm test src/components/features/hangouts`
Expected: FAIL.

- [ ] **Step 3: Реалізація**

`src/components/features/hangouts/hangout-button.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useUser } from '@/components/providers/user-provider'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { ApiError, api } from '@/lib/api/client'
import { HANGOUT_GENDERS, HANGOUT_PAYERS, hangoutFormSchema } from '@/lib/validation/hangout'

const ACK_KEY = 'hangout-safety-ack'

export function HangoutButton({ venueId, loginNext }: { venueId: string; loginNext: string }) {
  const { user } = useUser()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [ack, setAck] = useState(() => {
    try {
      return localStorage.getItem(ACK_KEY) === '1'
    } catch {
      return false
    }
  })

  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [purpose, setPurpose] = useState('')
  const [gender, setGender] = useState<'any' | 'male' | 'female'>('any')
  const [groupSize, setGroupSize] = useState('2')
  const [payer, setPayer] = useState<'me' | 'split' | 'them'>('me')
  const [desiredBudget, setDesiredBudget] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  if (!user) {
    return (
      <Link
        href={`/auth/login?next=${encodeURIComponent(loginNext)}`}
        className="inline-flex items-center rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
      >
        🍻 Знайти пиячку
      </Link>
    )
  }

  function acknowledge() {
    try {
      localStorage.setItem(ACK_KEY, '1')
    } catch {
      // приватний режим — попередження показуватиметься щоразу, це ок
    }
    setAck(true)
  }

  async function submit() {
    setError(null)
    const parsed = hangoutFormSchema.safeParse({
      date,
      time,
      purpose,
      gender,
      groupSize,
      payer,
      ...(desiredBudget !== '' ? { desiredBudget } : {}),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Перевірте поля')
      return
    }
    setSending(true)
    try {
      await api(`/venues/${venueId}/hangouts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      toast('Пиячок створено! Очікуйте на компанію.')
      setOpen(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Сервіс тимчасово недоступний')
    } finally {
      setSending(false)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <>
      <Button type="button" variant="primary" onClick={() => setOpen(true)}>
        🍻 Знайти пиячку
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Знайти пиячку">
        {!ack ? (
          <div className="space-y-4">
            <h3 className="font-semibold text-amber-700">⚠️ Попередження про безпеку</h3>
            <ul className="list-disc space-y-2 pl-5 text-sm text-stone-700">
              <li>Ви зустрічаєтеся з незнайомими людьми. Обирайте публічні місця.</li>
              <li>Ніколи не пересилайте гроші незнайомцям до зустрічі.</li>
              <li>Повідомте близьких, куди йдете та на який час.</li>
              <li>Якщо щось викликає підозру — скасуйте зустріч.</li>
            </ul>
            <Button type="button" variant="primary" onClick={acknowledge}>
              Зрозуміло, продовжити
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-sm">
                <label htmlFor="hg-date" className="mb-1 block">Дата</label>
                <input
                  id="hg-date"
                  type="date"
                  min={today}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </div>
              <div className="text-sm">
                <label htmlFor="hg-time" className="mb-1 block">Час</label>
                <input
                  id="hg-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </div>
            </div>

            <div className="text-sm">
              <label htmlFor="hg-purpose" className="mb-1 block">
                Мета зустрічі (10-500 символів)
              </label>
              <Textarea
                id="hg-purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Наприклад: дегустація крафтового пива, настільні ігри…"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="text-sm">
                <label htmlFor="hg-gender" className="mb-1 block">Компанія</label>
                <select
                  id="hg-gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as typeof gender)}
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
                >
                  {HANGOUT_GENDERS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
              <div className="text-sm">
                <label htmlFor="hg-size" className="mb-1 block">Розмір групи (1-20)</label>
                <input
                  id="hg-size"
                  type="number"
                  min={1}
                  max={20}
                  value={groupSize}
                  onChange={(e) => setGroupSize(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="text-sm">
                <label htmlFor="hg-payer" className="mb-1 block">Хто платить</label>
                <select
                  id="hg-payer"
                  value={payer}
                  onChange={(e) => setPayer(e.target.value as typeof payer)}
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
                >
                  {HANGOUT_PAYERS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="text-sm">
                <label htmlFor="hg-budget" className="mb-1 block">Бажаний чек (₴, опційно)</label>
                <input
                  id="hg-budget"
                  type="number"
                  min={0}
                  max={100000}
                  value={desiredBudget}
                  onChange={(e) => setDesiredBudget(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </div>
            </div>

            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Скасувати
              </Button>
              <Button type="button" variant="primary" onClick={submit} disabled={sending}>
                Створити пиячок
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
```


- [ ] **Step 4: Інтеграція в сторінку**

У `src/app/venues/[id]/page.tsx`, у блоці кнопок:

```tsx
        <HangoutButton venueId={venue.id} loginNext={`/venues/${venue.id}`} />
```

- [ ] **Step 5: Тести + бари + commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS.

```bash
git add -A
git commit -m "feat: «Пиячок» — безпека-крок (localStorage) + форма створення пиячка"
```

---

### Task 14: `/account` — обране з видаленням

**Бекенд-контракт (факти):** `GET /me/favorites?page=&limit=` — проекція `{id, name, address, ratingAvg (string|null), mainPhotoUrl}` (Task 7: `parseFavoriteVenue`); `DELETE /me/favorites/:venueId` → 200.

**Files:**
- Create: `src/app/account/layout.tsx`
- Create: `src/app/account/favorites/page.tsx`
- Create: `src/components/features/venues/favorite-remove-button.tsx`
- Test: `src/components/features/venues/__tests__/favorite-remove-button.test.tsx`

**Interfaces:**
- Consumes: `getSessionTokens` (`@/lib/auth/session`), `serverFetch`/`serverFetchList`, `redirect()`, `apiVoid` (Task 11), `parseFavoriteVenue` (Task 7), `Pagination`, `useToast` (Task 10), `formatMoney` не потрібен (budget нема), `RatingStars`.
- Produces: `/account` — захищена зона (редірект гостя на логін), `/account/favorites` — список обраного з пагінацією.

- [ ] **Step 1: Failing-тест**

`src/components/features/venues/__tests__/favorite-remove-button.test.tsx`:

```tsx
import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { FavoriteRemoveButton } from '@/components/features/venues/favorite-remove-button'

afterEach(() => vi.unstubAllGlobals())

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

function renderWithProviders(ui: ReactNode) {
  return render(
    <UserProvider initialUser={{ id: 'u1', email: 'a@b.c', roles: ['user'] } as never}>
      <ToastProvider>{ui}</ToastProvider>
    </UserProvider>,
  )
}

describe('FavoriteRemoveButton', () => {
  it('клік → DELETE + router.refresh()', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<FavoriteRemoveButton venueId="v1" />)
    fireEvent.click(screen.getByRole('button', { name: /Прибрати/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/me/favorites/v1')
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE')
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('помилка → toast, список не рефрешиться', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })))
    renderWithProviders(<FavoriteRemoveButton venueId="v1" />)
    fireEvent.click(screen.getByRole('button', { name: /Прибрати/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/не вдалося/i))
    expect(refresh).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Запустити — FAIL**

Run: `pnpm test src/components/features/venues/__tests__/favorite-remove-button.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Layout-гард `/account`**

`src/app/account/layout.tsx`:

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { serverFetch } from '@/lib/api/server-client'
import { getSessionTokens } from '@/lib/auth/session'
import type { SessionUser } from '@/types/user'

// Захищена зона: сесії немає або вона мертва → логін із поверненням
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const tokens = await getSessionTokens()
  const user = tokens
    ? await serverFetch<SessionUser>('/auth/me', { tokens, revalidate: 0 }).catch(() => null)
    : null
  if (!user) redirect('/auth/login?next=/account')

  return (
    <div className="mx-auto max-w-4xl py-8">
      <h1 className="text-2xl font-bold">Кабінет</h1>
      <nav className="mt-4 flex gap-4 border-b border-stone-200 pb-2 text-sm">
        <Link className="text-brand-600 hover:underline" href="/account/favorites">
          Обране
        </Link>
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  )
}
```

- [ ] **Step 4: Сторінка обраного**

`src/components/features/venues/favorite-remove-button.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useToast } from '@/components/ui/toast'
import { ApiError, apiVoid } from '@/lib/api/client'

export function FavoriteRemoveButton({ venueId }: { venueId: string }) {
  const { toast } = useToast()
  const router = useRouter()
  const [removing, setRemoving] = useState(false)

  async function remove() {
    setRemoving(true)
    try {
      await apiVoid(`/me/favorites/${venueId}`, { method: 'DELETE' })
      toast('Прибрано з обраного')
      router.refresh()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Не вдалося прибрати. Спробуйте ще раз.', 'error')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={removing}
      className="text-xs text-stone-400 hover:text-red-600"
    >
      ✕ Прибрати
    </button>
  )
}
```

`src/app/account/favorites/page.tsx`:

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FavoriteRemoveButton } from '@/components/features/venues/favorite-remove-button'
import { RatingStars } from '@/components/ui/rating-stars'
import { Pagination } from '@/components/ui/pagination'
import { serverFetchList } from '@/lib/api/server-client'
import { getSessionTokens } from '@/lib/auth/session'
import { parseFavoriteVenue, type RawFavoriteVenue } from '@/types/favorite'

const LIMIT = 20

interface Props {
  searchParams: Promise<{ page?: string }>
}

export default async function FavoritesPage({ searchParams }: Props) {
  const tokens = await getSessionTokens()
  if (!tokens) redirect('/auth/login?next=/account/favorites')

  const sp = await searchParams
  const page = Math.max(1, Number(sp.page ?? 1) || 1)

  const raw = await serverFetchList<RawFavoriteVenue>(`/me/favorites?page=${page}&limit=${LIMIT}`, {
    tokens,
    revalidate: 0,
  })
  const favorites = raw.data.map(parseFavoriteVenue)
  const totalPages = Math.max(1, Math.ceil((raw.meta?.total ?? 0) / (raw.meta?.limit || LIMIT)))

  return (
    <div className="space-y-4">
      {favorites.length === 0 ? (
        <div className="rounded-xl bg-stone-50 p-8 text-center">
          <p className="text-stone-500">У обраному поки порожньо.</p>
          <Link className="mt-4 inline-block text-brand-600 hover:underline" href="/">
            Перейти до каталогу
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {favorites.map((f) => (
            <li key={f.id} className="flex items-center gap-4 rounded-xl border border-stone-200 p-4">
              {f.mainPhotoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element -- зовнішній URL з бекенда */
                <img src={f.mainPhotoUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-stone-100 text-stone-400">
                  🍺
                </div>
              )}
              <div className="min-w-0 flex-1">
                <Link className="font-medium hover:underline" href={`/venues/${f.id}`}>
                  {f.name}
                </Link>
                <p className="truncate text-sm text-stone-500">{f.address}</p>
                {f.ratingAvg !== null && <RatingStars value={f.ratingAvg} />}
              </div>
              <FavoriteRemoveButton venueId={f.id} />
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} hrefFor={(p) => `/account/favorites?page=${p}`} />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Тести + бари + commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS.

```bash
git add -A
git commit -m "feat: /account — захищений кабінет + обране з пагінацією та видаленням"
```

---

## Після виконання плану

- [ ] **Фінальні бари на гілці `plan-2-venue-page`:**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Ручна перевірка проти живого бекенда** (backend-final, `http://localhost:3000`; фронт `pnpm dev` → `http://localhost:3001`):
  1. Каталог: фільтри (включно з радіусом), пагінація, сортування — як до Плану 2, без регресій.
  2. Сторінка закладу: галерея/години/контакти/теги/фічі з живими даними; кнопка «Прокласти маршрут» веде в Google Maps.
  3. AgeGate: Tab не заходить у контент за модалкою; Escape закриває модалки; «Повернутися» з denied-стану працює.
  4. OAuth-флоу (якщо налаштований): після callback у історії НЕ лишаються access/refresh токени (перевірити кнопкою «назад» і адресним рядком).
  5. Відгуки: створення з фото чеку (multipart), редагування, видалення; сортування; пагінація; 409 при другому відгуку.
  6. Обране: додати/прибрати на сторінці закладу і в `/account/favorites`; стан після перезавантаження сторінки збігається.
  7. Скарга: на заклад і на відгук; 20+ символів; успішний toast.
  8. «Пиячок»: безпека-крок при першому відкритті; після підтвердження — форма одразу; створення з'являється на бекенді.
  9. `/account` гостем → редірект на логін; після входу — обране.
- [ ] **Оновити цей файл:** позначити виконані кроки чекбоксами.
- [ ] **Злити в main** (fast-forward), оновити резидуали в пам'яті `pyiachok-plan-1-residuals.md` (викинути покриті, дописати нові).