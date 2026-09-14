# Пиячок — Runbook

Бекенд платформи для пошуку закладів (бари/паби), відгуків, новин, скарг, аніматних зустрічей («пиячок») та аналітики.

Стек: **NestJS 11 · TypeORM 1.x · PostgreSQL 16 + PostGIS · Redis 7 · Passport JWT · pnpm**.

---

## 1. Передумови

| Залежність | Версія |
|---|---|
| Node.js | ≥ 22.x |
| pnpm | ≥ 10.x |
| Docker + Docker Compose | будь-яка актуальна |

---

## 2. Швидкий старт (Docker — усе в контейнерах)

```bash
cp .env.example .env          # якщо ще немає .env
pnpm install
docker compose up -d          # postgres + redis + backend (hot-reload)
```

- Бекенд: `http://localhost:3000/api/v1`
- Postgres: `localhost:5432` (user `piyachok`, pass `piyachok_dev`, db `piyachok`)
- Redis: `localhost:6379`

Контейнер `backend` монтує `./src` і запускає `pnpm start:dev` (watch). Міграції треба прогнати окремо (див. §5).

> PostGIS-образ потрібен для геопошуку закладів (колонка `geography`).

---

## 3. Локальний запуск (бекенд на хості, БД/Redis у Docker)

Зручно для дебагу — бекенд працює напряму під Node, а state піднято в контейнерах:

```bash
# 1. Підняти тільки інфраструктуру
docker compose up -d postgres redis

# 2. Встановити залежності
pnpm install

# 3. Прогнати міграції (див. §5)
pnpm migration:run

# 4. Запустити бекенд
pnpm start:dev          # http://localhost:3000/api/v1, hot-reload
```

Інші скрипти запуску:

```bash
pnpm start              # звичайний запуск (без watch)
pnpm start:debug        # watch + --debug (inspect)
pnpm start:prod         # node dist/main (після pnpm build)
```

---

## 4. Змінні оточення (`.env`)

Копія `.env.example`:

```env
NODE_ENV=development
PORT=3000
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=piyachok
DATABASE_PASS=piyachok_dev
DATABASE_NAME=piyachok
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_ACCESS_SECRET=change_me_access_min_32_chars_xxxxxxxx
JWT_REFRESH_SECRET=change_me_refresh_min_32_chars_xxxx
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
GOOGLE_CLIENT_ID=              # необов'язково (OAuth)
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback
FACEBOOK_APP_ID=               # необов'язково (OAuth)
FACEBOOK_APP_SECRET=
FACEBOOK_CALLBACK_URL=http://localhost:3000/api/v1/auth/facebook/callback
FRONTEND_URL=http://localhost:3001
LOG_LEVEL=debug
```

> У проді обов'язково замінити `JWT_*_SECRET` на міцні секрети. CORS дозволяє лише `FRONTEND_URL`.

---

## 5. Міграції

Міграції описані в `src/migrations/`, реєстр — у `src/config/data-source.ts`.

```bash
pnpm migration:run        # застосувати всі pending-міграції
pnpm migration:revert     # відкотити останню
pnpm migration:generate   # згенерувати diff з сутностей (після змін ентитів)
```

Міграції (хронологічно):

| Файл | Що створює |
|---|---|
| `1700000000000-Init` | users, profiles, oauth_accounts, roles, permissions, role_permissions (+ seed RBAC) |
| `1700000001000-Venues` | venues, venue_photos, venue_tags, tags, venue_features, venue_types |
| `1700000002000-Reviews` | reviews (unique venueId+userId) |
| `1700000003000-Favorites` | favorites (composite PK userId+venueId) |
| `1700000004000-News` | news (varchar-enum status) |
| `1700000005000-Complaints` | complaints (reason/status enums, зв'язки з venue/review) |
| `1700000006000-Hangouts` | hangouts, hangout_participants |
| `1700000007000-Analytics` | venue_views, analytics_events (jsonb payload) |
| `1700000008000-Admin` | audit_logs, soft-delete `deletedAt` на users |

> У проєкті **не використовуються** нативні Postgres-enum'и — усі TS-enum'и зберігаються як `varchar(16)` (конвенція `VenueStatus`).

---

## 6. Тести

### Юніт-тести + coverage

```bash
pnpm test                 # усі *.spec.ts у src/
pnpm test:watch           # watch-режим
pnpm test:cov             # + coverage-звіт у ./coverage
```

Coverage-збір виключає інфраструктуру (`main.ts`, `app.module.ts`, `*.module.ts`, `config/data-source.ts`, `config/env.validation.ts`, `migrations/**`) — її покриває E2E. Поточний поріг: **≥ 80% statements**.

### E2E-тести (потребують тест-контейнери)

```bash
docker compose -f docker-compose.test.yml up -d   # postgres-test:5433, redis-test:6380
pnpm test:e2e
```

E2E-інфра (`test/helpers/test-app.ts`) перед кожним suitом дропає/рекреатє `public`-схему і проганжає міграції з нуля. Env для тестової БД виставляється у `test/setup-e2e.ts` **до** імпорту `AppModule` (ConfigModule кешує env при імпорті).

Suites: `auth`, `venues`, `reviews`, `favorites`, `hangouts`, `app` (health).

### Дебаг

```bash
pnpm test:debug           # node --inspect-brk, attach на порту 9229
```

---

## 7. RBAC: ролі та дозволи

Сідяться міграцією `Init`.

### Ролі

| Код | Назва | Дозволи |
|---|---|---|
| `user` | Базовий акаунт | `venue:create`, `review:create`, `review:edit:own`, `hangout:create`, `news:manage:own` |
| `venue_admin` | Адмін закладу | усе з `user` + `venue:edit:own`, `analytics:view:own` |
| `critic` | Критик | усе з `user` + `review:feature` |
| `super_admin` | Супер-адмін | усі 15 дозволів |

### Дозволи

```
venue:create · venue:edit:own · venue:edit:any · venue:moderate
review:create · review:edit:own · review:edit:any · review:feature
hangout:create · news:manage:own · news:manage:any · complaint:manage
user:manage · analytics:view:own · analytics:view:all
```

### Як отримати адмін-доступ для тестів

Реєстрація видає лише роль `user`. Щоб дістатися до admin-ендпоінтів, підвищте користувача до `super_admin` напряму в БД:

```sql
-- підключення: psql -h localhost -U piyachok -d piyachok
INSERT INTO "user_roles"("userId", "roleId")
SELECT u.id, r.id FROM "users" u, "roles" r
WHERE u.email = 'you@x.com' AND r.code = 'super_admin'
ON CONFLICT DO NOTHING;
```

Після цього перелогіньтесь — JWT вже міститиме нову роль. Альтернативно — через `POST /api/v1/admin/users/:id/roles` (але воно саме вимагає `user:manage`).

---

## 8. API-довідник

Усі маршрути під префіксом **`/api/v1`**. `ValidationPipe` з `whitelist + forbidNonWhitelisted + transform` — зайві поля в тілі дають 400. Автентифікація — `Authorization: Bearer <accessToken>`. Публічні ендпоінти позначені `@Public()`.

### Auth (`/auth`)

| Метод | Шлях | Доступ | Опис |
|---|---|---|---|
| POST | `/auth/register` | публічний | реєстрація → `{ accessToken, refreshToken, user }` |
| POST | `/auth/login` | публічний | логін → `{ accessToken, refreshToken, user }` |
| POST | `/auth/refresh` | публічний | ротація refresh-токена (старий відкликається) |
| POST | `/auth/logout` | публічний | відкликання refresh-токена |
| GET | `/auth/me` | JWT | поточний користувач → `{ data: { id, email, roles } }` |
| GET | `/auth/google` | публічний | OAuth redirect |
| GET | `/auth/google/callback` | публічний | OAuth callback |
| GET | `/auth/facebook` | публічний | OAuth redirect |
| GET | `/auth/facebook/callback` | публічний | OAuth callback |

### Заклади (`/venues`)

| Метод | Шлях | Доступ | Опис |
|---|---|---|---|
| GET | `/venues` | публічний | список (фільтри/пагінація/геопошук) |
| GET | `/venues/:id` | публічний | деталь закладу + ratingAvg/ratingCount |
| POST | `/venues` | `venue:create` | створити (статус `pending`) |
| PATCH | `/venues/:id` | `venue:edit:own`/`:any` | оновити |
| POST | `/venues/:id/photos` | власник | завантажити фото (multipart) |

### Модерація закладів (`/admin/venues`, `venue:moderate`)

| Метод | Шлях | Опис |
|---|---|---|
| GET | `/admin/venues/pending` | список на модерацію |
| POST | `/admin/venues/:id/approve` | схвалити |
| POST | `/admin/venues/:id/reject` | відхилити |
| POST | `/admin/venues/:id/assign-owner` | призначити власника |

### Відгуки (кореневі)

| Метод | Шлях | Доступ | Опис |
|---|---|---|---|
| POST | `/venues/:venueId/reviews` | `review:create` | залишити відгук (1 на юзера/заклад) |
| GET | `/venues/:venueId/reviews` | публічний | список відгуків |
| GET | `/reviews/:id` | публічний | один відгук |
| PATCH | `/reviews/:id` | `review:edit:own`/`:any` | редагувати |
| DELETE | `/reviews/:id` | `review:edit:own`/`:any` | видалити (soft) |
| POST | `/reviews/:id/feature` | `review:feature` | закріпити |
| GET | `/me/reviews` | JWT | мої відгуки |

Створення/оновлення відгуку тригерить перерахунок `ratingAvg`/`ratingCount` на закладі + інвалідацію кешу.

### Обране (`/me/favorites`, JWT)

| Метод | Шлях | Опис |
|---|---|---|
| POST | `/me/favorites/:venueId` | додати (ідемпотентно) |
| DELETE | `/me/favorites/:venueId` | видалити |
| GET | `/me/favorites?page=&limit=` | список із пагінацією |

### Пиячки / зустрічі (кореневі)

| Метод | Шлях | Доступ | Опис |
|---|---|---|---|
| GET | `/hangouts` | публічний | публічний список (з кешем Redis) |
| POST | `/venues/:venueId/hangouts` | `hangout:create` | створити (автоматично учасник) |
| POST | `/hangouts/:id/join` | JWT | приєднатись (→ `filled` при досягненні groupSize) |
| POST | `/hangouts/:id/leave` | JWT | вийти |
| POST | `/hangouts/:id/cancel` | автор | скасувати |
| GET | `/hangouts/:id` | публічний | деталі + учасники |
| GET | `/me/hangouts` | JWT | мої пиячки |

Cron `@every 5 minutes` позначає минулі заповнені зустрічі як `completed`.

### Новини (кореневі + admin)

| Метод | Шлях | Доступ | Опис |
|---|---|---|---|
| GET | `/news` | публічний | публічні опубліковані |
| GET | `/news/:id` | публічний | одна новина |
| POST | `/me/venues/:venueId/news` | `news:manage:own` | створити для закладу |
| PATCH | `/news/:id` | `news:manage:own`/`:any` | оновити |
| DELETE | `/news/:id` | `news:manage:own`/`:any` | архівувати |
| GET | `/admin/news` | `news:manage:any` | усі новини |
| POST | `/admin/news` | `news:manage:any` | глобальна новина |

### Скарги (кореневі + admin)

| Метод | Шлях | Доступ | Опис |
|---|---|---|---|
| POST | `/complaints` | JWT | подати скаргу (на venue **або** review) |
| GET | `/admin/complaints` | `complaint:manage` | список pending |
| POST | `/admin/complaints/:id/resolve` | `complaint:manage` | вирішити |

### Аналітика (кореневі + admin)

| Метод | Шлях | Доступ | Опис |
|---|---|---|---|
| POST | `/venues/:id/view` | публічний | запис перегляду (Redis-dedup 30 хв) |
| GET | `/me/venues/:id/analytics` | власник / `analytics:view:all` | статистика закладу |
| GET | `/admin/analytics/overview` | `analytics:view:all` | загальний огляд |

### Admin-користувачі (`/admin/users`, `user:manage`)

| Метод | Шлях | Опис |
|---|---|---|
| GET | `/admin/users?page=&limit=` | список (без soft-deleted) |
| GET | `/admin/users/:id` | один користувач |
| PATCH | `/admin/users/:id` | оновити профіль |
| DELETE | `/admin/users/:id` | soft-delete (не можна себе) |
| POST | `/admin/users/:id/roles` | body `{ roleCode, action: 'add'\|'remove' }` + аудит + emit `USER_ROLE_ADDED/REMOVED` |

### Профіль (`/me`, JWT)

| Метод | Шлях | Опис |
|---|---|---|
| GET | `/me` | мій профіль |
| PATCH | `/me/profile` | оновити профіль |

### Health (`/health`)

| Метод | Шлях | Доступ | Опис |
|---|---|---|---|
| GET | `/health` | публічний | `{ status: 'ok', timestamp }` |
| GET | `/health/db` | публічний | перевірка БД + Redis → `{ status, db, redis }` |

---

## 9. Покроковий сценарій (curl)

```bash
BASE=http://localhost:3000/api/v1

# 1. Реєстрація
curl -s -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"me@x.com","password":"StrongPass1","firstname":"Ім","lastname":"Прізв","acceptEula":true}'
# → { "accessToken":"...", "refreshToken":"...", "user":{...} }

TOKEN=$(curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"me@x.com","password":"StrongPass1"}' | jq -r .accessToken)
AUTH="Authorization: Bearer $TOKEN"

# 2. Створити заклад (статус pending)
curl -s -X POST $BASE/venues -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"Заклад у дворику","address":"вул. Зустрічна, 12","latitude":50.45,"longitude":30.52,"averageCheck":250}'
# → { "data": { "id":"<venueId>", "status":"pending", ... } }

# 3. Підвищити себе до super_admin (psql) — див. §7, потім перелогіньтесь

# 4. Схвалити заклад
curl -s -X POST $BASE/admin/venues/<venueId>/approve -H "$AUTH"

# 5. Залишити відгук
curl -s -X POST $BASE/venues/<venueId>/reviews -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"rating":5,"text":"Чудове місце, дуже сподобалось!"}'

# 6. Додати в обране
curl -s -X POST $BASE/me/favorites/<venueId> -H "$AUTH"

# 7. Створити пиячку
curl -s -X POST $BASE/venues/<venueId>/hangouts -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"date":"2026-12-01","time":"19:30","purpose":"Обговорити нові ідеї проєкту за кухлем","groupSize":4}'

# 8. Запис перегляду (публічний)
curl -s -X POST $BASE/venues/<venueId>/view
```

---

## 10. Структура проєкту

```
src/
├── main.ts                      # bootstrap: helmet, compression, CORS, ValidationPipe, prefix /api/v1
├── app.module.ts                # агрегатор усіх модулів
├── config/                      # data-source (TypeORM CLI), env.validation, typeorm.config
├── migrations/                  # 8 міграцій
├── common/
│   ├── decorators/              # @CurrentUser, @Permissions, @Public
│   ├── filters/                 # AllExceptionsFilter
│   ├── guards/                  # JwtAuthGuard, PermissionsGuard
│   ├── services/                # CacheService (ioredis), FileStorageService
│   └── utils/                   # pagination.util
└── modules/
    ├── auth/                    # контролер, сервіси, JWT, OAuth/local стратегії, DTO
    ├── users/                   # користувач + профіль
    ├── rbac/                    # roles, permissions, PermissionsService, listener
    ├── venues/                  # заклади, фото, теги, фічі, типи, admin-модерація, cache-listener
    ├── reviews/                 # відгуки + перерахунок рейтингу
    ├── favorites/               # обране
    ├── hangouts/                # пиячки, учасники, cron, cache-listener
    ├── news/                    # новини закладів + глобальні
    ├── complaints/              # скарги + admin-вирішення
    ├── analytics/               # перегляди, події, агрегація, event-listener
    ├── admin/                   # admin-users, audit-log
    └── health/                  # health + health/db
test/                            # E2E: helpers/test-app, helpers/seed, setup-e2e, *.e2e-spec.ts
docs/                            # плани + цей runbook
```

---

## 11. Поширені операції

```bash
# Лінт/форматування (УВАГА: lint має --fix — може реформатувати багато файлів)
pnpm exec prettier --write src/path/to/file.ts   # точково
pnpm lint                                        # eslint --fix на всьому (обережно)

# Білд
pnpm build                  # → dist/

# Переглянути логи контейнера
docker compose logs -f backend

# Зупинити інфру
docker compose down                 # без видалення томів
docker compose down -v              # з видаленням томів (викине БД)

# Зайти в БД
docker compose exec postgres psql -U piyachok -d piyachok

# Redis CLI
docker compose exec redis redis-cli
```

---

## 12. Діагностика

| Симптом | Причина / виправлення |
|---|---|
| `ECONNREFUSED 5432` | не піднято postgres: `docker compose up -d postgres` |
| 401 на всіх захищених ендпоінтах | прострочений access — виконайте `POST /auth/refresh` |
| 403 на admin-ендпоінтах | у JWT немає потрібної ролі — підвищте роль (§7) і перелогіньтесь |
| 400 `property x should not exist` | `forbidNonWhitelisted` — приберіть зайве поле з тіла |
| Міграції не застосовуються | перевірте `DATABASE_*` у `.env` та що нова міграція додана в `data-source.ts` |
| Coverage < 80% | `pnpm test:cov`, доповніть spec-и для непокритих файлів |