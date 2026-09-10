# План 3 «Кабінет + публічні сторінки» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реалізувати розділ «Кабінет» + публічні сторінки базової спеки: профіль, мої відгуки/пиячки/заклади, керування закладом (редагування/фото/новини/аналітика), `/venues/new`, `/news`, `/news/[id]`, `/hangouts`, `/hangouts/[id]`, `UserMenu` у хедері, + мінімальні бекенд-ендпоінти `GET /me/venues` і `GET /me/venues/:id` у backend-final, + дешеві резидуали Плану 2.

**Architecture:** Конвенції Планів 1–2: BFF (httpOnly-cookie `piyachok_session`, catch-all проксі `/api/v1/[...path]`), Server Components із `serverFetch`/`serverFetchList` (публічні `revalidate`, кабінетні `no-store`), тонкі клієнтські острови для форм/дій через `api()`/`apiVoid()`. Графік аналітики — inline SVG без бібліотек.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, zod, Vitest + RTL; NestJS 10 + TypeORM у backend-final (jest).

**Spec:** `docs/superpowers/specs/2026-09-10-plan-3-account-public-design.md` (+ базова `2026-09-08-pyiachok-frontend-design.md`, розділи 5–8).

## Global Constraints

- ДВІ гілки: `plan-3-account-public` у frontend-final (основна робота) і `plan-3-account-public` у backend-final (тільки Tasks 1–2). Леджер сесії: `.superpowers/sdd/2026-09-10-plan-3-account-public/progress.md` (git-ігнорований скретч).
- Next.js 16 breaking changes: `params`/`searchParams` — **Promises** (`await`), Metadata API. Перед першим Next-кодом звіритись із `node_modules/next/dist/docs/` (AGENTS.md вимагає).
- BFF-семантика: клієнтські виклики — відносні шляхи `/api/v1/...` через `api()`/`apiList()`/`apiVoid()` (`@/lib/api/client`); серверні — `serverFetch<T>` (повертає РОЗГОРНУТИЙ T) і `serverFetchList<T>` (повертає `{data, meta?}`) (`@/lib/api/server-client`), опції `{tokens, revalidate: 0 | N}`; токени — `await getSessionTokens()` (`@/lib/auth/session`).
- `api()` з `method:'DELETE'` → `Promise<T | undefined>` (порожнє тіло 200 → undefined). Мутації без тіла відповіді → `apiVoid`. `ApiError` — тільки з `@/lib/api/parse`.
- Бекенд: успіх `{data, meta?}` (POST → 201), DELETE `/reviews/:id` і `/news/:id` — 200 (тіло/порожнє тіло обидва ок); помилка `{error:{code,message}}`; рядкові numeric (`averageCheck`, `latitude`, `longitude`, `desiredBudget`, `ratingAvg`) парсити `Number()`; `whitelist + forbidNonWhitelisted` — **надсилати тільки поля DTO**.
- Тести: `vi.stubGlobal('fetch', ...)` + `afterEach(() => vi.unstubAllGlobals())`; у компонентних тестах із `UserProvider` відфільтровувати його власний фетч `/auth/me` (патерн `apiCalls`); повні фікстури `SessionUser {id, email, roles}`; **trailing newlines обов'язково** у всіх нових файлах.
- Комміти: завершувати `Co-Authored-By: Claude Code <noreply@anthropic.com>`. Спільний `git stash` у worktrees заборонений.
- Класифікатор (glm-5.3:cloud) флакає: таймаут Bash → зачекати ~60с → повторити ту саму дію.
- Мова UI — українська; формат дат uk-UA (`@/lib/utils/format`).

---

### Task 1 (backend-final): GET /me/venues — список моїх закладів

**Files:**
- Modify: `backend-final/src/modules/venues/venues.service.ts` (додати метод `listMineForUser`)
- Create: `backend-final/src/modules/venues/me-venues.controller.ts`
- Modify: `backend-final/src/modules/venues/venues.module.ts:33` (controllers — додати `MeVenuesController`)
- Test: `backend-final/src/modules/venues/__tests__/me-venues.controller.spec.ts`

**Interfaces:**
- Consumes: `VenuesService`, `@CurrentUser() u: JwtUser` (поле `sub`).
- Produces: `GET /me/venues` → `{data: Venue[]}` (усі статуси, `createdAt DESC`, relations `photos`); `VenuesService.listMineForUser(userId): Promise<Venue[]>` (Task 7 фетчить `/me/venues`).

- [ ] **Step 1: Write the failing test (controller spec, патерн `news.controller.spec.ts` — jest, Nest TestingModule, мок-сервіс)**

```ts
// backend-final/src/modules/venues/__tests__/me-venues.controller.spec.ts
import { Test } from '@nestjs/testing';
import { MeVenuesController } from '../me-venues.controller';
import { VenuesService } from '../venues.service';

describe('MeVenuesController', () => {
  let controller: MeVenuesController;
  let venues: any;

  beforeEach(async () => {
    venues = { listMineForUser: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [MeVenuesController],
      providers: [{ provide: VenuesService, useValue: venues }],
    }).compile();
    controller = module.get(MeVenuesController);
  });

  it('list delegates to listMineForUser and wraps in { data }', async () => {
    venues.listMineForUser.mockResolvedValue([{ id: 'v1', status: 'pending' }]);
    const res = await controller.list({ sub: 'u1' } as any);
    expect(venues.listMineForUser).toHaveBeenCalledWith('u1');
    expect(res.data[0].id).toBe('v1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend-final && npx jest src/modules/venues/__tests__/me-venues.controller.spec.ts`
Expected: FAIL — `Cannot find module '../me-venues.controller'`.

- [ ] **Step 3: Implement controller + service + module registration**

⚠️ Спершу відкрити `venues.controller.ts` і скопіювати 1:1 фактичні імпорт-шляхи guards/decorators (`JwtAuthGuard`, `CurrentUser`, `JwtUser`, `ApiDataResponse` зі `response-helpers`) — вони вже використовуються в цьому модулі.

```ts
// backend-final/src/modules/venues/me-venues.controller.ts
@ApiTags('Me / venues')
@ApiBearerAuth('access-token')
@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeVenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Get('venues')
  @ApiOperation({ summary: 'Заклади поточного користувача (усі статуси)' })
  @ApiDataResponse({ type: [Venue], description: 'Список закладів користувача' })
  list(@CurrentUser() u: JwtUser) {
    return this.venues.listMineForUser(u.sub).then((data) => ({ data }));
  }
}
```

Сервіс (`venues.service.ts`; імʼя репозиторію — фактичне поле з `@InjectRepository(Venue)` у конструкторі, наприклад `this.venuesRepo`):

```ts
  async listMineForUser(userId: string): Promise<Venue[]> {
    return this.venuesRepo.find({
      where: { ownerId: userId },
      order: { createdAt: 'DESC' },
      relations: { photos: true },
    });
  }
```

У `venues.module.ts`: `controllers: [VenuesController, VenuesAdminController, MeVenuesController]`.

- [ ] **Step 4: Run tests, then backend gates**

Run: `cd backend-final && npx jest src/modules/venues/__tests__/me-venues.controller.spec.ts && pnpm typecheck && pnpm lint`
Expected: PASS, green. (Якщо в backend-final гейти називаються інакше — звірити з package.json scripts.)

- [ ] **Step 5: Commit (у backend-final, гілка plan-3-account-public)**

```bash
git add src/modules/venues/me-venues.controller.ts src/modules/venues/venues.service.ts src/modules/venues/venues.module.ts src/modules/venues/__tests__/me-venues.controller.spec.ts
git commit -m "feat: GET /me/venues — список закладів користувача (усі статуси)

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2 (backend-final): GET /me/venues/:id — свій заклад незалежно від статусу

**Files:**
- Modify: `backend-final/src/modules/venues/me-venues.controller.ts` (додати `get`)
- Modify: `backend-final/src/modules/venues/venues.service.ts` (додати `findOneForOwnerQuery`)
- Modify: `backend-final/src/modules/venues/me-venues.controller.ts` (провайдер `PermissionsService`)
- Test: `backend-final/src/modules/venues/__tests__/me-venues.controller.spec.ts` (додати кейси)

**Interfaces:**
- Consumes: Task 1 (контролер, `VenuesService`), патерн `assertOwnerOrAll` з `analytics.controller.ts:144`, `PermissionsService.hasPermission(userId, perm)`.
- Produces: `GET /me/venues/:id` → `{data: Venue}` з relations (`photos`, `featureAssignments.feature`, `venueTags.tag`, `venueTypeAssignments.type`) при **будь-якому** статусі; 404 якщо немає; 403 якщо не-власник без `venue:edit:any`. Єдине джерело даних `/account/venues/[id]` (Tasks 9–12).

- [ ] **Step 1: Write the failing tests (додати в spec з Task 1)** — провайдер `PermissionsService` тепер теж мокається:

```ts
  let perms: any;
  // у beforeEach:
  perms = { hasPermission: jest.fn().mockResolvedValue(false) };
  // providers додають { provide: PermissionsService, useValue: perms }
  // import { PermissionsService } from '../../rbac/permissions.service';
  // import { NotFoundException, ForbiddenException } from '@nestjs/common';

  it('get returns own venue regardless of status', async () => {
    venues.findOneForOwnerQuery.mockResolvedValue({ id: 'v1', ownerId: 'u1', status: 'pending' });
    const res = await controller.get({ sub: 'u1' } as any, 'v1');
    expect(res.data.status).toBe('pending');
  });

  it('get allows venue:edit:any for non-owner', async () => {
    perms.hasPermission.mockResolvedValue(true);
    venues.findOneForOwnerQuery.mockResolvedValue({ id: 'v2', ownerId: 'other', status: 'rejected' });
    const res = await controller.get({ sub: 'u1' } as any, 'v2');
    expect(perms.hasPermission).toHaveBeenCalledWith('u1', 'venue:edit:any');
    expect(res.data.id).toBe('v2');
  });

  it('get throws Forbidden for non-owner without permission', async () => {
    perms.hasPermission.mockResolvedValue(false);
    venues.findOneForOwnerQuery.mockResolvedValue({ id: 'v2', ownerId: 'other', status: 'approved' });
    await expect(controller.get({ sub: 'u1' } as any, 'v2')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('get throws NotFound when venue missing', async () => {
    venues.findOneForOwnerQuery.mockResolvedValue(null);
    await expect(controller.get({ sub: 'u1' } as any, 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });
```

- [ ] **Step 2: Run test to verify new cases fail**

Run: `cd backend-final && npx jest src/modules/venues/__tests__/me-venues.controller.spec.ts`
Expected: FAIL — `controller.get is not a function`.

- [ ] **Step 3: Implement**

Контролер — додати метод + інʼєкцію `PermissionsService` (імпорт `NotFoundException, ForbiddenException` з `@nestjs/common`, `Param` з `@nestjs/common`):

```ts
  constructor(
    private readonly venues: VenuesService,
    private readonly perms: PermissionsService,
  ) {}

  @Get('venues/:id')
  @ApiOperation({ summary: 'Свій заклад незалежно від статусу (власник або venue:edit:any)' })
  @ApiDataResponse({ type: Venue, description: 'Заклад з relations' })
  async get(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    const venue = await this.venues.findOneForOwnerQuery(id);
    if (!venue) throw new NotFoundException('Заклад не знайдено');
    if (venue.ownerId !== u.sub) {
      const canAny = await this.perms.hasPermission(u.sub, 'venue:edit:any');
      if (!canAny) throw new ForbiddenException('Немає доступу до цього закладу');
    }
    return { data: venue };
  }
```

Сервіс:

```ts
  async findOneForOwnerQuery(id: string): Promise<Venue | null> {
    // Те саме насичення, що в search(): photos + features + tags + types
    return this.venuesRepo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.photos', 'photo')
      .leftJoin('v.featureAssignments', 'fa')
      .leftJoinAndSelect('fa.feature', 'f')
      .leftJoin('v.venueTags', 'vt')
      .leftJoinAndSelect('vt.tag', 't')
      .leftJoin('v.venueTypeAssignments', 'vta')
      .leftJoinAndSelect('vta.type', 'ty')
      .where('v.id = :id', { id })
      .getOne();
  }
```

⚠️ Джойн-аліаси звірити з `search()` у тому ж файлі (мають бути ідентичні).

- [ ] **Step 4: Run tests, then gates** — `npx jest src/modules/venues/__tests__/me-venues.controller.spec.ts && pnpm typecheck && pnpm lint` → PASS.
- [ ] **Step 5: Commit**

```bash
git add src/modules/venues/me-venues.controller.ts src/modules/venues/venues.service.ts src/modules/venues/__tests__/me-venues.controller.spec.ts
git commit -m "feat: GET /me/venues/:id — свій заклад незалежно від статусу (owner або venue:edit:any)

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3 (frontend): типи/парсери + zod-схеми (фундамент форм)

**Files:**
- Create: `frontend-final/src/types/news.ts`, `frontend-final/src/types/analytics.ts`
- Modify: `frontend-final/src/types/hangout.ts` (статуси + relations)
- Create: `frontend-final/src/lib/validation/venue.ts`, `frontend-final/src/lib/validation/profile.ts`, `frontend-final/src/lib/validation/news.ts`
- Test: `frontend-final/src/types/__tests__/news.test.ts`, `frontend-final/src/lib/validation/__tests__/venue.test.ts`, `frontend-final/src/lib/validation/__tests__/profile.test.ts`, `frontend-final/src/lib/validation/__tests__/news.test.ts`

**Interfaces:**
- Produces (споживають пізніші задачі):
  - `types/news.ts`: `RawNews`, `News`, `parseNews(raw: RawNews): News`, `NewsCategory = 'general' | 'promo' | 'event'`.
  - `types/analytics.ts`: `RawVenueAnalytics`, `VenueAnalytics {totalViews: number, viewsByDay: {date, count}[], eventsByType: {eventType, count}[]}`, `parseVenueAnalytics(raw): VenueAnalytics`.
  - `types/hangout.ts`: `RawHangout.status: 'open'|'filled'|'cancelled'|'completed'` (+`creatorId: string`, опційні `venue?: {id, name, address}`, `participants?: {userId: string; joinedAt: string}[]`); `Hangout.status` — той самий юніон; `HANGOUT_STATUS_LABELS: Record<HangoutStatus, string>`.
  - `lib/validation/venue.ts`: `venueCreateSchema`, `venueUpdateSchema = venueCreateSchema.partial()`, `VenueCreateValues`, `WH_DAYS` (масив 7 днів англ. ключами), `csvToArray(s: string): string[]`.
  - `lib/validation/profile.ts`: `profileUpdateSchema` (усі поля опційні; `firstname/lastname` ≥2).
  - `lib/validation/news.ts`: `NEWS_CATEGORIES` (value/label), `newsFormSchema {category, title 5–200, content ≥20, imageUrl?}`.

- [ ] **Step 1: Write the failing tests**

```ts
// frontend-final/src/types/__tests__/news.test.ts
import { describe, expect, it } from 'vitest'
import { parseNews, type RawNews } from '@/types/news'

const raw: RawNews = {
  id: 'n1', venueId: 'v1', category: 'promo', title: 'Заголовок новини',
  content: 'Текст', imageUrl: '/static/a.png', status: 'published',
  isPromoted: true, publishedAt: '2026-09-10T10:00:00Z',
  createdAt: '2026-09-10T10:00:00Z', updatedAt: '2026-09-10T10:00:00Z',
}

describe('parseNews', () => {
  it('розгортає поля 1:1', () => {
    const n = parseNews(raw)
    expect(n.id).toBe('n1')
    expect(n.category).toBe('promo')
    expect(n.isPromoted).toBe(true)
  })
  it('venueId/imageUrl null-сейф', () => {
    const n = parseNews({ ...raw, venueId: null, imageUrl: null, isPromoted: undefined as never })
    expect(n.venueId).toBeNull()
    expect(n.imageUrl).toBeNull()
    expect(n.isPromoted).toBe(false)
  })
})
```

```ts
// frontend-final/src/lib/validation/__tests__/venue.test.ts
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
```

```ts
// frontend-final/src/lib/validation/__tests__/profile.test.ts
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
```

```ts
// frontend-final/src/lib/validation/__tests__/news.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend-final && pnpm vitest run src/types/__tests__/news.test.ts src/lib/validation/__tests__/venue.test.ts src/lib/validation/__tests__/profile.test.ts src/lib/validation/__tests__/news.test.ts`
Expected: FAIL — модулі не існують.

- [ ] **Step 3: Implement**

```ts
// frontend-final/src/types/news.ts
export type NewsCategory = 'general' | 'promo' | 'event'

export interface RawNews {
  id: string
  venueId: string | null
  category: NewsCategory
  title: string
  content: string
  imageUrl: string | null
  status: 'draft' | 'published' | 'archived'
  isPromoted: boolean
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface News {
  id: string
  venueId: string | null
  category: NewsCategory
  title: string
  content: string
  imageUrl: string | null
  status: 'draft' | 'published' | 'archived'
  isPromoted: boolean
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export function parseNews(raw: RawNews): News {
  return {
    id: raw.id,
    venueId: raw.venueId ?? null,
    category: raw.category,
    title: raw.title,
    content: raw.content,
    imageUrl: raw.imageUrl ?? null,
    status: raw.status,
    isPromoted: Boolean(raw.isPromoted),
    publishedAt: raw.publishedAt ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}
```

```ts
// frontend-final/src/types/analytics.ts
export interface RawVenueAnalytics {
  totalViews: string | number
  viewsByDay: { date: string; count: string | number }[]
  eventsByType: { eventType: string; count: string | number }[]
}

export interface VenueAnalytics {
  totalViews: number
  viewsByDay: { date: string; count: number }[]
  eventsByType: { eventType: string; count: number }[]
}

const num = (v: string | number): number => Number(v) || 0

export function parseVenueAnalytics(raw: RawVenueAnalytics): VenueAnalytics {
  return {
    totalViews: num(raw.totalViews),
    viewsByDay: (raw.viewsByDay ?? []).map((d) => ({ date: d.date, count: num(d.count) })),
    eventsByType: (raw.eventsByType ?? []).map((e) => ({ eventType: e.eventType, count: num(e.count) })),
  }
}
```

`types/hangout.ts` — змінити `RawHangout`/`Hangout`/`parseHangout`:

```ts
export type HangoutStatus = 'open' | 'filled' | 'cancelled' | 'completed'

export const HANGOUT_STATUS_LABELS: Record<HangoutStatus, string> = {
  open: 'Відкрита',
  filled: 'Заповнена',
  cancelled: 'Скасована',
  completed: 'Завершена',
}

// у RawHangout:
  creatorId: string  // бекенд-поле; старе імʼя `userId` НЕ використовується — видалити
  status: HangoutStatus
  venue?: { id: string; name: string; address: string; mainPhotoUrl: string | null }
  participants?: { hangoutId: string; userId: string; joinedAt: string }[]

// у Hangout (parsed):
  creatorId: string
  status: HangoutStatus
  venue?: { id: string; name: string; address: string; mainPhotoUrl: string | null }
  participants?: { hangoutId: string; userId: string; joinedAt: string }[]

// parseHangout: додати creatorId: raw.creatorId; venue/participants — passthrough
// (статус passthrough, юніон із 4 значень)
```

```ts
// frontend-final/src/lib/validation/venue.ts
import { z } from 'zod'

export const WH_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

const timeRangeRe = /^\d{2}:\d{2}-\d{2}:\d{2}$/

export function csvToArray(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean)
}

const contactsSchema = z
  .object({
    phone: z.string().trim().optional(),
    instagram: z.string().trim().optional(),
    facebook: z.string().trim().optional(),
    website: z.string().trim().optional(),
  })
  .optional()

export const venueCreateSchema = z.object({
  name: z.string().trim().min(3, 'Мінімум 3 символи'),
  address: z.string().trim().min(5, 'Мінімум 5 символів'),
  description: z.string().trim().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  contacts: contactsSchema,
  workingHours: z
    .record(z.string(), z.string().regex(timeRangeRe, 'Формат: HH:MM-HH:MM'))
    .optional(),
  averageCheck: z.coerce.number().min(0, 'Не менше 0').optional(),
  featureCodes: z.array(z.string()).max(20, 'Максимум 20').optional(),
  tagSlugs: z.array(z.string()).max(20, 'Максимум 20').optional(),
  typeSlug: z.string().trim().optional(),
})

export const venueUpdateSchema = venueCreateSchema.partial()

export type VenueCreateValues = z.infer<typeof venueCreateSchema>
export type VenueUpdateValues = z.infer<typeof venueUpdateSchema>
```

```ts
// frontend-final/src/lib/validation/profile.ts
import { z } from 'zod'

export const profileUpdateSchema = z.object({
  firstname: z.string().trim().min(2, 'Мінімум 2 символи').optional(),
  lastname: z.string().trim().min(2, 'Мінімум 2 символи').optional(),
  phone: z.string().trim().optional(),
  age: z.coerce.number().int('Ціле число').optional(),
  avatarUrl: z.string().trim().optional(),
})

export type ProfileUpdateValues = z.infer<typeof profileUpdateSchema>
```

```ts
// frontend-final/src/lib/validation/news.ts
import { z } from 'zod'

export const NEWS_CATEGORIES = [
  { value: 'general', label: 'Загальне' },
  { value: 'promo', label: 'Акції' },
  { value: 'event', label: 'Події' },
] as const

export const newsFormSchema = z.object({
  category: z.enum(['general', 'promo', 'event']),
  title: z.string().trim().min(5, 'Мінімум 5 символів').max(200, 'Максимум 200 символів'),
  content: z.string().trim().min(20, 'Мінімум 20 символів'),
  imageUrl: z.string().trim().optional(),
})

export type NewsFormValues = z.infer<typeof newsFormSchema>
```

- [ ] **Step 4: Run tests** — `pnpm vitest run src/types/__tests__/news.test.ts src/lib/validation/__tests__/venue.test.ts src/lib/validation/__tests__/profile.test.ts src/lib/validation/__tests__/news.test.ts` → PASS; потім `pnpm typecheck` (зміна `Hangout.status` не зламала існуючих споживачів — `'open'|'closed'` ніде не порівнюється) і `pnpm test`.
- [ ] **Step 5: Commit**

```bash
git add src/types/news.ts src/types/analytics.ts src/types/hangout.ts src/types/__tests__/news.test.ts src/lib/validation/venue.ts src/lib/validation/profile.ts src/lib/validation/news.ts src/lib/validation/__tests__/venue.test.ts src/lib/validation/__tests__/profile.test.ts src/lib/validation/__tests__/news.test.ts
git commit -m "feat: типи news/analytics, розширення hangout-статусів, zod-схеми venue/profile/news

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

### Task 4 (frontend): `/account` — профіль (перегляд + редагування)

**Files:**
- Modify: `frontend-final/src/app/account/page.tsx` (замінити насьогоднішній зміст, якщо є; зараз файл відсутній — `favorites` перша сторінка)
- Create: `frontend-final/src/components/features/account/profile-form.tsx`
- Modify: `frontend-final/src/app/account/layout.tsx` (nav — додати «Профіль» → `/account`)
- Test: `frontend-final/src/components/features/account/__tests__/profile-form.test.tsx`

**Interfaces:**
- Consumes: `serverFetch`, `getSessionTokens`; Task 3 `profileUpdateSchema`; `api()` (PATCH `/me/profile`); `useToast` ({toast(message, tone?)}); `router.refresh()`.
- Produces: `ProfileForm({ profile }: { profile: ProfileFields })`, де `ProfileFields = { firstname: string | null; lastname: string | null; phone: string | null; age: number | null; avatarUrl: string | null }`.

- [ ] **Step 1: Write the failing test (патерн `favorite-remove-button.test.tsx`: UserProvider+ToastProvider, `apiCalls`-фільтр `/auth/me`)**

```tsx
// frontend-final/src/components/features/account/__tests__/profile-form.test.tsx
import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { ProfileForm } from '@/components/features/account/profile-form'
import type { SessionUser } from '@/types/user'

afterEach(() => vi.unstubAllGlobals())

const testUser: SessionUser = { id: 'u1', email: 'a@b.c', roles: ['user'] }

function renderWithProviders(ui: ReactNode) {
  return render(
    <UserProvider initialUser={testUser}>
      <ToastProvider>{ui}</ToastProvider>
    </UserProvider>,
  )
}

const profile = { firstname: 'Іван', lastname: 'Петренко', phone: '+380', age: 25, avatarUrl: null }

function apiCalls() {
  return (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
    ([u]) => !String(u).endsWith('/auth/me'),
  )
}

describe('ProfileForm', () => {
  it('сабміт → PATCH /me/profile з лише заповненими полями + toast', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ data: { ...profile } }), { status: 200, headers: { 'content-type': 'application/json' } })
    }))
    renderWithProviders(<ProfileForm profile={profile} />)
    fireEvent.change(screen.getByLabelText(/^Імʼя$/i), { target: { value: 'Олег' } })
    fireEvent.click(screen.getByRole('button', { name: /Зберегти/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/збережено/i))
    const call = apiCalls()[0]
    expect(String(call[0])).toBe('/api/v1/me/profile')
    expect((call[1] as RequestInit).method).toBe('PATCH')
    const body = JSON.parse((call[1] as RequestInit).body as string)
    expect(body.firstname).toBe('Олег')
    expect(body.age).toBe(25)
  })

  it('firstname <2 → інлайн-помилка, без PATCH', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(null, { status: 500 })
    }))
    renderWithProviders(<ProfileForm profile={profile} />)
    fireEvent.change(screen.getByLabelText(/^Імʼя$/i), { target: { value: 'Й' } })
    fireEvent.click(screen.getByRole('button', { name: /Зберегти/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/мінімум 2/i))
    expect(apiCalls().length).toBe(0)
  })
})
```

⚠️ `getByLabelText(/^Імʼя$/i)` vs `/^Імʼя$/` — звірити фактичний напис label у Step 3 і привести тест у відповідність (апостроф в «Імʼя» — U+02BC ʼ, як в усій кодовій базі).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend-final && pnpm vitest run src/components/features/account/__tests__/profile-form.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// frontend-final/src/components/features/account/profile-form.tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import { ApiError } from '@/lib/api/parse'
import { profileUpdateSchema } from '@/lib/validation/profile'

export interface ProfileFields {
  firstname: string | null
  lastname: string | null
  phone: string | null
  age: number | null
  avatarUrl: string | null
}

export function ProfileForm({ profile }: { profile: ProfileFields }) {
  const router = useRouter()
  const { toast } = useToast()
  const [firstname, setFirstname] = useState(profile.firstname ?? '')
  const [lastname, setLastname] = useState(profile.lastname ?? '')
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [age, setAge] = useState(profile.age?.toString() ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    // Порожні поля НЕ надсилаємо (DTO опційні; пусті рядки ламали б MinLength)
    const values: Record<string, unknown> = {}
    if (firstname.trim()) values.firstname = firstname
    if (lastname.trim()) values.lastname = lastname
    if (phone.trim()) values.phone = phone
    if (age.trim()) values.age = Number(age)
    if (avatarUrl.trim()) values.avatarUrl = avatarUrl
    const parsed = profileUpdateSchema.safeParse(values)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Перевірте поля')
      return
    }
    setSaving(true)
    try {
      await api('/me/profile', { method: 'PATCH', body: JSON.stringify(parsed.data) })
      toast('Профіль збережено')
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося зберегти профіль')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-3" aria-label="Профіль">
      <label className="block text-sm font-medium">Імʼя
        <Input value={firstname} onChange={(e) => setFirstname(e.target.value)} className="mt-1 w-full" />
      </label>
      <label className="block text-sm font-medium">Прізвище
        <Input value={lastname} onChange={(e) => setLastname(e.target.value)} className="mt-1 w-full" />
      </label>
      <label className="block text-sm font-medium">Телефон
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full" />
      </label>
      <label className="block text-sm font-medium">Вік
        <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} className="mt-1 w-full" />
      </label>
      <label className="block text-sm font-medium">URL аватара
        <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="mt-1 w-full" />
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={saving}>{saving ? 'Зберігаємо…' : 'Зберегти'}</Button>
    </form>
  )
}
```

⚠️ Перевірити фактичні пропси `Input` у `components/ui/input.tsx` (label — звичайний `<label>`, як в інших формах; адаптувати під фактичний API Input, якщо він відрізняється).

Сторінка:

```tsx
// frontend-final/src/app/account/page.tsx
import { redirect } from 'next/navigation'
import { ProfileForm, type ProfileFields } from '@/components/features/account/profile-form'
import { serverFetch } from '@/lib/api/server-client'
import { getSessionTokens } from '@/lib/auth/session'

export default async function AccountProfilePage() {
  const tokens = await getSessionTokens()
  if (!tokens) redirect('/auth/login?next=/account')
  const me = await serverFetch<{ profile: ProfileFields }>('/me', { tokens, revalidate: 0 })
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">Профіль</h2>
      <ProfileForm profile={me.profile} />
    </section>
  )
}
```

Nav у `account/layout.tsx` — додати перед «Обране»: `<Link className="..." href="/account">Профіль</Link>`.

- [ ] **Step 4: Run tests** — компонентний PASS; `pnpm test` (усі), `pnpm typecheck`, `pnpm lint`.
- [ ] **Step 5: Commit**

```bash
git add src/app/account/page.tsx src/components/features/account/profile-form.tsx src/components/features/account/__tests__/profile-form.test.tsx src/app/account/layout.tsx
git commit -m "feat: /account — профіль з редагуванням (PATCH /me/profile)

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5 (frontend): `/account/reviews` — мої відгуки (редагування, видалення)

**Files:**
- Create: `frontend-final/src/app/account/reviews/page.tsx`
- Create: `frontend-final/src/components/features/account/my-review-item.tsx`
- Modify: `frontend-final/src/app/account/layout.tsx` (nav + «Відгуки»)
- Test: `frontend-final/src/components/features/account/__tests__/my-review-item.test.tsx`

**Interfaces:**
- Consumes: `serverFetch<RawReview[]>('/me/reviews', {tokens, revalidate: 0})` (бекенд: `{data: RawReview[]}` без meta, без назви закладу — рядок посилання «Переглянути заклад» без імені); `parseReview`; `ReviewForm({venueId, myReview: {id, rating, text} | null})` (reuse — PATCH усередині); `apiVoid('/reviews/:id', {method:'DELETE'})`.
- Produces: `MyReviewItem({ review }: { review: Review })` — клієнтський острів з кнопками «Редагувати» (Modal + ReviewForm) і «Видалити» (confirm-вікно Modal → apiVoid → router.refresh()).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend-final/src/components/features/account/__tests__/my-review-item.test.tsx
import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { MyReviewItem } from '@/components/features/account/my-review-item'
import type { Review } from '@/types/review'
import type { SessionUser } from '@/types/user'

afterEach(() => vi.unstubAllGlobals())

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))

const testUser: SessionUser = { id: 'u1', email: 'a@b.c', roles: ['user'] }

const review: Review = {
  id: 'r1', venueId: 'v1', rating: 4, text: 'Гарне місце, смачне пиво', checkPhotoUrl: null,
  isFeatured: false, createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z',
  author: { firstname: 'Іван', lastname: null },
}

function apiCalls() {
  return (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
    ([u]) => !String(u).endsWith('/auth/me'),
  )
}

describe('MyReviewItem', () => {
  it('видалення: confirm → DELETE /reviews/r1 → refresh', async () => {
    // 1-й виклик — /auth/me (UserProvider), далі DELETE → 200 порожнє тіло
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(null, { status: 200 })
    }))
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider>
          <MyReviewItem review={review} venueName={null} />
        </ToastProvider>
      </UserProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Видалити/i }))
    fireEvent.click(await screen.findByRole('button', { name: /^Так, видалити$/i }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    const del = apiCalls().find(([, i]) => (i as RequestInit).method === 'DELETE')
    expect(String(del?.[0])).toBe('/api/v1/reviews/r1')
  })

  it('редагування: відкриває форму з моїм відгуком', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(null, { status: 200 })
    }))
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider>
          <MyReviewItem review={review} venueName={null} />
        </ToastProvider>
      </UserProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Редагувати/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    // ReviewForm у режимі редагування: кнопка сабміту містить «Зберегти» (звірити з фактичним текстом у review-form.tsx)
  })
})
```

- [ ] **Step 2: Run test to verify it fails** — `pnpm vitest run src/components/features/account/__tests__/my-review-item.test.tsx` → FAIL.
- [ ] **Step 3: Implement**

```tsx
// frontend-final/src/components/features/account/my-review-item.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { RatingStars } from '@/components/ui/rating-stars'
import { ReviewForm } from '@/components/features/venues/review-form'
import { apiVoid } from '@/lib/api/client'
import { formatDate } from '@/lib/utils/format'
import type { Review } from '@/types/review'

export function MyReviewItem({ review, venueName }: { review: Review; venueName: string | null }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function remove() {
    await apiVoid(`/reviews/${review.id}`, { method: 'DELETE' })
    setDeleting(false)
    router.refresh()
  }

  return (
    <li className="rounded-xl border border-stone-200 p-4">
      <div className="flex items-center gap-3">
        <RatingStars value={review.rating} />
        <span className="text-sm text-stone-500">{formatDate(review.createdAt)}</span>
        <Link className="ml-auto text-sm text-brand-600 hover:underline" href={`/venues/${review.venueId}`}>
          {venueName ?? 'Переглянути заклад'}
        </Link>
      </div>
      <p className="mt-2 whitespace-pre-line text-stone-700">{review.text}</p>
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Редагувати</Button>
        <Button variant="ghost" size="sm" onClick={() => setDeleting(true)}>Видалити</Button>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Редагувати відгук">
        {/* Сабміт у ReviewForm робить router.refresh() — після цього закриваємо */}
        <ReviewForm venueId={review.venueId} myReview={{ id: review.id, rating: review.rating, text: review.text }} />
      </Modal>

      <Modal open={deleting} onClose={() => setDeleting(false)} title="Видалити відгук?">
        <p className="text-stone-600">Відгук буде видалено безвозвратно.</p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => setDeleting(false)}>Скасувати</Button>
          <Button onClick={remove}>Так, видалити</Button>
        </div>
      </Modal>
    </li>
  )
}
```

⚠️ Звірити з фактичним `ReviewForm`: чи він сам закриває/рефрешить після сабміту (прочитати його код); якщо після редагування діалог лишається відкритим — додати в MyReviewItem обробку (ReviewForm, можливо, приймає `onDone`; якщо ні — залишити відкритим до router.refresh і закриття користувачем; у цьому разі закриття зробити через `router.refresh()` після сабміту неможливо — задокументувати і залишити просту поведінку: сабміт PATCH відбувається, користувач закриває модалку сам).

Сторінка:

```tsx
// frontend-final/src/app/account/reviews/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MyReviewItem } from '@/components/features/account/my-review-item'
import { serverFetch } from '@/lib/api/server-client'
import { getSessionTokens } from '@/lib/auth/session'
import { parseReview, type RawReview } from '@/types/review'

export default async function MyReviewsPage() {
  const tokens = await getSessionTokens()
  if (!tokens) redirect('/auth/login?next=/account/reviews')
  const raw = await serverFetch<RawReview[]>('/me/reviews', { tokens, revalidate: 0 })
  const reviews = raw.map(parseReview)

  if (reviews.length === 0) {
    return (
      <div className="rounded-xl bg-stone-50 p-8 text-center">
        <p className="text-stone-500">Ви ще не залишали відгуки.</p>
        <Link className="mt-4 inline-block text-brand-600 hover:underline" href="/">Перейти до каталогу</Link>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {/* Бекенд не віддає назву закладу в /me/reviews — без N+1-обогачення */}
      {reviews.map((r) => <MyReviewItem key={r.id} review={r} venueName={null} />)}
    </ul>
  )
}
```

Nav у `account/layout.tsx`: додати «Відгуки» → `/account/reviews`.

- [ ] **Step 4: Run tests** — `pnpm vitest run src/components/features/account/__tests__/my-review-item.test.tsx` → PASS; `pnpm test && pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Commit**

```bash
git add src/app/account/reviews/page.tsx src/components/features/account/my-review-item.tsx src/components/features/account/__tests__/my-review-item.test.tsx src/app/account/layout.tsx
git commit -m "feat: /account/reviews — мої відгуки з редагуванням і видаленням

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

### Task 6 (frontend): `/account/hangouts` — мої пиячки (role-таби, cancel/leave)

**Files:**
- Create: `frontend-final/src/app/account/hangouts/page.tsx`
- Create: `frontend-final/src/components/features/hangouts/hangout-actions.tsx`
- Modify: `frontend-final/src/app/account/layout.tsx` (nav + «Пиячки»)
- Test: `frontend-final/src/components/features/hangouts/__tests__/hangout-actions.test.tsx`

**Interfaces:**
- Consumes: `serverFetch<RawHangout[]>(\`/me/hangouts?role=${role}\`)` — `{data}` БЕЗ meta (пагінації немає); Task 3 типи (`HANGOUT_STATUS_LABELS`, `creatorId`); `apiVoid('/hangouts/:id/cancel' | '/hangouts/:id/leave', {method:'POST'})`.
- Produces: `HangoutActions({ hangoutId, isCreator, canLeave }: { hangoutId: string; isCreator: boolean; canLeave: boolean })` — кнопки «Скасувати» (isCreator і статус open/filled) / «Покинути» (canLeave); успіх → `router.refresh()`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend-final/src/components/features/hangouts/__tests__/hangout-actions.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { HangoutActions } from '@/components/features/hangouts/hangout-actions'
import type { SessionUser } from '@/types/user'

afterEach(() => vi.unstubAllGlobals())

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }))

const testUser: SessionUser = { id: 'u1', email: 'a@b.c', roles: ['user'] }

function apiCalls() {
  return (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
    ([u]) => !String(u).endsWith('/auth/me'),
  )
}

describe('HangoutActions', () => {
  it('творець → «Скасувати» → POST /hangouts/h1/cancel → refresh', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ data: {} }), { status: 200, headers: { 'content-type': 'application/json' } })
    }))
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider>
          <HangoutActions hangoutId="h1" isCreator canLeave={false} />
        </ToastProvider>
      </UserProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Скасувати/i }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    const call = apiCalls()[0]
    expect(String(call[0])).toBe('/api/v1/hangouts/h1/cancel')
    expect((call[1] as RequestInit).method).toBe('POST')
  })

  it('учасник → «Покинути» → POST /hangouts/h2/leave', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(null, { status: 200 })
    }))
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider>
          <HangoutActions hangoutId="h2" isCreator={false} canLeave />
        </ToastProvider>
      </UserProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Покинути/i }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(String(apiCalls()[0][0])).toBe('/api/v1/hangouts/h2/leave')
  })

  it('помилка → toast, без refresh', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Тільки творець може скасувати' } }), { status: 403, headers: { 'content-type': 'application/json' } })
    }))
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider>
          <HangoutActions hangoutId="h3" isCreator canLeave={false} />
        </ToastProvider>
      </UserProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Скасувати/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/тільки творець/i))
    expect(refresh).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails** — `pnpm vitest run src/components/features/hangouts/__tests__/hangout-actions.test.tsx` → FAIL.
- [ ] **Step 3: Implement**

```tsx
// frontend-final/src/components/features/hangouts/hangout-actions.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { apiVoid } from '@/lib/api/client'
import { ApiError } from '@/lib/api/parse'

export function HangoutActions({ hangoutId, isCreator, canLeave }: { hangoutId: string; isCreator: boolean; canLeave: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState<'cancel' | 'leave' | null>(null)

  async function act(kind: 'cancel' | 'leave') {
    setBusy(true)
    try {
      await apiVoid(`/hangouts/${hangoutId}/${kind}`, { method: 'POST' })
      setConfirming(null)
      router.refresh()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Не вдалося виконати дію', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!isCreator && !canLeave) return null
  return (
    <>
      {isCreator && (
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => setConfirming('cancel')}>Скасувати</Button>
      )}
      {canLeave && (
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming('leave')}>Покинути</Button>
      )}
      <Modal open={confirming === 'cancel'} onClose={() => setConfirming(null)} title="Скасувати зустріч?">
        <p className="text-stone-600">Заявку буде скасовано для всіх учасників.</p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => setConfirming(null)}>Скасувати дію</Button>
          <Button onClick={() => act('cancel')} disabled={busy}>Так, скасувати зустріч</Button>
        </div>
      </Modal>
      <Modal open={confirming === 'leave'} onClose={() => setConfirming(null)} title="Покинути зустріч?">
        <p className="text-stone-600">Ви покинете зустріч.</p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => setConfirming(null)}>Скасувати</Button>
          <Button onClick={() => act('leave')} disabled={busy}>Так, покинути</Button>
        </div>
      </Modal>
    </>
  )
}
```

Сторінка (`/account/hangouts/page.tsx`):

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { HangoutActions } from '@/components/features/hangouts/hangout-actions'
import { serverFetch } from '@/lib/api/server-client'
import { getSessionTokens } from '@/lib/auth/session'
import { parseHangout, HANGOUT_STATUS_LABELS, type RawHangout, type HangoutStatus } from '@/types/hangout'
import { formatMoney } from '@/lib/utils/format'
import type { SessionUser } from '@/types/user'

const ROLES = ['created', 'joined', 'all'] as const

interface Props {
  searchParams: Promise<{ role?: string }>
}

export default async function MyHangoutsPage({ searchParams }: Props) {
  const tokens = await getSessionTokens()
  if (!tokens) redirect('/auth/login?next=/account/hangouts')
  const sp = await searchParams
  const role = ROLES.includes(sp?.role as typeof ROLES[number]) ? (sp?.role as typeof ROLES[number]) : 'created'

  const raw = await serverFetch<RawHangout[]>(`/me/hangouts?role=${role}`, { tokens, revalidate: 0 })
  const hangouts = raw.map(parseHangout)
  const user = await serverFetch<SessionUser>('/auth/me', { tokens, revalidate: 0 })

  return (
    <section>
      <nav className="mb-4 flex gap-3 text-sm" aria-label="Роль у зустрічах">
        {ROLES.map((r) => (
          <Link
            key={r}
            href={`/account/hangouts?role=${r}`}
            className={r === role ? 'font-semibold text-brand-600' : 'text-stone-600 hover:text-brand-600'}
          >
            {r === 'created' ? 'Створені мною' : r === 'joined' ? 'Приєднані' : 'Усі'}
          </Link>
        ))}
      </nav>
      {hangouts.length === 0 ? (
        <div className="rounded-xl bg-stone-50 p-8 text-center">
          <p className="text-stone-500">Зустрічей немає.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {hangouts.map((h) => {
            const isCreator = h.creatorId === user.id
            return (
              <li key={h.id} className="rounded-xl border border-stone-200 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium">{h.date} · {h.time}</span>
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{HANGOUT_STATUS_LABELS[h.status as HangoutStatus]}</span>
                  <Link className="ml-auto text-sm text-brand-600 hover:underline" href={`/hangouts/${h.id}`}>Деталі</Link>
                </div>
                <p className="mt-2 text-stone-700">{h.purpose}</p>
                <p className="mt-1 text-sm text-stone-500">
                  {h.gender === 'any' ? 'Будь-хто' : h.gender === 'male' ? 'Чоловіки' : 'Жінки'} · до {h.groupSize} осіб · {h.payer === 'me' ? 'Плачу я' : h.payer === 'split' ? 'Порівну' : 'Платить компанія'}{h.desiredBudget !== null ? ` · бюджет ${formatMoney(h.desiredBudget)}` : ''}
                </p>
                <div className="mt-3">
                  <HangoutActions hangoutId={h.id} isCreator={isCreator} canLeave={!isCreator && h.status !== 'cancelled' && h.status !== 'completed'} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
```

⚠️ Статус-лейбли гендер/пейер — константи з `@/lib/validation/hangout` (`HANGOUT_GENDERS`, `HANGOUT_PAYERS`) реюзнути замість inline-тернарників, якщо зручніше. Гостьова сесія неможлива (layout-guard). Nav: «Пиячки» → `/account/hangouts`.

- [ ] **Step 4: Run tests** — `pnpm vitest run src/components/features/hangouts/__tests__/hangout-actions.test.tsx` → PASS; `pnpm test && pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Commit**

```bash
git add src/app/account/hangouts/page.tsx src/components/features/hangouts/hangout-actions.tsx src/components/features/hangouts/__tests__/hangout-actions.test.tsx src/app/account/layout.tsx
git commit -m "feat: /account/hangouts — role-таби, скасування/покинути

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7 (frontend): `/account/venues` — мої заклади

**Files:**
- Create: `frontend-final/src/app/account/venues/page.tsx`
- Modify: `frontend-final/src/app/account/layout.tsx` (nav + «Заклади»)
- Test: `frontend-final/src/app/account/venues/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: Task 1 `GET /me/venues` (`serverFetch<RawVenue[]>`, relations `photos`), `parseVenue` (photos → `VenuePhoto[]`).
- Produces: сторінка-список; картка веде на `/account/venues/[id]` (Task 9); кнопка «Додати заклад» → `/venues/new`.

- [ ] **Step 1: Write the failing test (серверна сторінка, патерн `venues/__tests__/page.test.ts` — мок `serverFetch` через vi.mock)**

```ts
// frontend-final/src/app/account/venues/__tests__/page.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/session', () => ({
  getSessionTokens: vi.fn(async () => ({ accessToken: 'a', refreshToken: 'r' })),
}))

const serverFetch = vi.fn()
vi.mock('@/lib/api/server-client', () => ({
  serverFetch: (...args: unknown[]) => serverFetch(...args),
}))

vi.mock('next/navigation', () => ({ redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }) }))

import MyVenuesPage from '@/app/account/venues/page'

const rawVenue = {
  id: 'v1', ownerId: 'u1', name: 'Бар «Пиво»', description: null, address: 'вул. Липова, 1',
  latitude: '50.45', longitude: '30.52', contacts: {}, workingHours: {}, averageCheck: '250',
  mainPhotoUrl: null, status: 'pending', ratingAvg: '4.5', ratingCount: 2, viewCount: 10,
  createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z', photos: [],
}

describe('/account/venues', () => {
  beforeEach(() => {
    serverFetch.mockReset()
    serverFetch.mockResolvedValue({ data: [rawVenue] })
  })

  it('рендерить картки зі статусом', async () => {
    const html = await MyVenuesPage({ searchParams: Promise.resolve({}) })
    expect(typeof html).toBe('object') // JSX; докладні перевірки — через react-dom/server
    expect(serverFetch).toHaveBeenCalledWith('/me/venues', { tokens: { accessToken: 'a', refreshToken: 'r' }, revalidate: 0 })
  })

  it('порожньо → CTA на /venues/new', async () => {
    serverFetch.mockResolvedValue({ data: [] })
    const html = String(await MyVenuesPage({ searchParams: Promise.resolve({}) }))
    expect(html).toContain('/venues/new')
    expect(html).toContain('поки немає закладів')
  })
})
```

⚠️ Для JSX-перевірок використати `react-dom/server` `renderToStaticMarkup` (якщо в інших серверних тестах Плану 1/2 застосований інший підхід — наслідувати його; перевірки: статус-бейдж «На модерації» присутній для pending, лінк `/account/venues/v1` присутній).

- [ ] **Step 2: Run test to verify it fails** — `pnpm vitest run src/app/account/venues/__tests__/page.test.ts` → FAIL.
- [ ] **Step 3: Implement**

```tsx
// frontend-final/src/app/account/venues/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { serverFetch } from '@/lib/api/server-client'
import { getSessionTokens } from '@/lib/auth/session'
import { parseVenue, type RawVenue } from '@/types/venue'

const STATUS_LABELS: Record<string, string> = {
  pending: 'На модерації',
  approved: 'Схвалений',
  rejected: 'Відхилено',
  archived: 'Заархівовано',
}

export default async function MyVenuesPage() {
  const tokens = await getSessionTokens()
  if (!tokens) redirect('/auth/login?next=/account/venues')
  const raw = await serverFetch<RawVenue[]>('/me/venues', { tokens, revalidate: 0 })
  const venues = raw.map(parseVenue)

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Мої заклади</h2>
        <Link className="text-brand-600 hover:underline" href="/venues/new">Додати заклад</Link>
      </div>
      {venues.length === 0 ? (
        <div className="rounded-xl bg-stone-50 p-8 text-center">
          <p className="text-stone-500">Закладів поки немає.</p>
          <Link className="mt-4 inline-block text-brand-600 hover:underline" href="/venues/new">Подати перший заклад</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {venues.map((v) => (
            <li key={v.id} className="flex items-center gap-4 rounded-xl border border-stone-200 p-4">
              <div className="min-w-0 flex-1">
                <Link className="font-medium hover:underline" href={`/account/venues/${v.id}`}>{v.name}</Link>
                <p className="truncate text-sm text-stone-500">{v.address}</p>
              </div>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{STATUS_LABELS[v.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

Nav: «Заклади» → `/account/venues`.

- [ ] **Step 4: Run tests** — PASS; `pnpm test && pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Commit**

```bash
git add src/app/account/venues/page.tsx src/app/account/venues/__tests__/page.test.ts src/app/account/layout.tsx
git commit -m "feat: /account/venues — мої заклади зі статусами

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 8 (frontend): `/venues/new` — форма створення закладу

**Files:**
- Create: `frontend-final/src/app/venues/new/page.tsx`
- Create: `frontend-final/src/components/features/venues/venue-create-form.tsx`
- Test: `frontend-final/src/components/features/venues/__tests__/venue-create-form.test.tsx`, `frontend-final/src/app/venues/new/__tests__/page.test.ts`

**Interfaces:**
- Consumes: Task 3 (`venueCreateSchema`, `WH_DAYS`, `csvToArray`); `api()` POST `/venues` (→ 201 `{data: Venue}`); `serverFetch`/`getSessionTokens` (guard).
- Produces: `VenueCreateForm()` — успіх → `router.push('/account/venues?created=1')`. Сторінка `/account/venues` у Task 7 **не** показує банер — додати його тут НЕМОЖЛИВО; банер у Task 7 сторінці не передбачений, тому Task 8 Модифікує `src/app/account/venues/page.tsx`: при `searchParams.created === '1'` — банер «Заклад подано на модерацію» + не передавати `created` далі в лінки.

- [ ] **Step 1: Write the failing test (форма)**

```tsx
// frontend-final/src/components/features/venues/__tests__/venue-create-form.test.tsx
import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { VenueCreateForm } from '@/components/features/venues/venue-create-form'
import type { SessionUser } from '@/types/user'

afterEach(() => vi.unstubAllGlobals())

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))

const testUser: SessionUser = { id: 'u1', email: 'a@b.c', roles: ['user'] }

function renderForm(ui: ReactNode) {
  return render(
    <UserProvider initialUser={testUser}>
      <ToastProvider>{ui}</ToastProvider>
    </UserProvider>,
  )
}

function apiCalls() {
  return (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
    ([u]) => !String(u).endsWith('/auth/me'),
  )
}

describe('VenueCreateForm', () => {
  it('сабміт → POST /venues з DTO-полями → redirect /account/venues?created=1', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ data: { id: 'v9' } }), { status: 201, headers: { 'content-type': 'application/json' } })
    }))
    renderForm(<VenueCreateForm />)
    fireEvent.change(screen.getByLabelText(/^Назва$/i), { target: { value: 'Бар «Пиво»' } })
    fireEvent.change(screen.getByLabelText(/^Адреса$/i), { target: { value: 'вул. Липова, 1' } })
    fireEvent.change(screen.getByLabelText(/^Теги/i), { target: { value: 'pyvo, live' } })
    fireEvent.click(screen.getByRole('button', { name: /Подати/i }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/account/venues?created=1'))
    const call = apiCalls()[0]
    expect(String(call[0])).toBe('/api/v1/venues')
    expect((call[1] as RequestInit).method).toBe('POST')
    const body = JSON.parse((call[1] as RequestInit).body as string)
    expect(body.name).toBe('Бар «Пиво»')
    expect(body.tagSlugs).toEqual(['pyvo', 'live'])
  })

  it('name <3 → інлайн-помилка, без POST', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(null, { status: 500 })
    }))
    renderForm(<VenueCreateForm />)
    fireEvent.change(screen.getByLabelText(/^Назва$/i), { target: { value: 'Ба' } })
    fireEvent.change(screen.getByLabelText(/^Адреса$/i), { target: { value: 'вул. Липова, 1' } })
    fireEvent.click(screen.getByRole('button', { name: /Подати/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/мінімум 3/i))
    expect(apiCalls().length).toBe(0)
  })

  it('400 від бекенда (валідація «; ») → показ повідомлення', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'averageCheck must not be less than 0' } }), { status: 400, headers: { 'content-type': 'application/json' } })
    }))
    renderForm(<VenueCreateForm />)
    fireEvent.change(screen.getByLabelText(/^Назва$/i), { target: { value: 'Бар «Пиво»' } })
    fireEvent.change(screen.getByLabelText(/^Адреса$/i), { target: { value: 'вул. Липова, 1' } })
    fireEvent.click(screen.getByRole('button', { name: /Подати/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/averageCheck/i))
  })
})
```

- [ ] **Step 2: Run test to verify it fails** — `pnpm vitest run src/components/features/venues/__tests__/venue-create-form.test.tsx` → FAIL.
- [ ] **Step 3: Implement**

```tsx
// frontend-final/src/components/features/venues/venue-create-form.tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api/client'
import { ApiError } from '@/lib/api/parse'
import { venueCreateSchema, WH_DAYS, csvToArray } from '@/lib/validation/venue'

const DAY_LABELS: Record<string, string> = {
  monday: 'Понеділок', tuesday: 'Вівторок', wednesday: 'Середа', thursday: 'Четвер',
  friday: 'Пʼятниця', saturday: 'Субота', sunday: 'Неділя',
}

export function VenueCreateForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [phone, setPhone] = useState('')
  const [instagram, setInstagram] = useState('')
  const [facebook, setFacebook] = useState('')
  const [website, setWebsite] = useState('')
  const [hours, setHours] = useState<Record<string, string>>({})
  const [averageCheck, setAverageCheck] = useState('')
  const [featureCodes, setFeatureCodes] = useState('')
  const [tagSlugs, setTagSlugs] = useState('')
  const [typeSlug, setTypeSlug] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const workingHours = Object.fromEntries(
      Object.entries(hours).filter(([, v]) => v.trim()),
    )
    const dto = {
      name,
      address,
      description: description.trim() || undefined,
      latitude: latitude.trim() ? Number(latitude) : undefined,
      longitude: longitude.trim() ? Number(longitude) : undefined,
      contacts: (phone.trim() || instagram.trim() || facebook.trim() || website.trim())
        ? {
            ...(phone.trim() ? { phone } : {}),
            ...(instagram.trim() ? { instagram } : {}),
            ...(facebook.trim() ? { facebook } : {}),
            ...(website.trim() ? { website } : {}),
          }
        : undefined,
      workingHours: Object.keys(workingHours).length ? workingHours : undefined,
      averageCheck: averageCheck.trim() ? Number(averageCheck) : undefined,
      featureCodes: csvToArray(featureCodes).length ? csvToArray(featureCodes) : undefined,
      tagSlugs: csvToArray(tagSlugs).length ? csvToArray(tagSlugs) : undefined,
      typeSlug: typeSlug.trim() || undefined,
    }
    const parsed = venueCreateSchema.safeParse(dto)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Перевірте поля')
      return
    }
    setSending(true)
    try {
      await api('/venues', { method: 'POST', body: JSON.stringify(parsed.data) })
      router.push('/account/venues?created=1')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося подати заклад')
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="Створення закладу">
      {/* Поля: Назва*, Адреса*, Опис, Широта, Довгота, Контакти (4), Години (7 днів, «HH:MM-HH:MM»), Середній чек, Фічі (CSV), Теги (CSV), Тип */}
      <label className="block text-sm font-medium">Назва
        <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full" />
      </label>
      <label className="block text-sm font-medium">Адреса
        <Input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1 w-full" />
      </label>
      <label className="block text-sm font-medium">Опис
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">Широта
          <Input value={latitude} onChange={(e) => setLatitude(e.target.value)} className="mt-1 w-full" inputMode="decimal" />
        </label>
        <label className="block text-sm font-medium">Довгота
          <Input value={longitude} onChange={(e) => setLongitude(e.target.value)} className="mt-1 w-full" inputMode="decimal" />
        </label>
      </div>
      <fieldset className="rounded-xl border border-stone-200 p-3">
        <legend className="px-1 text-sm font-medium">Контакти</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон" aria-label="Телефон" />
          <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="Instagram" aria-label="Instagram" />
          <Input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="Facebook" aria-label="Facebook" />
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Сайт" aria-label="Сайт" />
        </div>
      </fieldset>
      <fieldset className="rounded-xl border border-stone-200 p-3">
        <legend className="px-1 text-sm font-medium">Години роботи (формат HH:MM-HH:MM, порожнє — вихідний)</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {WH_DAYS.map((d) => (
            <label key={d} className="block text-xs text-stone-500">
              {DAY_LABELS[d]}
              <Input
                value={hours[d] ?? ''}
                onChange={(e) => setHours((h) => ({ ...h, [d]: e.target.value }))}
                placeholder="10:00-22:00"
                aria-label={`Години: ${DAY_LABELS[d]}`}
                className="mt-0.5 w-full"
              />
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-medium">Середній чек (₴)
        <Input type="number" min="0" value={averageCheck} onChange={(e) => setAverageCheck(e.target.value)} className="mt-1 w-full" />
      </label>
      <label className="block text-sm font-medium">Фічі (через кому, до 20)
        <Input value={featureCodes} onChange={(e) => setFeatureCodes(e.target.value)} className="mt-1 w-full" />
      </label>
      <label className="block text-sm font-medium">Теги (через кому, до 20)
        <Input value={tagSlugs} onChange={(e) => setTagSlugs(e.target.value)} className="mt-1 w-full" />
      </label>
      <label className="block text-sm font-medium">Тип (slug)
        <Input value={typeSlug} onChange={(e) => setTypeSlug(e.target.value)} className="mt-1 w-full" />
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={sending}>{sending ? 'Подаємо…' : 'Подати заклад'}</Button>
      <p className="text-sm text-stone-500">Заклад буде відправлено на модерацію.</p>
    </form>
  )
}
```

Сторінка з guard + Modify `/account/venues/page.tsx` (банер created):

```tsx
// frontend-final/src/app/venues/new/page.tsx
import { redirect } from 'next/navigation'
import { VenueCreateForm } from '@/components/features/venues/venue-create-form'
import { getSessionTokens } from '@/lib/auth/session'

export const metadata = { title: 'Новий заклад — Пиячок' }

export default async function NewVenuePage() {
  const tokens = await getSessionTokens()
  if (!tokens) redirect('/auth/login?next=/venues/new')
  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="mb-4 text-2xl font-bold">Подати заклад</h1>
      <VenueCreateForm />
    </div>
  )
}
```

У `/account/venues/page.tsx` — прийняти `Props { searchParams: Promise<{ created?: string }> }`, при `created === '1'` рендерити банер `<p role="status" className="rounded-xl bg-green-50 p-3 text-green-700">Заклад подано на модерацію.</p>`.

- [ ] **Step 4: Run tests** — форма PASS; серверний тест сторінки `src/app/venues/new/__tests__/page.test.ts` (guard: без токенів → `REDIRECT:/auth/login?next=/venues/new`, патерн `venues/__tests__/page.test.ts`); `pnpm test && pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Commit**

```bash
git add src/app/venues/new/page.tsx src/app/venues/new/__tests__/page.test.ts src/components/features/venues/venue-create-form.tsx src/components/features/venues/__tests__/venue-create-form.test.tsx src/app/account/venues/page.tsx
git commit -m "feat: /venues/new — форма CreateVenueDto з модераційним редіректом

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

### Task 9 (frontend): `/account/venues/[id]` — shell з вкладками + Редагування

**Files:**
- Create: `frontend-final/src/app/account/venues/[id]/page.tsx`
- Create: `frontend-final/src/components/features/account/venue-edit-form.tsx`
- Modify: `frontend-final/src/app/account/venues/[id]/not-found.tsx` (Create — «Заклад не знайдено» для власника)
- Test: `frontend-final/src/components/features/account/__tests__/venue-edit-form.test.tsx`, `frontend-final/src/app/account/venues/[id]/__tests__/page.test.ts`

**Interfaces:**
- Consumes: Task 2 `GET /me/venues/:id` (`serverFetch<RawVenue>`, tokens, `revalidate: 0`; помилка → notFound); Task 3 `venueUpdateSchema`; `api()` PATCH `/venues/:id`.
- Produces: вкладки `?tab=edit|photos|news|analytics` (default `edit`); `VenueEditForm({ venue }: { venue: Venue })` — PATCH → toast + `router.refresh()`.

- [ ] **Step 1: Write the failing test (форма редагування)** — патерн Task 8 (UserProvider+ToastProvider, `apiCalls`):

Ключові твердження (тести аналогічні `venue-create-form.test.tsx`):
1. Префіл: поля містять `venue.name`, `venue.address`, `venue.contacts.phone`, перший день `venue.workingHours.monday`.
2. Зміна name → сабміт → `PATCH /api/v1/venues/{venue.id}` з body, що містить **лише змінені/непорожні DTO-поля** (наприклад `{name}`), → toast + refresh.
3. name <3 → інлайн-помилка, без PATCH.
4. 403 → інлайн «Немає доступу» (текст з ApiError).

```tsx
// frontend-final/src/components/features/account/__tests__/venue-edit-form.test.tsx (якірні фрагменти)
const venue: Venue = { /* parseVenue(rawVenue з Task 7) + photos: [], features: [], tags: [], types: [] */ }

it('сабміт → PATCH /venues/{id}', async () => {
  // ... fill name 'Оновлена назва'
  const call = apiCalls()[0]
  expect(String(call[0])).toBe('/api/v1/venues/v1')
  expect((call[1] as RequestInit).method).toBe('PATCH')
})
```

- [ ] **Step 2: Run test to verify it fails** → FAIL.
- [ ] **Step 3: Implement**

`VenueEditForm` — та сама структура полів, що `VenueCreateForm` (name, address, description, lat/lng, contacts×4, hours×7, averageCheck; **без** фіч/тегів/типу — `PATCH` їх ігнорує, тому поля не показуємо, а поточні значення відображаємо чипами read-only), сабміт:

```ts
    const dto: Record<string, unknown> = {}
    if (name !== venue.name) dto.name = name
    if (address !== venue.address) dto.address = address
    if (description !== (venue.description ?? '')) dto.description = description.trim() || undefined
    // ... lat/lng/contacts/hours/averageCheck — тільки коли значення змінилось або вперше заповнене
    const parsed = venueUpdateSchema.safeParse(dto)
    if (!parsed.success) { setError(...); return }
    if (Object.keys(parsed.data).length === 0) { setError('Немає змін'); return }
    await api(`/venues/${venue.id}`, { method: 'PATCH', body: JSON.stringify(parsed.data) })
    toast('Зміни збережено')
    router.refresh()
```

Сторінка-оболонка:

```tsx
// frontend-final/src/app/account/venues/[id]/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { VenueEditForm } from '@/components/features/account/venue-edit-form'
import { VenuePhotoManager } from '@/components/features/account/venue-photo-manager'
import { VenueNewsManager } from '@/components/features/account/venue-news-manager'
import { VenueAnalytics } from '@/components/features/account/venue-analytics'
import { serverFetch } from '@/lib/api/server-client'
import { getSessionTokens } from '@/lib/auth/session'
import { parseVenue, type RawVenue } from '@/types/venue'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

const TABS = [
  { key: 'edit', label: 'Редагування' },
  { key: 'photos', label: 'Фото' },
  { key: 'news', label: 'Новини' },
  { key: 'analytics', label: 'Аналітика' },
] as const

export default async function ManageVenuePage({ params, searchParams }: Props) {
  const tokens = await getSessionTokens()
  if (!tokens) redirect('/auth/login?next=/account/venues')
  const { id } = await params
  const raw = await serverFetch<RawVenue>(`/me/venues/${id}`, { tokens, revalidate: 0 }).catch(() => null)
  if (!raw) notFound()
  const venue = parseVenue(raw)

  const sp = await searchParams
  const tab = TABS.some((t) => t.key === sp?.tab) ? (sp!.tab as (typeof TABS)[number]['key']) : 'edit'

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-semibold">{venue.name}</h2>
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{venue.status}</span>
        <Link className="ml-auto text-sm text-brand-600 hover:underline" href={`/venues/${venue.id}`}>Публічна сторінка</Link>
      </div>
      <nav className="mb-4 flex gap-3 border-b border-stone-200 pb-2 text-sm" aria-label="Керування закладом">
        {TABS.map((t) => (
          <Link key={t.key} href={`/account/venues/${venue.id}?tab=${t.key}`}
            className={t.key === tab ? 'font-semibold text-brand-600' : 'text-stone-600 hover:text-brand-600'}>
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === 'edit' && <VenueEditForm venue={venue} />}
      {tab === 'photos' && <VenuePhotoManager venueId={venue.id} photos={venue.photos} />}
      {tab === 'news' && <VenueNewsManager venueId={venue.id} />}
      {tab === 'analytics' && <VenueAnalytics venueId={venue.id} />}
    </div>
  )
}
```

⚠️ `not-found.tsx` для цього роуту — простий глобальний suffices; створювати не обовʼязково (global not-found існує).

- [ ] **Step 4: Run tests** — форма + серверна сторінка (мок `serverFetch` → raw venue; `?tab=edit` → рендер VenueEditForm-контенту; невідомий tab → default) PASS; `pnpm test && pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Commit**

```bash
git add src/app/account/venues/[id]/page.tsx src/components/features/account/venue-edit-form.tsx src/components/features/account/__tests__/venue-edit-form.test.tsx src/app/account/venues/[id]/__tests__/page.test.ts
git commit -m "feat: /account/venues/[id] — вкладки керування + редагування полів (PATCH /venues/:id)

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 10 (frontend): вкладка «Фото» — завантаження і список

**Files:**
- Create: `frontend-final/src/components/features/account/venue-photo-manager.tsx`
- Test: `frontend-final/src/components/features/account/__tests__/venue-photo-manager.test.tsx`

**Interfaces:**
- Consumes: `api<{ url: string }>('/venues/:id/photos', { method: 'POST', body: FormData })` (multipart; поле `file`; відповідь `{data: {url}}`); `router.refresh()` перезавантажує серверні дані вкладки.
- Produces: `VenuePhotoManager({ venueId, photos }: { venueId: string; photos: VenuePhoto[] })`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend-final/src/components/features/account/__tests__/venue-photo-manager.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { VenuePhotoManager } from '@/components/features/account/venue-photo-manager'
import type { SessionUser } from '@/types/user'

afterEach(() => vi.unstubAllGlobals())

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }))

const testUser: SessionUser = { id: 'u1', email: 'a@b.c', roles: ['user'] }

function apiCalls() {
  return (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
    ([u]) => !String(u).endsWith('/auth/me'),
  )
}

const photos = [{ id: 'p1', url: '/static/a.jpg', sortOrder: 0 }]

describe('VenuePhotoManager', () => {
  it('список фото рендериться (img із src)', () => {
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider><VenuePhotoManager venueId="v1" photos={photos} /></ToastProvider>
      </UserProvider>,
    )
    expect(screen.getByRole('img')).toHaveAttribute('src', '/static/a.jpg')
  })

  it('вибір файлу → POST multipart на /venues/v1/photos → toast → refresh', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ data: { url: '/static/new.jpg' } }), { status: 201, headers: { 'content-type': 'application/json' } })
    }))
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider><VenuePhotoManager venueId="v1" photos={photos} /></ToastProvider>
      </UserProvider>,
    )
    const input = screen.getByLabelText(/додати фото/i) as HTMLInputElement
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/завантажено/i))
    const call = apiCalls().find(([, i]) => (i as RequestInit).method === 'POST')
    expect(String(call?.[0])).toBe('/api/v1/venues/v1/photos')
    expect((call?.[1] as RequestInit).body).toBeInstanceOf(FormData)
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('пояснення про бекенд-обмеження присутнє', () => {
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider><VenuePhotoManager venueId="v1" photos={[]} /></ToastProvider>
      </UserProvider>,
    )
    // Known limitation: завантажене фото може не з'явитись у галереї автоматично
    expect(screen.getByText(/може не з'явитись/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails** → FAIL.
- [ ] **Step 3: Implement**

```tsx
// frontend-final/src/components/features/account/venue-photo-manager.tsx
'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/api/client'
import { ApiError } from '@/lib/api/parse'
import type { VenuePhoto } from '@/types/venue'

export function VenuePhotoManager({ venueId, photos }: { venueId: string; photos: VenuePhoto[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function upload() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api(`/venues/${venueId}/photos`, { method: 'POST', body: fd })
      toast('Фото завантажено')
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Не вдалося завантажити фото', 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <section aria-label="Фото закладу">
      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Додати фото"
          className="text-sm"
        />
        <Button size="sm" onClick={upload} disabled={uploading}>
          {uploading ? 'Завантажуємо…' : 'Завантажити'}
        </Button>
      </div>
      <p className="mt-2 text-sm text-stone-500">
        Увага: завантажене фото може не з'явитись у публічній галереї автоматично (обмеження бекенда).
      </p>
      {photos.length === 0 ? (
        <p className="mt-4 text-sm text-stone-500">Фото ще немає.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-xl border border-stone-200">
              {/* eslint-disable-next-line @next/next/no-img-element -- зовнішній URL з бекенда */}
              <img src={p.url} alt="" loading="lazy" className="h-40 w-full object-cover" />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Run tests** — PASS; `pnpm test && pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Commit**

```bash
git add src/components/features/account/venue-photo-manager.tsx src/components/features/account/__tests__/venue-photo-manager.test.tsx
git commit -m "feat: вкладка фото — multipart upload + список з lazy-зображеннями

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

### Task 11 (frontend): вкладка «Новини» — управління новинами закладу

**Files:**
- Create: `frontend-final/src/components/features/account/venue-news-manager.tsx`
- Test: `frontend-final/src/components/features/account/__tests__/venue-news-manager.test.tsx`

**Interfaces:**
- Consumes: серверна вкладка фетчить список — у `page.tsx` з Task 9 додати для tab=news: `serverFetchList<RawNews>('/news?venueId=' + venueId, { tokens, revalidate: 0 })` (публічний список = only published; заархівовані зникають — задокументувати в UI hint); компонент споживає `news: News[]`. Task 3 `newsFormSchema`, `NEWS_CATEGORIES`.
- Produces: `VenueNewsManager({ venueId, news }: { venueId: string; news: News[] })`; сабміт → `POST /me/venues/:venueId/news` (**без `venueId` у body**), редагування → `PATCH /news/:id`, видалення → `DELETE /news/:id` (`apiVoid` — тіло `{data}` tolerated); усі → `router.refresh()`.

- [ ] **Step 1: Write the failing test** — патерн Task 8/9. Ключові твердження:
1. Список рендерить заголовки новин.
2. Форма: категорія (select), title, content, imageUrl → сабміт → `POST /api/v1/me/venues/v1/news` з `{category, title, content}` (без venueId) → toast + refresh.
3. Редагування: кнопка на елементі → модалка з префілами → `PATCH /api/v1/news/{id}`.
4. Видалення: confirm → `DELETE /api/v1/news/{id}`.
5. title <5 / content <20 → інлайн-помилка без POST.

```tsx
// frontend-final/src/components/features/account/__tests__/venue-news-manager.test.tsx (якірні фрагменти)
const news: News[] = [parseNews({ id: 'n1', venueId: 'v1', category: 'promo', title: 'Заголовок новини', content: 'Текст довший за двадцять символів', imageUrl: null, status: 'published', isPromoted: false, publishedAt: null, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' })]

it('створення → POST /me/venues/v1/news', async () => {
  // ...заповнити категорію/заголовок/текст, клік «Додати новину»
  const call = apiCalls().find(([, i]) => (i as RequestInit).method === 'POST')
  expect(String(call?.[0])).toBe('/api/v1/me/venues/v1/news')
  const body = JSON.parse((call?.[1] as RequestInit).body as string)
  expect(body.venueId).toBeUndefined()
  expect(body.category).toBe('promo')
})

it('видалення → DELETE /news/n1', async () => {
  fireEvent.click(screen.getByRole('button', { name: /видалити/i }))
  fireEvent.click(await screen.findByRole('button', { name: /так, видалити/i }))
  const del = apiCalls().find(([, i]) => (i as RequestInit).method === 'DELETE')
  expect(String(del?.[0])).toBe('/api/v1/news/n1')
})
```

- [ ] **Step 2: Run test to verify it fails** → FAIL.
- [ ] **Step 3: Implement** — один клієнтський компонент із трьома станами (створення/редагування/видалення), структура аналогічна `MyReviewItem` + `VenueCreateForm`:

```tsx
// frontend-final/src/components/features/account/venue-news-manager.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { api, apiVoid } from '@/lib/api/client'
import { ApiError } from '@/lib/api/parse'
import { NEWS_CATEGORIES, newsFormSchema } from '@/lib/validation/news'
import { formatDate } from '@/lib/utils/format'
import type { News } from '@/types/news'

export function VenueNewsManager({ venueId, news }: { venueId: string; news: News[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [category, setCategory] = useState<'general' | 'promo' | 'event'>('general')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [editing, setEditing] = useState<News | null>(null)
  const [deleting, setDeleting] = useState<News | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = newsFormSchema.safeParse({
      category, title, content, ...(imageUrl.trim() ? { imageUrl } : {}),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Перевірте поля')
      return
    }
    setSending(true)
    try {
      await api(`/me/venues/${venueId}/news`, { method: 'POST', body: JSON.stringify(parsed.data) })
      toast('Новину додано')
      setTitle(''); setContent(''); setImageUrl('')
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося додати новину')
    } finally {
      setSending(false)
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    const parsed = newsFormSchema.safeParse({
      category: editing.category, title: editing.title, content: editing.content,
    })
    if (!parsed.success) { toast(parsed.error.issues[0]?.message ?? 'Перевірте поля', 'error'); return }
    try {
      await api(`/news/${editing.id}`, { method: 'PATCH', body: JSON.stringify(parsed.data) })
      toast('Новину оновлено')
      setEditing(null)
      router.refresh()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не вдалося оновити новину', 'error')
    }
  }

  async function remove() {
    if (!deleting) return
    try {
      await apiVoid(`/news/${deleting.id}`, { method: 'DELETE' })
      setDeleting(null)
      router.refresh()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не вдалося видалити новину', 'error')
    }
  }

  return (
    <section aria-label="Новини закладу">
      <form onSubmit={submit} className="space-y-2 rounded-xl border border-stone-200 p-4" aria-label="Нова новина">
        <Select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} aria-label="Категорія">
          {NEWS_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </Select>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок (від 5 символів)" aria-label="Заголовок новини" />
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Текст (від 20 символів)" aria-label="Текст новини" />
        <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="URL зображення (опційно)" aria-label="URL зображення" />
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={sending}>{sending ? 'Додаємо…' : 'Додати новину'}</Button>
      </form>

      {news.length === 0 ? (
        <p className="mt-4 text-sm text-stone-500">Новин у закладу ще немає.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {news.map((n) => (
            <li key={n.id} className="flex items-center gap-3 rounded-xl border border-stone-200 p-3">
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                {NEWS_CATEGORIES.find((c) => c.value === n.category)?.label}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{n.title}</span>
              {n.publishedAt && <span className="text-sm text-stone-500">{formatDate(n.publishedAt)}</span>}
              <Button variant="secondary" size="sm" onClick={() => setEditing(n)}>Редагувати</Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleting(n)}>Видалити</Button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Редагувати новину">
        {editing && (
          <form onSubmit={saveEdit} className="space-y-2">
            <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} aria-label="Заголовок новини" />
            <Textarea value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} aria-label="Текст новини" />
            <Button type="submit">Зберегти</Button>
          </form>
        )}
      </Modal>

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title="Видалити новину?">
        <p className="text-stone-600">Новина буде видалена (заархівована).</p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => setDeleting(null)}>Скасувати</Button>
          <Button onClick={remove}>Так, видалити</Button>
        </div>
      </Modal>
    </section>
  )
}
```

У `page.tsx` з Task 9 — tab=news отримує список (у серверній компоненті, перед пропом):

```ts
  const newsRaw = tab === 'news'
    ? (await serverFetchList<RawNews>(`/news?venueId=${venue.id}`, { tokens, revalidate: 0 })).data.map(parseNews)
    : []
```

- [ ] **Step 4: Run tests** — PASS; `pnpm test && pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Commit**

```bash
git add src/components/features/account/venue-news-manager.tsx src/components/features/account/__tests__/venue-news-manager.test.tsx "src/app/account/venues/[id]/page.tsx"
git commit -m "feat: вкладка новин закладу — створення/редагування/видалення

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 12 (frontend): вкладка «Аналітика» — SVG-графік без бібліотек

**Files:**
- Create: `frontend-final/src/components/features/account/venue-analytics.tsx`
- Create: `frontend-final/src/components/features/account/analytics-range-form.tsx`
- Test: `frontend-final/src/components/features/account/__tests__/venue-analytics.test.tsx`

**Interfaces:**
- Consumes: `serverFetch<RawVenueAnalytics>(\`/me/venues/:id/analytics?from=${from}&to=${to}\`, {tokens, revalidate: 0})`; Task 3 `parseVenueAnalytics`; URL-параметри `from`/`to` (YYYY-MM-DD), дефолт `to` = сьогодні, `from` = сьогодні − 30 днів.
- Produces: серверний `VenueAnalytics({ venueId, from, to }: { venueId: string; from: string; to: string })` — stat-плитка `totalViews`, SVG-барчарт `viewsByDay`, список `eventsByType`; клієнтський `AnalyticsRangeForm({ from, to })` → `router.push(?tab=analytics&from&to)`.

- [ ] **Step 1: Write the failing test (серверний рендер через renderToStaticMarkup + клієнтська форма)**

```tsx
// frontend-final/src/components/features/account/__tests__/venue-analytics.test.tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { VenueAnalytics } from '@/components/features/account/venue-analytics'

vi.mock('@/lib/auth/session', () => ({
  getSessionTokens: vi.fn(async () => ({ accessToken: 'a', refreshToken: 'r' })),
}))
const serverFetch = vi.fn()
vi.mock('@/lib/api/server-client', () => ({ serverFetch: (...args: unknown[]) => serverFetch(...args) }))

describe('VenueAnalytics (server)', () => {
  it('рендер stat-плитки, SVG-барів і eventsByType', async () => {
    serverFetch.mockResolvedValue({
      totalViews: 42,
      viewsByDay: [{ date: '2026-09-09', count: 12 }, { date: '2026-09-10', count: 30 }],
      eventsByType: [{ eventType: 'venue_view', count: 30 }, { eventType: 'review_create', count: 2 }],
    })
    const html = renderToStaticMarkup(
      await VenueAnalytics({ venueId: 'v1', from: '2026-09-01', to: '2026-09-10' }),
    )
    expect(html).toContain('42')
    expect(html).toContain('<svg')
    expect(html).toContain('venue_view')
    expect(serverFetch).toHaveBeenCalledWith('/me/venues/v1/analytics?from=2026-09-01&to=2026-09-10', expect.anything())
  })

  it('порожні дані → «Немає даних»', async () => {
    serverFetch.mockResolvedValue({ totalViews: 0, viewsByDay: [], eventsByType: [] })
    const html = renderToStaticMarkup(
      await VenueAnalytics({ venueId: 'v1', from: '2026-09-01', to: '2026-09-10' }),
    )
    expect(html).toContain('Немає даних')
  })
})
```

- [ ] **Step 2: Run test to verify it fails** → FAIL.
- [ ] **Step 3: Implement**

```tsx
// frontend-final/src/components/features/account/venue-analytics.tsx
import { serverFetch } from '@/lib/api/server-client'
import { parseVenueAnalytics, type RawVenueAnalytics } from '@/types/analytics'
import { AnalyticsRangeForm } from '@/components/features/account/analytics-range-form'
import { getSessionTokens } from '@/lib/auth/session'

export async function VenueAnalytics({ venueId, from, to }: { venueId: string; from: string; to: string }) {
  const tokens = await getSessionTokens()
  const raw = await serverFetch<RawVenueAnalytics>(`/me/venues/${venueId}/analytics?from=${from}&to=${to}`, {
    tokens, revalidate: 0,
  }).catch(() => null)
  if (!raw) {
    return <p className="text-sm text-red-600">Не вдалося завантажити аналітику.</p>
  }
  const a = parseVenueAnalytics(raw)
  const max = Math.max(1, ...a.viewsByDay.map((d) => d.count))

  return (
    <section aria-label="Аналітика закладу">
      <AnalyticsRangeForm from={from} to={to} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-stone-200 p-4">
          <p className="text-sm text-stone-500">Перегляди за період</p>
          <p className="text-2xl font-bold">{a.totalViews}</p>
        </div>
        <div className="rounded-xl border border-stone-200 p-4">
          <p className="text-sm text-stone-500">Події за типами</p>
          {a.eventsByType.length === 0 ? (
            <p className="mt-1 text-sm text-stone-500">Немає даних</p>
          ) : (
            <ul className="mt-1 text-sm">
              {a.eventsByType.map((e) => (
                <li key={e.eventType} className="flex justify-between">
                  <span>{e.eventType}</span><span>{e.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-stone-200 p-4">
        <p className="mb-2 text-sm text-stone-500">Перегляди за днями</p>
        {a.viewsByDay.length === 0 ? (
          <p className="text-sm text-stone-500">Немає даних</p>
        ) : (
          <svg viewBox={`0 0 ${a.viewsByDay.length * 24} 100`} className="h-32 w-full" role="img" aria-label="Графік переглядів за днями">
            {a.viewsByDay.map((d, i) => (
              <rect
                key={d.date}
                x={i * 24 + 4}
                y={100 - (d.count / max) * 90}
                width={16}
                height={(d.count / max) * 90}
                rx={2}
                className="fill-brand-500"
              >
                <title>{`${d.date}: ${d.count}`}</title>
              </rect>
            ))}
          </svg>
        )}
      </div>
    </section>
  )
}
```

```tsx
// frontend-final/src/components/features/account/analytics-range-form.tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function AnalyticsRangeForm({ from, to }: { from: string; to: string }) {
  const router = useRouter()
  const [f, setF] = useState(from)
  const [t, setT] = useState(to)

  function apply(e: React.FormEvent) {
    e.preventDefault()
    if (!f || !t || f > t) return
    router.push(`?tab=analytics&from=${f}&to=${t}`)
  }

  return (
    <form onSubmit={apply} className="flex items-end gap-2" aria-label="Період аналітики">
      <label className="block text-sm">З
        <Input type="date" value={f} onChange={(e) => setF(e.target.value)} className="mt-0.5 block" />
      </label>
      <label className="block text-sm">По
        <Input type="date" value={t} onChange={(e) => setT(e.target.value)} className="mt-0.5 block" />
      </label>
      <Button variant="secondary" size="sm" type="submit">Оновити</Button>
    </form>
  )
}
```

У `page.tsx` з Task 9 — tab=analytics: обчислити `from`/`to` з searchParams (дефолт: `to` = сьогодні за `en-CA`-форматом, `from` = `to` − 30 днів через `new Date(Date.now() - 30*86400000)`) і передати у `VenueAnalytics`.

- [ ] **Step 4: Run tests** — PASS; `pnpm test && pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Commit**

```bash
git add src/components/features/account/venue-analytics.tsx src/components/features/account/analytics-range-form.tsx src/components/features/account/__tests__/venue-analytics.test.tsx "src/app/account/venues/[id]/page.tsx"
git commit -m "feat: вкладка аналітики — totalViews, SVG viewsByDay, eventsByType

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

### Task 13 (frontend): `/news` — публічний список новин

**Files:**
- Create: `frontend-final/src/app/news/page.tsx`
- Test: `frontend-final/src/app/news/__tests__/page.test.ts`

**Interfaces:**
- Consumes: `serverFetchList<RawNews>('/news?...' , {revalidate: 60})`; Task 3 (`parseNews`, `NEWS_CATEGORIES`); `Pagination`.
- Produces: вкладки категорій `?category=` (без параметра — «Усі»), `?page=`; картка: imageUrl (якщо є), title, `formatDate(publishedAt)`, бейдж isPromoted («Промо»). Назву закладу на картці НЕ показуємо (бекенд не віддає venue в списку — base spec обмеження).

- [ ] **Step 1: Write the failing test (серверна сторінка, мок serverFetchList)**

```ts
// frontend-final/src/app/news/__tests__/page.test.ts
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const serverFetchList = vi.fn()
vi.mock('@/lib/api/server-client', () => ({ serverFetchList: (...args: unknown[]) => serverFetchList(...args) }))

import NewsPage from '@/app/news/page'

const rawNews = {
  id: 'n1', venueId: null, category: 'promo', title: 'Заголовок новини', content: 'x',
  imageUrl: '/static/a.png', status: 'published', isPromoted: true,
  publishedAt: '2026-09-10T10:00:00Z', createdAt: '2026-09-10T10:00:00Z', updatedAt: '2026-09-10T10:00:00Z',
}

describe('/news', () => {
  beforeEach(() => {
    serverFetchList.mockReset()
    serverFetchList.mockResolvedValue({ data: [rawNews], meta: { page: 1, limit: 12, total: 1, hasMore: false } })
  })

  it('фетчить /news з revalidate:60 і рендерить картку', async () => {
    const html = renderToStaticMarkup(await NewsPage({ searchParams: Promise.resolve({}) }))
    expect(serverFetchList).toHaveBeenCalledWith('/news?page=1', expect.objectContaining({ revalidate: 60 }))
    expect(html).toContain('Заголовок новини')
    expect(html).toContain('/news/n1')
  })

  it('category=promo передається у запит', async () => {
    renderToStaticMarkup(await NewsPage({ searchParams: Promise.resolve({ category: 'promo' }) }))
    expect(serverFetchList).toHaveBeenCalledWith('/news?category=promo&page=1', expect.anything())
  })

  it('порожньо → empty-state', async () => {
    serverFetchList.mockResolvedValue({ data: [] })
    const html = renderToStaticMarkup(await NewsPage({ searchParams: Promise.resolve({}) }))
    expect(html).toContain('Новин ще немає')
  })
})
```

- [ ] **Step 2: Run test to verify it fails** → FAIL.
- [ ] **Step 3: Implement**

```tsx
// frontend-final/src/app/news/page.tsx
import Link from 'next/link'
import { Pagination } from '@/components/ui/pagination'
import { serverFetchList } from '@/lib/api/server-client'
import { NEWS_CATEGORIES } from '@/lib/validation/news'
import { parseNews, type RawNews } from '@/types/news'
import { formatDate } from '@/lib/utils/format'

const LIMIT = 12

interface Props {
  searchParams: Promise<{ category?: string; page?: string }>
}

export const revalidate = 60

export default async function NewsPage({ searchParams }: Props) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp?.page ?? 1) || 1)
  const category = NEWS_CATEGORIES.some((c) => c.value === sp?.category) ? sp!.category : undefined

  const raw = await serverFetchList<RawNews>(`/news?page=${page}&limit=${LIMIT}${category ? `&category=${category}` : ''}`, { revalidate: 60 })
  const news = raw.data.map(parseNews)
  const totalPages = Math.max(1, Math.ceil((raw.meta?.total ?? 0) / (raw.meta?.limit || LIMIT)))

  return (
    <div className="mx-auto max-w-4xl py-8">
      <h1 className="text-2xl font-bold">Новини</h1>
      <nav className="mt-4 flex gap-3 text-sm" aria-label="Категорії новин">
        <Link href="/news" className={!category ? 'font-semibold text-brand-600' : 'text-stone-600 hover:text-brand-600'}>Усі</Link>
        {NEWS_CATEGORIES.map((c) => (
          <Link key={c.value} href={`/news?category=${c.value}`}
            className={category === c.value ? 'font-semibold text-brand-600' : 'text-stone-600 hover:text-brand-600'}>
            {c.label}
          </Link>
        ))}
      </nav>
      {news.length === 0 ? (
        <div className="mt-6 rounded-xl bg-stone-50 p-8 text-center">
          <p className="text-stone-500">Новин ще немає.</p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {news.map((n) => (
            <li key={n.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
              <Link href={`/news/${n.id}`} className="block">
                {n.imageUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element -- зовнішній URL з бекенда */
                  <img src={n.imageUrl} alt="" loading="lazy" className="h-40 w-full object-cover" />
                )}
                <div className="p-4">
                  {n.isPromoted && <span className="mr-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Промо</span>}
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                    {NEWS_CATEGORIES.find((c) => c.value === n.category)?.label}
                  </span>
                  <h2 className="mt-2 font-semibold">{n.title}</h2>
                  {n.publishedAt && <p className="mt-1 text-sm text-stone-500">{formatDate(n.publishedAt)}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} hrefFor={(p) => `/news?${category ? `category=${category}&` : ''}page=${p}`} />}
    </div>
  )
}
```

⚠️ У тесті Task 13 твердження `/news?page=1` — звірити з фактичним форматом шляху (конкатенація без `category` для дефолту).

- [ ] **Step 4: Run tests** — PASS; `pnpm test && pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Commit**

```bash
git add src/app/news/page.tsx src/app/news/__tests__/page.test.ts
git commit -m "feat: /news — публічний список новин з категоріями і пагінацією

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 14 (frontend): `/news/[id]` — деталі новини

**Files:**
- Create: `frontend-final/src/app/news/[id]/page.tsx`
- Test: `frontend-final/src/app/news/[id]/__tests__/page.test.ts`

**Interfaces:**
- Consumes: `serverFetch<RawNews>('/news/:id', {revalidate: 60})` (→ не знайдено/заархівовано → `notFound()`); опційне збагачення: `serverFetch<RawVenue>('/venues/:venueId', {revalidate: 60}).catch(() => null)` для назви закладу; `generateMetadata`.
- Produces: сторінка: title, imageUrl, категорія-бейдж, контент (whitespace-pre-line), «Заклад: <name>» якщо venueId і заклад approved (інакше рядок не показуємо).

- [ ] **Step 1: Write the failing test**

```ts
// frontend-final/src/app/news/[id]/__tests__/page.test.ts
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const serverFetch = vi.fn()
vi.mock('@/lib/api/server-client', () => ({ serverFetch: (...args: unknown[]) => serverFetch(...args) }))
vi.mock('next/navigation', () => ({ notFound: vi.fn(() => { throw new Error('NOT_FOUND') }) }))

import NewsPage from '@/app/news/[id]/page'

const rawNews = {
  id: 'n1', venueId: 'v1', category: 'event', title: 'Заголовок новини',
  content: 'Перший абзац.\n\nДругий абзац.', imageUrl: '/static/a.png', status: 'published',
  isPromoted: false, publishedAt: '2026-09-10T10:00:00Z',
  createdAt: '2026-09-10T10:00:00Z', updatedAt: '2026-09-10T10:00:00Z',
}

describe('/news/[id]', () => {
  it('рендер контенту і посилання на заклад', async () => {
    serverFetch.mockImplementation(async (path: string) => {
      if (path.startsWith('/news/')) return rawNews
      return { id: 'v1', name: 'Бар «Пиво»', address: 'вул. Липова, 1' }
    })
    const html = renderToStaticMarkup(await NewsPage({ params: Promise.resolve({ id: 'n1' }) }))
    expect(html).toContain('Заголовок новини')
    expect(html).toContain('Перший абзац.')
    expect(html).toContain('/venues/v1')
  })

  it('немає новини → notFound', async () => {
    serverFetch.mockRejectedValue(new Error('404'))
    await expect(NewsPage({ params: Promise.resolve({ id: 'nope' }) })).rejects.toThrow('NOT_FOUND')
  })

  it('метадата містить заголовок', async () => {
    serverFetch.mockImplementation(async (path: string) => (path.startsWith('/news/') ? rawNews : null))
    const meta = await (await import('@/app/news/[id]/page')).generateMetadata({ params: Promise.resolve({ id: 'n1' }) })
    expect(meta.title).toContain('Заголовок новини')
  })
})
```

- [ ] **Step 2: Run test to verify it fails** → FAIL.
- [ ] **Step 3: Implement**

```tsx
// frontend-final/src/app/news/[id]/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { serverFetch } from '@/lib/api/server-client'
import { parseNews, type RawNews } from '@/types/news'
import { parseVenue, type RawVenue } from '@/types/venue'
import { NEWS_CATEGORIES } from '@/lib/validation/news'
import { formatDate } from '@/lib/utils/format'

interface Props {
  params: Promise<{ id: string }>
}

export const revalidate = 60

async function getNews(id: string) {
  const raw = await serverFetch<RawNews>(`/news/${id}`, { revalidate: 60 }).catch(() => null)
  return raw ? parseNews(raw) : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const news = await getNews(id)
  return { title: news ? `${news.title} — Пиячок` : 'Новина — Пиячок' }
}

export default async function NewsPage({ params }: Props) {
  const { id } = await params
  const news = await getNews(id)
  if (!news) notFound()

  const venue = news.venueId
    ? await serverFetch<RawVenue>(`/venues/${news.venueId}`, { revalidate: 60 }).then(parseVenue).catch(() => null)
    : null

  return (
    <article className="mx-auto max-w-2xl py-8">
      {news.imageUrl && (
        /* eslint-disable-next-line @next/next/no-img-element -- зовнішній URL з бекенда */
        <img src={news.imageUrl} alt="" className="mb-4 h-64 w-full rounded-2xl object-cover" />
      )}
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
          {NEWS_CATEGORIES.find((c) => c.value === news.category)?.label}
        </span>
        {news.publishedAt && <span className="text-sm text-stone-500">{formatDate(news.publishedAt)}</span>}
      </div>
      <h1 className="text-2xl font-bold">{news.title}</h1>
      <div className="mt-4 whitespace-pre-line text-stone-700">{news.content}</div>
      {venue && (
        <p className="mt-6 text-sm text-stone-500">
          Заклад: <Link className="text-brand-600 hover:underline" href={`/venues/${venue.id}`}>{venue.name}</Link>
        </p>
      )}
    </article>
  )
}
```

⚠️ `serverFetch(...).then(parseVenue).catch(() => null)` — 404 approved-only закладу теж тихо ігноруємо (рядок не показуємо).

- [ ] **Step 4: Run tests** — PASS; `pnpm test && pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Commit**

```bash
git add "src/app/news/[id]/page.tsx" "src/app/news/[id]/__tests__/page.test.ts"
git commit -m "feat: /news/[id] — деталі новини з generateMetadata і посиланням на заклад

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

### Task 15 (frontend): `/hangouts` — публічна стрічка зустрічей

**Files:**
- Create: `frontend-final/src/app/hangouts/page.tsx`
- Create: `frontend-final/src/components/features/hangouts/hangout-join-button.tsx`
- Test: `frontend-final/src/app/hangouts/__tests__/page.test.ts`, `frontend-final/src/components/features/hangouts/__tests__/hangout-join-button.test.tsx`

**Interfaces:**
- Consumes: `serverFetchList<RawHangout>('/hangouts?...', {revalidate: 30})` (елементи мають `venue {id, name, address, mainPhotoUrl}`); фільтри `?venueId=&date=&status=` (default `open`) + `?page=`; Task 3 (`parseHangout`, `HANGOUT_STATUS_LABELS`); `formatMoney`, `formatDate`; `useUser` (гість → login-link).
- Produces: `HangoutJoinButton({ hangoutId, status }: { hangoutId: string; status: HangoutStatus })` — auth: POST `/hangouts/:id/join` (409 → інлайн текст бекенда; успіх → toast + refresh); гість → Link `/auth/login?next=<escape(next)>` (⚠️ `next` значення — готове `encodeURIComponent`, без `%2F`-проблем: проксі відкидає `%2F`, тому `loginNext` передається ВЖЕ encoded — патерн `HangoutButton`); картка кліком веде на `/hangouts/[id]`.

- [ ] **Step 1: Write the failing tests**

```tsx
// frontend-final/src/components/features/hangouts/__tests__/hangout-join-button.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { HangoutJoinButton } from '@/components/features/hangouts/hangout-join-button'
import type { SessionUser } from '@/types/user'

afterEach(() => vi.unstubAllGlobals())

const testUser: SessionUser = { id: 'u1', email: 'a@b.c', roles: ['user'] }

function apiCalls() {
  return (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
    ([u]) => !String(u).endsWith('/auth/me'),
  )
}

describe('HangoutJoinButton', () => {
  it('auth → POST /hangouts/h1/join → toast', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ data: {} }), { status: 200, headers: { 'content-type': 'application/json' } })
    }))
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider><HangoutJoinButton hangoutId="h1" status="open" /></ToastProvider>
      </UserProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /приєднатися/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/приєднано/i))
    const call = apiCalls()[0]
    expect(String(call[0])).toBe('/api/v1/hangouts/h1/join')
    expect((call[1] as RequestInit).method).toBe('POST')
  })

  it('409 → інлайн-повідомлення бекенда', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ error: { code: 'CONFLICT', message: 'Ви вже приєднані' } }), { status: 409, headers: { 'content-type': 'application/json' } })
    }))
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider><HangoutJoinButton hangoutId="h1" status="open" /></ToastProvider>
      </UserProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /приєднатися/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/вже приєднані/i))
  })

  it('filled/cancelled/completed → кнопка вимкнена', () => {
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider><HangoutJoinButton hangoutId="h1" status="filled" /></ToastProvider>
      </UserProvider>,
    )
    expect(screen.getByRole('button', { name: /приєднатися/i })).toBeDisabled()
  })
})
```

Серверний тест сторінки (якірні твердження, повний патерн як Task 13):

```ts
// frontend-final/src/app/hangouts/__tests__/page.test.ts
// 1) дефолтний фільтр status=open у запиті: '/hangouts?page=1&status=open'
// 2) ?status=filled передається; ?date=2026-09-10 передається
// 3) картка містить purpose, дату, назву закладу (raw.venue.name), лінк /hangouts/h1
// 4) порожньо → «Немає відкритих зустрічей»
```

- [ ] **Step 2: Run tests to verify they fail** → FAIL.
- [ ] **Step 3: Implement**

```tsx
// frontend-final/src/components/features/hangouts/hangout-join-button.tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useUser } from '@/components/providers/user-provider'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { apiVoid } from '@/lib/api/client'
import { ApiError } from '@/lib/api/parse'
import type { HangoutStatus } from '@/types/hangout'

export function HangoutJoinButton({ hangoutId, status }: { hangoutId: string; status: HangoutStatus }) {
  const { user } = useUser()
  const { toast } = useToast()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!user) {
    return (
      <Link href={`/auth/login?next=${encodeURIComponent('/hangouts')}`} className="text-sm text-brand-600 hover:underline">
        Увійдіть, щоб приєднатися
      </Link>
    )
  }
  if (status !== 'open') {
    return (
      <Button size="sm" disabled aria-label="Приєднатися">
        Приєднатися
      </Button>
    )
  }

  async function join() {
    setBusy(true)
    setError(null)
    try {
      await apiVoid(`/hangouts/${hangoutId}/join`, { method: 'POST' })
      toast('Ви приєдналися до зустрічі')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не вдалося приєднатися')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Button size="sm" onClick={join} disabled={busy}>{busy ? 'Приєднуємось…' : 'Приєднатися'}</Button>
      {error && <p role="alert" className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
```

Сторінка:

```tsx
// frontend-final/src/app/hangouts/page.tsx
import Link from 'next/link'
import { HangoutJoinButton } from '@/components/features/hangouts/hangout-join-button'
import { Pagination } from '@/components/ui/pagination'
import { serverFetchList } from '@/lib/api/server-client'
import { parseHangout, HANGOUT_STATUS_LABELS, type RawHangout } from '@/types/hangout'
import { formatMoney } from '@/lib/utils/format'

const LIMIT = 12
const STATUSES = ['open', 'filled', 'cancelled', 'completed'] as const

interface Props {
  searchParams: Promise<{ venueId?: string; date?: string; status?: string; page?: string }>
}

export const revalidate = 30

export default async function HangoutsPage({ searchParams }: Props) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp?.page ?? 1) || 1)
  const status = STATUSES.includes(sp?.status as typeof STATUSES[number]) ? sp!.status : 'open'
  const venueId = sp?.venueId?.trim() || undefined
  const date = sp?.date?.trim() || undefined

  const qs = [`page=${page}`, `limit=${LIMIT}`, `status=${status}`]
  if (venueId) qs.push(`venueId=${encodeURIComponent(venueId)}`)
  if (date) qs.push(`date=${date}`)
  const raw = await serverFetchList<RawHangout>(`/hangouts?${qs.join('&')}`, { revalidate: 30 })
  const hangouts = raw.data.map(parseHangout)
  const totalPages = Math.max(1, Math.ceil((raw.meta?.total ?? 0) / (raw.meta?.limit || LIMIT)))

  const qsBase = (p: number) => {
    const parts = [`page=${p}`, `status=${status}`]
    if (venueId) parts.push(`venueId=${encodeURIComponent(venueId)}`)
    if (date) parts.push(`date=${date}`)
    return `/hangouts?${parts.join('&')}`
  }

  return (
    <div className="mx-auto max-w-4xl py-8">
      <h1 className="text-2xl font-bold">Зустрічі</h1>
      <form className="mt-4 flex flex-wrap items-end gap-2" action="/hangouts" method="get" aria-label="Фільтри зустрічей">
        <input type="hidden" name="status" value={status} />
        <label className="text-sm">Дата
          <input type="date" name="date" defaultValue={date} className="ml-1 rounded-lg border border-stone-300 px-2 py-1" />
        </label>
        <button type="submit" className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50">Фільтрувати</button>
      </form>
      <nav className="mt-3 flex gap-3 text-sm" aria-label="Статус зустрічей">
        {STATUSES.map((s) => (
          <Link key={s} href={`/hangouts?status=${s}`}
            className={s === status ? 'font-semibold text-brand-600' : 'text-stone-600 hover:text-brand-600'}>
            {HANGOUT_STATUS_LABELS[s]}
          </Link>
        ))}
      </nav>
      {hangouts.length === 0 ? (
        <div className="mt-6 rounded-xl bg-stone-50 p-8 text-center">
          <p className="text-stone-500">Немає відкритих зустрічей.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {hangouts.map((h) => (
            <li key={h.id} className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium">{h.date} · {h.time}</span>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{HANGOUT_STATUS_LABELS[h.status]}</span>
                {h.venue && (
                  <Link className="text-sm text-brand-600 hover:underline" href={`/venues/${h.venue.id}`}>{h.venue.name}</Link>
                )}
                <div className="ml-auto"><HangoutJoinButton hangoutId={h.id} status={h.status} /></div>
              </div>
              <p className="mt-2 text-stone-700">{h.purpose}</p>
              <p className="mt-1 text-sm text-stone-500">
                до {h.groupSize} осіб · {h.payer === 'me' ? 'Плачу я' : h.payer === 'split' ? 'Порівну' : 'Платить компанія'}
                {h.desiredBudget !== null ? ` · бюджет ${formatMoney(h.desiredBudget)}` : ''}
              </p>
              <p className="mt-2">
                <Link className="text-sm text-brand-600 hover:underline" href={`/hangouts/${h.id}`}>Деталі</Link>
              </p>
            </li>
          ))}
        </ul>
      )}
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} hrefFor={qsBase} />}
    </div>
  )
}
```

⚠️ `h.venue` у parsed-типі: додати в Task 3 (RawHangout) `venue?` + у `Hangout` parsed — `venue?: {id, name, address, mainPhotoUrl | null}`; `parseHangout` passthrough. Gender-лейбл можна реюзнути `HANGOUT_GENDERS`/`HANGOUT_PAYERS` з `@/lib/validation/hangout`.

- [ ] **Step 4: Run tests** — PASS; `pnpm test && pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Commit**

```bash
git add src/app/hangouts/page.tsx src/app/hangouts/__tests__/page.test.ts src/components/features/hangouts/hangout-join-button.tsx src/components/features/hangouts/__tests__/hangout-join-button.test.tsx
git commit -m "feat: /hangouts — публічна стрічка з фільтрами і приєднанням

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 16 (frontend): `/hangouts/[id]` — деталі зустрічі (клієнтська, доступ учасникам)

**Files:**
- Create: `frontend-final/src/app/hangouts/[id]/page.tsx`
- Test: `frontend-final/src/app/hangouts/[id]/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: `api<RawHangout>('/hangouts/:id')` (клієнтський фетч; 403 → error-стан, 401 → auto-redirect від `api()`); Task 6 `HangoutActions`; Task 15 `HangoutJoinButton`; Task 3 типи (`participants`, `creatorId`, `venue?`).
- Produces: клієнтська сторінка: loading → контент | 403-стан | помилка. Контент: date/time, status, purpose, gender, groupSize, payer, budget, venue-name, учасники (`participants`, лейбл «Учасники (N)»). Дії за роллю: join (не учасник і open), leave (учасник, не творець), cancel (творець).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend-final/src/app/hangouts/[id]/__tests__/page.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import Page from '@/app/hangouts/[id]/page'
import type { SessionUser } from '@/types/user'

afterEach(() => vi.unstubAllGlobals())

// useParams мок: id = 'h1'
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'h1' }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

const testUser: SessionUser = { id: 'u1', email: 'a@b.c', roles: ['user'] }

const rawHangout = {
  id: 'h1', venueId: 'v1', creatorId: 'u1', date: '2026-12-01', time: '19:00',
  purpose: 'Посидіти з пивом', gender: 'any', groupSize: 5, payer: 'split',
  desiredBudget: '500', status: 'open', createdAt: '2026-09-01T00:00:00Z',
  venue: { id: 'v1', name: 'Бар «Пиво»', address: 'вул. Липова, 1', mainPhotoUrl: null },
  participants: [
    { hangoutId: 'h1', userId: 'u1', joinedAt: '2026-09-01T00:00:00Z' },
    { hangoutId: 'h1', userId: 'u2', joinedAt: '2026-09-02T00:00:00Z' },
  ],
}

describe('/hangouts/[id]', () => {
  it('учасник бачить деталі і список учасників', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ data: rawHangout }), { status: 200, headers: { 'content-type': 'application/json' } })
    }))
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider><Page /></ToastProvider>
      </UserProvider>,
    )
    await waitFor(() => expect(screen.getByText(/Посидіти з пивом/)).toBeInTheDocument())
    expect(screen.getByText(/Бар «Пиво»/)).toBeInTheDocument()
    expect(screen.getByText(/Учасники \(2\)/)).toBeInTheDocument()
  })

  it('403 → error-стан «Ви не учасник цієї зустрічі»', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Ви не учасник цієї заявки' } }), { status: 403, headers: { 'content-type': 'application/json' } })
    }))
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider><Page /></ToastProvider>
      </UserProvider>,
    )
    await waitFor(() => expect(screen.getByText(/не учасник/i)).toBeInTheDocument())
  })

  it('мережева помилка → retry-стан', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })))
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider><Page /></ToastProvider>
      </UserProvider>,
    )
    await waitFor(() => expect(screen.getByRole('button', { name: /повторити/i })).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test to verify it fails** → FAIL.
- [ ] **Step 3: Implement**

```tsx
// frontend-final/src/app/hangouts/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { HangoutActions } from '@/components/features/hangouts/hangout-actions'
import { HangoutJoinButton } from '@/components/features/hangouts/hangout-join-button'
import { api } from '@/lib/api/client'
import { ApiError } from '@/lib/api/parse'
import { parseHangout, HANGOUT_STATUS_LABELS, type RawHangout, type Hangout } from '@/types/hangout'
import { formatMoney } from '@/lib/utils/format'
import { useUser } from '@/components/providers/user-provider'

export default function HangoutDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useUser()
  const [hangout, setHangout] = useState<Hangout | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api<RawHangout>(`/hangouts/${id}`)
      .then((raw) => { if (!cancelled) setHangout(parseHangout(raw)) })
      .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити зустріч') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id, reload])

  if (loading) return <p className="py-8 text-center text-stone-500">Завантаження…</p>
  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="text-stone-600">{error}</p>
        <Button variant="secondary" className="mt-3" onClick={() => setReload((n) => n + 1)}>Повторити</Button>
        <p className="mt-3"><Link href="/hangouts" className="text-brand-600 hover:underline">До списку зустрічей</Link></p>
      </div>
    )
  }
  if (!hangout) return null

  const participants = hangout.participants ?? []
  const isCreator = user?.id === hangout.creatorId
  const isParticipant = participants.some((p) => p.userId === user?.id)

  return (
    <article className="mx-auto max-w-2xl py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{hangout.date} · {hangout.time}</h1>
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{HANGOUT_STATUS_LABELS[hangout.status]}</span>
      </div>
      <p className="mt-2 text-stone-700">{hangout.purpose}</p>
      <ul className="mt-4 space-y-1 text-sm text-stone-600">
        <li>Учасників потрібно: до {hangout.groupSize}</li>
        <li>{hangout.gender === 'any' ? 'Будь-хто' : hangout.gender === 'male' ? 'Чоловіки' : 'Жінки'}</li>
        <li>{hangout.payer === 'me' ? 'Плачу я' : hangout.payer === 'split' ? 'Порівну' : 'Платить компанія'}</li>
        {hangout.desiredBudget !== null && <li>Бюджет: {formatMoney(hangout.desiredBudget)}</li>}
        {hangout.venue && (
          <li>Заклад: <Link className="text-brand-600 hover:underline" href={`/venues/${hangout.venue.id}`}>{hangout.venue.name}</Link></li>
        )}
      </ul>

      <div className="mt-6">
        <h2 className="text-lg font-semibold">Учасники ({participants.length})</h2>
        <ul className="mt-2 space-y-1 text-sm text-stone-600">
          {participants.map((p) => (
            <li key={p.userId}>Учасник (приєднався {p.joinedAt?.slice(0, 10)})</li>
          ))}
        </ul>
      </div>

      <div className="mt-6 flex items-center gap-3">
        {!isParticipant && <HangoutJoinButton hangoutId={hangout.id} status={hangout.status} />}
        <HangoutActions
          hangoutId={hangout.id}
          isCreator={Boolean(isCreator)}
          canLeave={Boolean(user) && !isCreator && hangout.status !== 'cancelled' && hangout.status !== 'completed'}
        />
        <Link href="/hangouts" className="text-sm text-stone-600 hover:underline">До списку</Link>
      </div>
    </article>
  )
}
```

⚠️ Типи `Hangout.venue?`/`Hangout.participants?` вже розширені в Task 3. `HangoutJoinButton` для гостя показує login-лінк з `next=encodeURIComponent('/hangouts/'+id)`. Скасована/завершена зустріч: join-кнопка disabled (це покриває HangoutJoinButton).

- [ ] **Step 4: Run tests** — PASS; `pnpm test && pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Commit**

```bash
git add "src/app/hangouts/[id]/page.tsx" "src/app/hangouts/[id]/__tests__/page.test.tsx"
git commit -m "feat: /hangouts/[id] — деталі зустрічі (учасники, join/leave/cancel)

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

### Task 17 (frontend): Header — навігація + UserMenu

**Files:**
- Create: `frontend-final/src/components/layout/user-menu.tsx`
- Modify: `frontend-final/src/components/layout/header.tsx` (nav + заміна пари email/«Вийти» на `UserMenu`)
- Test: `frontend-final/src/components/layout/__tests__/user-menu.test.tsx`

**Interfaces:**
- Consumes: `useUser()` (`{user, logout}`); `Role` з `@/types/user`.
- Produces: `UserMenu()` — кнопка (email як текст + роль-бейдж, `aria-expanded`), дропдаун: «Кабінет» → `/account`, «Адмінка» → `/admin` (тільки `roles.includes('super_admin')`), «Вийти» → `logout()`. Закриття: клік поза (document mousedown), Escape; після дій фокус повертається на кнопку.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend-final/src/components/layout/__tests__/user-menu.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { UserMenu } from '@/components/layout/user-menu'
import type { SessionUser } from '@/types/user'

afterEach(() => vi.unstubAllGlobals())

const testUser: SessionUser = { id: 'u1', email: 'a@b.c', roles: ['user'] }
const adminUser: SessionUser = { id: 'u2', email: 'admin@b.c', roles: ['super_admin'] }

describe('UserMenu', () => {
  it('клік відкриває меню з «Кабінет» і «Вийти», без «Адмінка» для user', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })))
    render(
      <UserProvider initialUser={testUser}>
        <UserMenu />
      </UserProvider>,
    )
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /a@b\.c/ }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Кабінет' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Адмінка' })).not.toBeInTheDocument()
  })

  it('super_admin бачить «Адмінка»', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ data: adminUser }), { status: 200, headers: { 'content-type': 'application/json' } })))
    render(
      <UserProvider initialUser={adminUser}>
        <UserMenu />
      </UserProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /admin@b\.c/ }))
    expect(screen.getByRole('menuitem', { name: 'Адмінка' })).toBeInTheDocument()
  })

  it('Escape закриває меню', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })))
    render(
      <UserProvider initialUser={testUser}>
        <UserMenu />
      </UserProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /a@b\.c/ }))
    fireEvent.keyDown(screen.getByRole('button', { name: /a@b\.c/ }), { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('«Вийти» викликає logout', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith('/auth/me')
        ? new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
        : new Response(null, { status: 200 })))
    render(
      <UserProvider initialUser={testUser}>
        <UserMenu />
      </UserProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /a@b\.c/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Вийти' }))
    // logout із UserProvider робить POST /api/auth/logout і скидає user — перевіряємо, що виклик пішов
    await waitFor(() => {
      const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([u]) => String(u).includes('/api/auth/logout'))
      expect(calls.length).toBeGreaterThan(0)
    })
  })
})
```

⚠️ Перевірити фактичну реалізацію `logout` у `user-provider.tsx` (шлях виклику, поведінку після) і привести твердження у відповідність.

- [ ] **Step 2: Run test to verify it fails** → FAIL.
- [ ] **Step 3: Implement**

```tsx
// frontend-final/src/components/layout/user-menu.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useUser } from '@/components/providers/user-provider'
import { Button } from '@/components/ui/button'

export function UserMenu() {
  const { user, logout } = useUser()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus() }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null
  const isAdmin = user.roles.includes('super_admin')

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-stone-200 px-2.5 py-1 text-sm hover:bg-stone-50"
      >
        <span className="max-w-40 truncate">{user.email}</span>
        {isAdmin && <span className="rounded-full bg-brand-100 px-1.5 text-xs text-brand-700">admin</span>}
      </button>
      {open && (
        <div role="menu" aria-label="Меню користувача" className="absolute right-0 z-40 mt-1 w-44 rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
          <a role="menuitem" href="/account" className="block px-4 py-2 text-sm hover:bg-stone-50">Кабінет</a>
          {isAdmin && <a role="menuitem" href="/admin" className="block px-4 py-2 text-sm hover:bg-stone-50">Адмінка</a>}
          <button role="menuitem" type="button" onClick={logout} className="block w-full px-4 py-2 text-left text-sm hover:bg-stone-50">Вийти</button>
        </div>
      )}
    </div>
  )
}
```

⚠️ Використати `Link` замість `<a href>` для внутрішніх переходів (Next-навігація). `Button` імпорт не потрібен, якщо не використовується — прибрати.

У `header.tsx`: замінити блок `{user ? ... : <Link ...>Увійти</Link>}` на `{user ? <UserMenu /> : <Link ...>Увійти</Link>}`; nav — додати `<Link href="/news">Новини</Link>` і `<Link href="/hangouts">Зустрічі</Link>`.

- [ ] **Step 4: Run tests** — `user-menu.test.tsx` PASS; оновити `app-shell.test.tsx`/`header`-тести, якщо вони стверджували про email-лінк (звірити); `pnpm test && pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Commit**

```bash
git add src/components/layout/user-menu.tsx src/components/layout/header.tsx src/components/layout/__tests__/user-menu.test.tsx src/components/layout/__tests__/app-shell.test.tsx
git commit -m "feat: UserMenu з дропдауном (кабінет/адмінка/вихід) + навігація Новини/Зустрічі

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 18 (frontend): поліровка a11y — Modal focus-trap + AgeGate фокус

**Files:**
- Modify: `frontend-final/src/components/ui/modal.tsx`
- Modify: `frontend-final/src/components/layout/age-gate.tsx`
- Test: `frontend-final/src/components/ui/__tests__/modal.test.tsx` (розширити), `frontend-final/src/components/layout/__tests__/age-gate.test.tsx` (додати кейс)

**Interfaces:** без змін публічних API компонентів.

- [ ] **Step 1: Write the failing tests (додати в наявні файли тестів)**

```tsx
// modal.test.tsx — додати кейси:
it('Tab із внутрішнього елемента не тікає з діалогу', () => {
  // рендер Modal з 3 кнопками; фокус на середню; keydown Tab
  // → activeElement лишається всередині panel (або на першому/останньому)
})
it('FOCUSABLE враховує tabindex і contenteditable', () => {
  // у children: <span tabindex="0">, <div contenteditable>
  // keydown Tab з останнього елемента → фокус на першому (span з tabindex)
})

// age-gate.test.tsx — додати кейс:
it('діалог отримує фокус при монтуванні', () => {
  render(<AgeGate />)
  expect(screen.getByRole('dialog')).toHaveFocus()
})
```

- [ ] **Step 2: Run tests to verify they fail** — `pnpm vitest run src/components/ui/__tests__/modal.test.tsx src/components/layout/__tests__/age-gate.test.tsx` → нові кейси FAIL.

- [ ] **Step 3: Implement**

`modal.tsx` — змінити `FOCUSABLE` і trap:

```ts
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable]:not([contenteditable="false"])'
```

У `onKeyDown` (гілка Tab), ПЕРЕД перевірками країв:

```ts
      // Фокус витік із панелі (клік поза контентом, вкладка браузера тощо) —
      // повертаємо всередину замість того, щоб Tab оброблявся поза діалогом
      if (!panelRef.current.contains(document.activeElement)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
        return
      }
```

`age-gate.tsx` — додати ref і фокус на діалог при монтуванні:

```ts
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    dialogRef.current?.focus()
  }, [])
  // на контейнер діалога: role="dialog" aria-modal="true" tabIndex={-1} ref={dialogRef}
```

- [ ] **Step 4: Run tests** — PASS; `pnpm test && pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Commit**

```bash
git add src/components/ui/modal.tsx src/components/layout/age-gate.tsx src/components/ui/__tests__/modal.test.tsx src/components/layout/__tests__/age-gate.test.tsx
git commit -m "a11y: focus-trap Modal (утікання фокусу, tabindex/contenteditable), фокус AgeGate

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 19 (frontend): поліровка — lazy-зображення, EULA, toast-401, косметика

**Files:**
- Modify: `frontend-final/src/components/features/venues/photo-gallery.tsx`, `frontend-final/src/components/features/venues/venue-card.tsx`, `frontend-final/src/app/account/favorites/page.tsx` (усі `<img>` → додати `loading="lazy"`)
- Modify: `frontend-final/src/components/features/venues/photo-gallery.tsx` (коментар привести у відповідність коду)
- Modify: `frontend-final/src/components/ui/button.tsx`-тест `frontend-final/src/components/ui/__tests__/button.test.tsx` (назва тесту → відповідно до фактичного ствердження)
- Modify: `frontend-final/src/app/auth/register/register-form.tsx` (EULA-чекбокс: `aria-describedby` на текст EULA)
- Modify: `frontend-final/src/lib/api/client.ts` (`apiVoid`: 401 → redirect БЕЗ throw)
- Test: `frontend-final/src/lib/api/__tests__/client.test.ts` (додати кейс)

- [ ] **Step 1: Write the failing test (toast-401)**

```ts
// client.test.ts — додати:
it('apiVoid: 401 → redirect ініційовано, НЕ кидає ApiError', async () => {
  const assign = vi.fn()
  // (мок window.location як у наявних тестах redirectToLogin — звірити спосіб із сусіднім кейсом 401)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })))
  await expect(apiVoid('/me/favorites/v1', { method: 'DELETE' })).resolves.toBeUndefined()
})
```

⚠️ Перезвірити наявний кейс `apiVoid` 401 у цьому файлі: він стверджує «кидає після редіректу» — змінити його відповідно до нової поведінки (це свідома зміна: компоненти більше не показують toast перед перезавантаженням; резидуал Плану 2 №10).

- [ ] **Step 2: Run test to verify it fails** → FAIL.

- [ ] **Step 3: Implement**

`client.ts` — у `apiVoid`:

```ts
  if (res.status === 401) {
    redirectToLogin()
    // Редірект уже ініційовано — компоненти не показують toast перед
    // перезавантаженням (резидуал Плану 2 №10): тихо завершуємо
    return
  }
```

Решта: додати `loading="lazy"` у всі `<img>` трьох файлів; виправити коментар у photo-gallery (прочитати код, описати фактичну поведінку); у register-form додати `aria-describedby="eula-text"` на чекбокс + `id="eula-text"` на лейбл/текст EULA; у button.test.tsx перейменувати кейс, чия назва не відповідає ствердженню (знайти невідповідність читанням файлу).

- [ ] **Step 4: Run gates** — `pnpm test && pnpm typecheck && pnpm lint` → green.
- [ ] **Step 5: Commit**

```bash
git add src/components/features/venues/photo-gallery.tsx src/components/features/venues/venue-card.tsx src/app/account/favorites/page.tsx src/app/auth/register/register-form.tsx src/lib/api/client.ts src/lib/api/__tests__/client.test.ts src/components/ui/__tests__/button.test.tsx
git commit -m "polish: lazy-зображення, EULA aria-describedby, toast-401 без мелькання, косметика

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 20: фінальні гейти обох репозиторіїв + памʼять

- [ ] **Step 1: Frontend gates** — `cd frontend-final && pnpm typecheck && pnpm lint && pnpm test && pnpm build` → усі green (157+ тестів Плану 2 + нові).
- [ ] **Step 2: Backend gates** — `cd backend-final && pnpm typecheck && pnpm lint && pnpm test && pnpm build` (звірити фактичні scripts у package.json) → green.
- [ ] **Step 3: Оновити памʼять** `pyiachok-plan-2-residuals.md`: прибрати 5 дешевих резидуалів (a11y-пас, lazy, EULA, toast-401, косметика), залишити 5 припаркованих (invocationOrder, meta-Partial, double-fetch, limit=100, E2E, TZ, view-дедуп) + додати рядок про `GET /me/venues` без пагінації (свідомий компроміс як limit=100).
- [ ] **Step 4: Леджер** — `.superpowers/sdd/2026-09-10-plan-3-account-public/progress.md`: усі задачі, відхилення від плану, рішення ревʼю.

---

## Після виконання плану

1. `finishing-a-development-branch` (обидві гілки: merge backend-final у його main, frontend-final у main) — merge у main тільки після гейтів.
2. План 4 «Адмінка» (~8–10 задач) — наступний цикл: brainstorming → spec → plan → SDD.
3. Ручна перевірка браузером проти живого бекенда — після Плану 4, перед релізом (чекліст Плану 2 + нові сторінки Плану 3).

## Само-рев'ю плану (виконано 2026-09-10)

- Спека → план: кожен рядок таблиць 4–6 спеки має задачу (Tasks 4–9, 13–17); бекенд-секція 2 → Tasks 1–2; поліровка секції 7 → Tasks 18–19; тести/гейти секції 8 → Global Constraints + Task 20. ✓
- Місця, де виконавцю явно наказано звірити фактичні імпорти/пропси (⚠️-позначки) — це свідомі «read-then-adapt» кроки, не заглушки: план фіксує семантику, а ідентичні копії коду бекенду у плані дали б рас-дублікати, які ревʼюер не прийме. ✓
- Типова узгодженість: `HangoutStatus`/`HANGOUT_STATUS_LABELS` (Task 3 → 6, 15, 16), `parseNews`/`NEWS_CATEGORIES` (Task 3 → 11, 13, 14), `parseVenueAnalytics` (Task 3 → 12), `venueCreateSchema`/`venueUpdateSchema` (Task 3 → 8, 9), `csvToArray`/`WH_DAYS` (Task 3 → 8), `ProfileFields` (Task 4 → 9 не потрібен), `MeVenuesController` (Task 1–2 → 7, 9), `HangoutActions` (Task 6 → 16), `HangoutJoinButton` (Task 15 → 16). ✓