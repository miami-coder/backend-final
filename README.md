# Пиячок — монорепо (бекенд + фронтенд)

Вебплатформа для пошику й обговорення закладів (бари, клуби, караоке, resto-бари): каталог із фільтрами і сортуванням, відгуки з фото чека, новини закладів, обране, зустрічі («пиячки»), листування, скарги, аналітика й адмінські панелі. Повний опис — у [`apps/api/DESCRIPTION.md`](apps/api/DESCRIPTION.md).

| Частина | Шлях | Технології | Порт |
|---|---|---|---|
| Бекенд (REST API, Swagger) | `apps/api` | NestJS 11, TypeScript, PostgreSQL 16 + PostGIS, Redis, TypeORM | `:3000` |
| Фронтенд (SSR + клієнтська логіка) | `apps/web` | Next.js 16 (App Router, React Compiler), React 19, Tailwind v4 | `:3001` |

Це **один репозиторій-монорепо** на pnpm-воркспейсі: клонувати, інсталювати й запускати все одними командами з кореня.

## Структура

```
piyachok/
├── apps/api/        # бекенд: src, test (unit + e2e), міграції, Postman-колекція, seed-assets
├── apps/web/        # фронтенд: Next.js App Router, BFF-проксі /api/v1 і /api/auth
├── docker-compose.yml  # postgres + redis + api + web
├── pnpm-workspace.yaml # воркспейс pnpm
└── package.json     # спільні скрипти (dev/build/test/db:up/…)
```

Залежності обох частин інсталюються однією `pnpm install` у корінь (`pnpm-lock.yaml` — кореневий). Папка `apps/api/seed-assets/` (18 МБ фото) в репозиторії свідомо — з неї `pnpm seed:demo` працює офлайн.

## Швидкий старт (локально)

Потрібні: Node 22 (pnpm 10 активується corepack'ом) і Docker (для бази).

```bash
pnpm install
# скопіюйте .env (архів від автора проєкту) у apps/api/.env
# (шаблон — apps/api/.env.example; JWT/DB-секрети обовʼязкові — без них стартує fail-fast)

pnpm db:up          # postgres + redis у docker
pnpm migrate        # міграції + сеється супер-адмін admin@gmail.com / Admin1234
pnpm dev            # api :3000 + web :3001 паралельно
```

Опційно демо-дані (3 юзери, 15 закладів, відгуки, новини з фото — офлайн):
- **якщо api працює локально** (`pnpm dev`): просто `pnpm seed:demo`;
- **якщо api працює в контейнерах**: сідити зсередини контейнера, щоб фото потрапили в docker-том, який бачить api:
  ```bash
  docker compose run --rm api pnpm --filter backend-final seed:demo
  ```
  (сід з хоста при контейнерному api запише файли поза томом — картинки отдаватимуться 404).

**Фронт `.env` не потребує** — BFF-проксі йде на `http://localhost:3000` за фолбеком. Корисні адреси:

- Web: http://localhost:3001
- API: http://localhost:3000 (`/api/v1/*`), Swagger: http://localhost:3000/api/v1/docs (поза prod)
- Тестовий супер-адмін: `admin@gmail.com` / `Admin1234` (перекривається `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` у `apps/api/.env`)

## Запуск у Docker (все в контейнерах)

```bash
docker compose up -d --build
```

Піднімає postgres + redis + api (hot-reload) + web; міграції накочує контейнер `migrate` при старті. api → http://localhost:3000, web → http://localhost:3001. Зупинка: `docker compose down`.

> Hot-reload фронта в контейнерах не передбачений (вихідники запікаються в образ) — для розробки використовуйте локальний варіант `pnpm dev`.

> `--env-file apps/api/.env` не потрібен: compose читає кредси Postgres (`DATABASE_*`) прямо з `apps/api/.env` через `env_file`.

## Тести

```bash
pnpm test            # обидві пачки: jest (бек) + vitest (фронт)
pnpm typecheck       # tsc обох частин (--if-present)
pnpm build           # nest build + next build
```

e2e бека — `pnpm test:e2e` з кореня: сам створює роль/БД `piyachok_test` у докер-контейнері postgres (потрібен піднятий стекс: `docker compose up -d postgres redis`), накочує міграції й ганяє сюіти. Відомі 2 e2e-фейли auth (ревокація refresh-токена: `rotates refresh token`/`logs out`) — пережиті з попередньої архітектури сесії, існують і на чистій мастер-голові; все решта зелена (юніт бека 291, фрона 398).

Прийоми, якщо щось не так:
- api у docker іноді зависає на компіляції при редагуваннях ззовні — `docker restart piyachok-api-1`;
- зміни фронта в docker-стеку не побачиш без пересборки: `docker compose up -d --build web`;
- протухлі `.next/dev/types` на локальному typecheck фронта — `rm -rf apps/web/.next/dev/types`.

## Прод

| Сервіс | URL | Vercel-проєкт |
|---|---|---|
| API | https://pyiachok-backend.vercel.app | `pyiachok-backend` |
| Web | https://pyiachok-frontend.vercel.app | `pyiachok-frontend` |

Обидва проєкти деплояться з цього монорепо: у налаштуваннях Vercel заданий Root Directory (`apps/api` / `apps/web`). Фото на проді живуть у Vercel Blob.

## Postman

Колекція: `apps/api/piyachok-api.postman_collection.json`, оточення: `apps/api/piyachok-local.postman_environment.json`.