# Пиячок — бекенд

NestJS API для каталогу закладів «Пиячок» (`:3000`, префікс `/api/v1`). Повний опис функціоналу — у [`DESCRIPTION.md`](DESCRIPTION.md).

## Технології і навіщо вони

- **NestJS 11 + TypeScript** — модульна структура (`src/modules/*`: auth, venues, reviews, news, complaints, messages, favorites, hangouts, analytics, admin…), DI, гварди й пайпи з коробки.
- **PostgreSQL 16 + PostGIS** — геопошук закладів: `geography(POINT,4326)` + GIST-індекс, радіус через `ST_DWithin`, сортування по дистанції `ST_Distance`.
- **TypeORM** — entity-схема, міграції (не автопроганяються — запускаються `pnpm migration:run`/сервісом `migrate`), snake_case naming strategy, soft-delete користувачів і закладів.
- **Redis (ioredis)** — чотири ролі: кеш дозволів користувача (5 хв), кеш списків закладів (60 с) і зустрічей (30 с), ревокація refresh-токенів (TTL 30 днів), дедуплікація переглядів сторінок (30 хв).
- **JWT + passport** (`@nestjs/jwt`, `passport-jwt`) — access 15 хв / refresh 30 днів з ротацією й ревокацією; `passport-google-oauth20`, `passport-facebook` — OAuth-вхід; `bcryptjs` — хешування паролів.
- **class-validator + class-transformer** — валідація DTO через глобальний ValidationPipe (whitelist, forbidNonWhitelisted): пароль, вік 18+, EULA, текст відгуків/скарг, дата зустрічі.
- **@nestjs/swagger** — OpenAPI-документація на `/api/v1/docs` (тільки поза prod) з Bearer auth.
- **@nestjs/throttler** — rate limiting (глобально 100/хв + ліміти на auth: реєстрація 5/год, логін 10/хв).
- **@nestjs/schedule** — cron-завдання: переведення минулих зустрічей у `completed` (кожні 5 хв).
- **@nestjs/event-emitter** — доменні події: інвалідація кешів, запис аналітичних подій, авто-грант ролей.
- **@vercel/blob** — файлове сховище фото на проді (локально — диск `uploads/` + роздача `/static/*`, у Vercel-оточенні автоматично Blob по наявності `BLOB_STORE_ID`/`BLOB_READ_WRITE_TOKEN`).
- **nestjs-pino** — структуровані логи; **helmet**, **compression** — безпека і стискання HTTP; **@nestjs/config** з fail-fast валідацією env (JWT/DB-секрети обовʼязкові).
- **Jest + supertest** — unit-тести (`pnpm test`) і e2e (`pnpm test:e2e`).

## Запуск через Docker

1. Скопіюй зразок конфігу і заповни значення (JWT/DB-секрети обовʼязкові — без них стартує fail-fast):

   ```bash
   cp .env.example .env
   ```

2. Підніми стек (postgres + redis + бекенд з hot-reload; міграції накочує окремий контейнер `migrate` автоматично, слідом сіється супер-адмін `admin@gmail.com` / `Admin1234` — якщо такий користувач уже є в базі, створення пропускається; перекрити креді можна через `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` у `.env`):

   ```bash
   docker compose up -d
   ```

   Логи: `docker compose logs -f backend`. Зупинка: `docker compose down`.

   Підказка: якщо змінилися `package.json`, образ контейнерів треба перезібрати —
   `docker compose build migrate backend`, інакше старий образ не знайде нові скрипти.

3. API: `http://localhost:3000/api/v1`, Swagger (у dev): `http://localhost:3000/api/v1/docs`.

## Демо-дані (seed)

Стек сам сіє тільки супер-адміна. Повний демо-каталог (3 юзери, 15 закладів з фото, теги-довідник та відгуки з новинами) накочується одним прогоном:

```bash
docker compose run --rm migrate pnpm seed:demo
```

або локально без Docker (потрібен оновлений `pnpm install`, бо сід-скрипт у `package.json`):

```bash
pnpm seed:demo
```

Що створює:

- **3 користувачі** — `user1@gmail.com` / `user2@gmail.com` / `user3@gmail.com`, спільний пароль `User1234` (профілі: Андрій Мельник 27, Олег Савчук 31, Тарас Гнатюк 29);
- **теги-довідник** (10 тегів — коктейлі, кухня, жива музика тощо; у міграціях їх немає);
- **15 закладів** одразу у статусі `approved` з повною інфою (опис, адреса, координати, контакти, графік, тип/фічі/теги) і по 4–5 фото (webp з `seed-assets/` копіюються в `uploads/`, працює оффлайн);
- **по 1 відгуку** на кожен заклад (рецензент — інший юзер, ніж власник; оцінки 3/4/5);
- **по 1 новині** з фото на кожен заклад (published).

Прапор `--pending` створює заклади у статусі `pending` — для ручного тесту флоу апруву з адмінки (після апруву власник отримує роль `venue_admin`):

```bash
docker compose run --rm migrate pnpm seed:demo -- --pending
```

Сід **ідемпотентний**: повторний прогін пропускає вже-існуючі юзери/заклади/відгуки/новини — дублів не робить (жодних конфліктів, просто «існує — пропущено»).

## Запуск без Docker

Потрібні Node 22, pnpm, PostgreSQL 16 з PostGIS і Redis.

1. Заповни `.env` (як вище); для локальних postgres/redis вистав `DATABASE_HOST=localhost` і `REDIS_HOST=localhost`.
2. Залежності та міграції:

   ```bash
   pnpm install
   pnpm run migration:run
   ```

3. Сервер:

   ```bash
   pnpm run start:dev
   ```

4. Тести (потрібні ті ж JWT-секрети в `.env`; e2e стукає до живого backend/redis):

   ```bash
   pnpm run test
   pnpm run test:e2e
   ```