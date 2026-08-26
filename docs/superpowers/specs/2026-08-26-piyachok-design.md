# Дизайн-документ: «Пиячок» — каталог закладів із функцією «Пиячок»

- **Дата:** 2026-08-26
- **Версія:** 1.0
- **Статус:** Погоджено (екістично з користувачем під час brainstorming)
- **Джерело вимог:** `Пиячок_Технічне_завдання_BA.md`
- **Репозиторії:** `backend-final` (NestJS, керує docker-compose) + `frontend-final` (Next.js)

---

## 0. Підсумок прийнятих рішень (закриті TBD з ТЗ)

| # | Питання з ТЗ | Прийняте рішення |
|---|---|---|
| 1 | Потік «Пиячок» | Публічна заявка з приєднанням, стани `open → filled → completed` |
| 2 | Авторизація | email/пароль + Google OAuth + Facebook OAuth, JWT (access 15 хв + refresh 30 днів, rotation) |
| 3 | Карта | Leaflet (OSM) на сторінці закладу, кнопка «Маршрут» → Google Maps URL, відстань — Haversine |
| 4 | Рейтинг і чек | 1–5 зірочок + фото чека (upload) |
| 5 | Файли | Локальна ФС + Docker volume, бек роздає `/static/*` |
| 6 | Роль «Критик» | `UserRole` з `code=critic`; бейдж у відгуках; без особливих прав у MVP |
| 7 | Промо-логіка | Не входить у MVP. Поле `isPromoted` + `promotedUntil`, без оплати |
| 8 | Структура репо | `backend-final` (NestJS + docker-compose) + `frontend-final` (Next.js) |
| 9 | RBAC | Повноцінна: `Role`, `Permission`, `RolePermission`, `UserRole` |

---

## 1. Архітектура та модульна структура

**Концепція:** NestJS як бекенд із Bounded Contexts. Кожен контекст — самодостатній NestJS-модуль (entity / controller / service / dto / test). Контексти спілкуються через публічні сервіси, не через прямі звернення до чужих репозиторіїв.

**Глобальні механізми (`common/`):**
- `JwtAuthGuard` — перевірка access token
- `PermissionsGuard` — `@Permissions(...)` + кеш прав з Redis
- `ThrottlerGuard` (Redis store) — rate limiting
- `ValidationPipe(global)` — `class-validator`, `whitelist: true`, `forbidNonWhitelisted: true`
- `CacheService` — абстракція над Redis із no-op fallback
- `FileStorageService` — інкапсулює запис у `uploads/`
- `AuditService` — логування адмін-дій

**Крос-модульні події (через `@nestjs/event-emitter`):**
- `HangoutCreated` → сповіщення учасників
- `VenueStatusChanged` (на `approved`) → інвалідація кешу каталогу
- `ReviewCreated` / `ReviewUpdated` / `ReviewDeleted` → перерахунок `Venue.ratingAvg/ratingCount`
- `ComplaintCreated` → пуш супер-адмінам

**Інфраструктура (`docker-compose.yml`):**
- `postgres:16-alpine` з PostGIS (порт 5432, volume `pgdata`)
- `redis:7-alpine` (порт 6379, volume `redisdata`)
- `backend` (NestJS dev з `nest start --watch`, порт 3000, volume `uploads:/app/uploads`)

**`.env` (приклад):**
```
NODE_ENV=development
PORT=3000
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_USER=piyachok
DATABASE_PASS=piyachok_dev
DATABASE_NAME=piyachok
REDIS_HOST=redis
REDIS_PORT=6379
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
FACEBOOK_CALLBACK_URL=http://localhost:3000/api/v1/auth/facebook/callback
FRONTEND_URL=http://localhost:3001
LOG_LEVEL=debug
```

**Якість коду:**
- ESLint + Prettier
- Jest (unit + integration + e2e)
- `nestjs-pino` для логування (request-id, JSON)
- `helmet` + `compression` у `main.ts`
- CORS whitelist тільки для `FRONTEND_URL`

---

## 2. Модель даних

### RBAC

```
Role
  id (uuid, pk)
  code (varchar 32, unique)   -- 'user' | 'venue_admin' | 'super_admin' | 'critic'
  name (varchar 100)
  description (text)
  createdAt, updatedAt

Permission
  id (uuid, pk)
  code (varchar 64, unique)   -- 'venue:moderate', 'review:edit:any' ...
  description (text)

RolePermission
  roleId (fk Role.id)
  permissionId (fk Permission.id)
  pk(roleId, permissionId)

UserRole
  userId (fk User.id)
  roleId (fk Role.id)
  assignedAt
  assignedBy (fk User.id, nullable)
  pk(userId, roleId)
```

`User` не має колонки `role` — тільки зв'язок через `UserRole`. Користувач може мати N ролей; фінальний набір прав — об'єднання.

**Початкові ролі (seed):**

| code | name | permissions |
|---|---|---|
| `user` | Користувач | `venue:create`, `review:create`, `review:edit:own`, `hangout:create`, `news:manage:own` |
| `venue_admin` | Адмін закладу | всі `user` + `venue:edit:own`, `analytics:view:own` |
| `super_admin` | Супер-адмін | всі permissions: `venue:*`, `review:*`, `hangout:*`, `news:*`, `complaint:manage`, `user:manage`, `analytics:view:all` |
| `critic` | Критик | всі `user` + `review:feature` (прапор `isFeatured` на своєму відгуку) |

**Повний список permissions (seed):**
`venue:create`, `venue:edit:own`, `venue:edit:any`, `venue:moderate`, `review:create`, `review:edit:own`, `review:edit:any`, `review:feature`, `hangout:create`, `news:manage:own`, `news:manage:any`, `complaint:manage`, `user:manage`, `analytics:view:own`, `analytics:view:all`

**Кеш прав:** `perms:{userId}` у Redis, TTL 5 хв. Інвалідація — listener на `UserRole.afterInsert/Delete`.

### Користувачі та авторизація

```
User
  id (uuid, pk)
  email (citext, unique, not null)
  passwordHash (text, nullable — null коли тільки OAuth)
  emailVerified (bool, default false)
  createdAt, updatedAt

Profile (1:1)
  userId (fk, pk)
  firstname (varchar 64)
  lastname (varchar 64)
  phone (varchar 32, nullable)
  age (int, nullable)
  avatarUrl (text, nullable)

OAuthAccount (1:N)
  id, userId, provider ('google' | 'facebook'), providerUserId, createdAt
  unique(provider, providerUserId)
```

### Заклади

```
Venue
  id (uuid, pk)
  ownerId (fk User.id)
  name (varchar 200)
  description (text)
  address (text)
  latitude (decimal 9,6)
  longitude (decimal 9,6)
  location (geography(POINT, 4326))   -- генерується з lat/lng через тригер
  contacts (jsonb: { phone, instagram, facebook, website })
  workingHours (jsonb: { mon: '09:00-23:00', ... })
  averageCheck (numeric 10,2)
  mainPhotoUrl (text)
  status (enum: 'pending' | 'approved' | 'rejected' | 'archived', default 'pending')
  ratingAvg (numeric 3,2, default 0)
  ratingCount (int, default 0)
  viewCount (int, default 0)
  createdAt, updatedAt
  index(status), index(location GIST)

VenuePhoto (1:N)
  id, venueId, url, sortOrder

VenueFeature (lookup)
  id, code (unique), name, icon

VenueFeatureAssignment (M:N)
  venueId, featureId, pk(venueId, featureId)

Tag (lookup)
  id, name (unique), slug (unique)

VenueTag (M:N)
  venueId, tagId, pk(venueId, tagId)

VenueType (lookup)
  id, name, slug

VenueTypeAssignment (M:N)
  venueId, typeId
```

### Відгуки, обране, скарги, перегляди

```
Review
  id, venueId, userId
  rating (smallint 1..5)
  text (text)
  checkPhotoUrl (text, nullable)
  isFeatured (bool, default false)
  createdAt, updatedAt
  unique(venueId, userId)
  index(venueId, createdAt desc)

Favorite
  userId, venueId, createdAt
  pk(userId, venueId)

Complaint
  id, venueId (nullable), reviewId (nullable), userId
  reason (enum: 'fake_promo' | 'fraud' | 'other')
  text (text)
  status (enum: 'new' | 'in_review' | 'resolved' | 'rejected', default 'new')
  createdAt, resolvedAt, resolvedBy (fk User.id)
  index(status, createdAt)

VenueView
  id, venueId, userId (nullable), sessionId (varchar, nullable)
  viewedAt
  index(venueId, viewedAt)
```

### Новини

```
News
  id, venueId (nullable — null = глобальна)
  category (enum: 'general' | 'promo' | 'event')
  title (varchar 200), content (text)
  imageUrl (text, nullable)
  status (enum: 'draft' | 'published' | 'archived', default 'published')
  isPromoted (bool, default false)
  promotedUntil (date, nullable)
  publishedAt, createdAt, updatedAt
  index(category, publishedAt desc)
```

### «Пиячок»

```
Hangout
  id, creatorId (fk User.id), venueId
  date (date, check >= CURRENT_DATE)
  time (time)
  purpose (text)
  gender (enum: 'male' | 'female' | 'any', default 'any')
  groupSize (int 1..20)
  payer (enum: 'me' | 'split' | 'them', default 'split')
  desiredBudget (numeric 10,2)
  status (enum: 'open' | 'filled' | 'completed' | 'cancelled', default 'open')
  createdAt
  index(venueId, date, status)

HangoutParticipant
  hangoutId, userId, joinedAt
  pk(hangoutId, userId)
```

**Переходи статусів:**
- `open → filled` — listener: `participants.count == groupSize`
- `open/filled → completed` — cron кожні 5 хв: `date + time < now()`
- `* → cancelled` — creator або super_admin

### Audit log

```
AuditLog
  id, actorId, action (varchar 64), entityType, entityId,
  before (jsonb), after (jsonb), createdAt
  index(actorId, createdAt), index(entityType, entityId)
```

### Міграції

- Namespace `piyachok` для всіх таблиць
- Кожна сутність — окрема міграція
- Початкова `1700000000000-init.ts` створює всі таблиці + seed ролей/permissions + тригер на `venue.location`

---

## 3. API surface і авторизація

**Базові принципи:**
- REST + JSON, префікс `/api/v1`
- Пагінація: `{ data, meta: { page, total, hasMore } }`
- Помилки: `{ error: { code, message, details? } }`
- ідемпотентність для POST через `Idempotency-Key` хедер (опційно)

### Auth endpoints

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/auth/google
GET    /api/v1/auth/google/callback
GET    /api/v1/auth/facebook
GET    /api/v1/auth/facebook/callback
GET    /api/v1/auth/me
```

**JWT (access):** payload `{ sub, email, roles, iat, exp }`. TTL 15 хв. Refresh — 30 днів, rotation, blacklist у Redis.

**OAuth (server-side):** callback редіректить на `FRONTEND_URL/auth/callback?access=...&refresh=...`. Фронт зберігає access у memory, refresh — httpOnly Secure SameSite=Lax cookie.

**Throttler:**
- `auth/register` — 5/год на IP
- `auth/login` — 10/хв на IP+email
- `auth/refresh` — 30/хв на IP
- загальний — 100/хв на IP

**Валідація register:** email формат, password min 8 + `(?=.*[A-Z])(?=.*[0-9])`, age min 18, acceptEula must be true.

---

## 4. Venues: CRUD, пошук, фільтри, модерація

### Endpoints

**Публічні:**
```
GET    /api/v1/venues              -- query: q, type, feature, tag, minCheck, maxCheck, minRating,
                                       lat, lng, radiusKm, sort, page, limit
                                       тільки status=approved
GET    /api/v1/venues/:id          -- +photos, features, tags, types, recentReviews, news
```

**Авторизовані:**
```
POST   /api/v1/venues                          -- permission: venue:create
GET    /api/v1/venues/:id/edit                 -- permission: venue:edit:own або venue:edit:any
PATCH  /api/v1/venues/:id
DELETE /api/v1/venues/:id                      -- м'яке (status=archived)
POST   /api/v1/venues/:id/photos               -- multipart
DELETE /api/v1/venues/:id/photos/:photoId
GET    /api/v1/venues/:id/news
```

**Супер-адмін (модерація):**
```
GET    /api/v1/admin/venues/pending
POST   /api/v1/admin/venues/:id/approve
POST   /api/v1/admin/venues/:id/reject         -- body: { reason }
POST   /api/v1/admin/venues/:id/assign-owner   -- body: { userId }
```

### Пошук і фільтрація (TypeORM QueryBuilder)

```ts
qb.where('v.status = :status', { status: 'approved' });
if (q) qb.andWhere('v.name ILIKE :q OR v.address ILIKE :q', { q: `%${q}%` });
if (minRating) qb.andWhere('v.ratingAvg >= :minRating', { minRating });
if (minCheck) qb.andWhere('v.averageCheck >= :minCheck', { minCheck });
if (maxCheck) qb.andWhere('v.averageCheck <= :maxCheck', { maxCheck });
if (feature) qb.andWhere('f.code IN (:...features)', { features: feature.split(',') });
if (tag) qb.andWhere('t.slug IN (:...tags)', { tags: tag.split(',') });
if (type) qb.andWhere('ty.slug IN (:...types)', { types: type.split(',') });
if (lat && lng && radiusKm) {
  qb.andWhere(`ST_DWithin(v.location, ST_MakePoint(:lng, :lat)::geography, :meters)`,
              { lng, lat, meters: radiusKm * 1000 });
}
```

**PostGIS extension:** `CREATE EXTENSION IF NOT EXISTS postgis;` + колонка `v.location geography(POINT, 4326)`, генерується з `latitude/longitude` через тригер.

**Сортування:** `rating` / `check` / `newest` / `name` / `distance`.

**Кеш:** `venues:list:{sha1(queryString)}` TTL 60 с. Інвалідація на `VenueStatusChanged`, `VenueUpdated`, `ReviewCreated`, `ReviewUpdated`, `ReviewDeleted`.

### Модерація

```
pending → approved | rejected
approved → archived (м'яке видалення)
```

Редагування після `approved` НЕ повертає в `pending`.

### Файли

- Multer → `uploads/venues/{venueId}/{uuid}.{ext}`
- URL: `/static/venues/{venueId}/{uuid}.{ext}`
- Ліміти: max 5 МБ, тільки jpeg/png/webp, max 10 фото на заклад
- mainPhoto — окремий `PATCH /venues/:id/main-photo { photoId }`

---

## 5. Reviews, Favorites, Hangouts

### Reviews

```
POST   /api/v1/venues/:venueId/reviews          -- permission: review:create
                                                 унікальність (venueId, userId) → 409
GET    /api/v1/venues/:venueId/reviews          -- публічний, featured зверху
GET    /api/v1/reviews/:id
PATCH  /api/v1/reviews/:id                      -- permission: review:edit:own|any
DELETE /api/v1/reviews/:id
GET    /api/v1/me/reviews
POST   /api/v1/reviews/:id/feature              -- permission: review:feature
```

**Listener `Review.afterInsert/Update/Delete`:** перерахунок `Venue.ratingAvg/ratingCount` у тій самій транзакції.

**Валідація:** `rating` 1..5, `text` 10..2000 chars, `checkPhoto` max 3 МБ. Rate limit 3/год на user.

### Favorites

```
POST   /api/v1/me/favorites/:venueId            -- ідемпотентно
DELETE /api/v1/me/favorites/:venueId
GET    /api/v1/me/favorites
```

### Hangouts

```
POST   /api/v1/venues/:venueId/hangouts         -- permission: hangout:create
GET    /api/v1/hangouts                          -- публічний список відкритих
GET    /api/v1/hangouts/:id                      -- auth; тільки учасник або admin
POST   /api/v1/hangouts/:id/join                 -- permission: hangout:create
POST   /api/v1/hangouts/:id/leave                -- творець не може, поки є інші
POST   /api/v1/hangouts/:id/cancel               -- creator або super_admin
GET    /api/v1/me/hangouts
GET    /api/v1/me/hangouts/created
GET    /api/v1/me/hangouts/joined
```

**Валідація:** `date >= today`, `time HH:mm`, `purpose` 10..500, `groupSize` 1..20, `desiredBudget` 0..100000 UAH.

**Сповіщення (in-app через Redis pub/sub + WebSocket):**
- Хтось приєднався до мого Hangout
- Hangout заповнено (всі учасники)

**Cron кожні 5 хв:** `open/filled → completed` коли `date + time < now()`.

---

## 6. News, Complaints, Analytics, Admin

### News

```
GET    /api/v1/news                              -- query: category, venueId, isPromoted, page, sort
GET    /api/v1/news/:id
POST   /api/v1/me/venues/:venueId/news           -- permission: news:manage:own|any
PATCH  /api/v1/news/:id
DELETE /api/v1/news/:id
POST   /api/v1/admin/news                        -- глобальна новина (super_admin)
```

**Сортування:** `ORDER BY isPromoted DESC, publishedAt DESC`. `promotedUntil < now()` → listener знімає `isPromoted=false`.

**Валідація:** `title` 5..200, `content` 20..5000, `category` enum, `image` max 5 МБ.

### Complaints

```
POST   /api/v1/complaints                        -- auth required
GET    /api/v1/admin/complaints                  -- permission: complaint:manage
POST   /api/v1/admin/complaints/:id/resolve      -- body: { status, note? }
```

Rate limit 3/год, текст ≥ 20 chars. Подія `ComplaintCreated` → пуш супер-адмінам.

### Analytics

**Збір переглядів:**
```
POST   /api/v1/venues/:id/view                   -- auth optional, dedup раз на 30 хв (Redis TTL)
```

**Endpoints:**
```
GET    /api/v1/me/venues/:id/analytics           -- owner або super_admin
GET    /api/v1/admin/analytics/overview          -- super_admin
```

**Метрики (MVP):** totalViews, uniqueViews, series за day/week/month, favoritesAdded, reviews, routeClicks, hangoutsCreated.

**Події (через `event-emitter`):** `VenueViewed`, `FavoriteAdded`, `ReviewCreated`, `RouteClicked`, `HangoutCreated`. Запис у `analytics_events` (append-only), агрегація через `date_trunc`.

**Кеш:** `analytics:venue:{id}:{from}:{to}:{groupBy}` TTL 5 хв.

### Admin (super_admin)

```
GET    /admin/venues/pending
POST   /admin/venues/:id/{approve,reject,assign-owner}

GET    /admin/complaints
POST   /admin/complaints/:id/resolve

GET    /admin/users
GET    /admin/users/:id
PATCH  /admin/users/:id
DELETE /admin/users/:id                          -- м'яке
POST   /admin/users/:id/roles                    -- body: { roleCode, action: 'add'|'remove' }

GET    /admin/news
POST   /admin/news
PATCH  /admin/news/:id
DELETE /admin/news/:id

GET    /admin/analytics/overview
```

**Audit log:** всі admin-дії записуються в `AuditLog` з before/after jsonb.

---

## 7. Інфраструктура, тестування, безпека

### Docker

`docker-compose.yml` — три сервіси: `postgres` (postgis/postgis:16-3.4-alpine), `redis` (redis:7-alpine), `backend` (NestJS dev з `nest start --watch`). Healthcheck на postgres. Volume `uploads:/app/uploads` для бекенду.

`Dockerfile` — `node:22-alpine`, corepack pnpm.

### Тестування (TDD)

- Unit — `*.spec.ts` поруч із кодом, Jest
- Integration — `*.int-spec.ts`, реальна Postgres + Redis у `test:docker-compose.test.yml`
- E2E — `test/*.e2e-spec.ts`, supertest

**Coverage gate:** ≥80% statements, ≥75% branches.

**Скрипти:**
```
"test" / "test:watch" / "test:cov"
"test:int": jest --config ./test/jest-int.json
"test:e2e": jest --config ./test/jest-e2e.json
"test:int:up" / "test:int:down"
"migration:generate" / "migration:run" / "migration:revert"
"seed": ts-node src/seed.ts
```

**TDD порядок для кожної фічі:** чернетка тестів → entity/DTO → repository+service → controller+guards → E2E → edge cases → refactor.

### Логування, health

- `nestjs-pino` (структуровані JSON, request-id)
- `GET /api/v1/health` → `{ status, db, redis }` без auth
- Prometheus `/metrics` — Should Have

### Безпека

- `helmet`, `compression`, CORS whitelist
- Body limit 10 МБ
- Rate limiting через `@nestjs/throttler` + Redis
- Global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`)
- File upload: Multer + fileFilter + size limits; filename знецінюється
- Тільки параметризовані SQL через TypeORM
- `class-sanitizer` на текстах
- Bcrypt cost 12
- Access JWT 15 хв + refresh rotation + Redis blacklist
- httpOnly Secure SameSite=Lax cookie для refresh
- Секрети тільки в env, `.env` у `.gitignore`, `.env.example` в репо

### Definition of Done (на фічу)

- [ ] Migration створена й протестована (revert + run)
- [ ] Entity + Repository + Service + Controller
- [ ] Unit-тести (≥80% statements)
- [ ] Integration-тести для repository
- [ ] E2E для controller (auth, permission, happy + error)
- [ ] Validation DTO з class-validator
- [ ] Guards перевірені
- [ ] Події зареєстровані
- [ ] Cache invalidation
- [ ] Audit log (для admin-дій)
- [ ] README оновлений
- [ ] OpenAPI spec оновлено через `@nestjs/swagger`

### Структура файлів (стартова)

```
backend-final/
├── docker-compose.yml
├── docker-compose.test.yml
├── Dockerfile
├── .env.example
├── .dockerignore
├── .github/workflows/ci.yml
├── docs/
│   ├── api.md
│   └── superpowers/specs/2026-08-26-piyachok-design.md
├── src/
│   ├── config/
│   ├── common/
│   │   ├── decorators/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── filters/
│   │   ├── services/
│   │   └── utils/
│   ├── modules/
│   │   ├── rbac/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── venues/
│   │   ├── reviews/
│   │   ├── favorites/
│   │   ├── hangouts/
│   │   ├── news/
│   │   ├── complaints/
│   │   ├── analytics/
│   │   ├── admin/
│   │   └── health/
│   ├── events/
│   │   ├── events.ts
│   │   └── listeners/
│   ├── migrations/
│   ├── app.module.ts
│   ├── app.controller.ts
│   ├── main.ts
│   └── seed.ts
├── test/
└── uploads/                  -- volume, gitignored
```

---

## 8. Наступний крок

Після погодження цього документа — викликати `superpowers:writing-plans` для створення покрокового implementation plan, потім — `superpowers:subagent-driven-development` для TDD-виконання.
