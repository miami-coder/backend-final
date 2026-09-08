# Пиячок — фронтенд каталогу закладів України

«Пиячок» — каталог барів, ресторанів та кафе України: рейтинги, відгуки, новини та зустрічі.
Це фронтенд (Next.js 16 App Router, React 19, TypeScript, Tailwind v4, zod). Інтерфейс — українською.

## Запуск

**Бекенд** — проєкт `backend-final` (NestJS), доступний на `http://localhost:3000/api/v1`:

```bash
cd backend-final
pnpm start:dev
```

**Фронтенд** — порт 3001:

```bash
pnpm install
pnpm dev
# → http://localhost:3001
```

**Змінні оточення** — `.env.local`:

```
BACKEND_URL=http://localhost:3000
```

`BACKEND_URL` — адреса бекенда (за замовчуванням `http://localhost:3000`); фронтенд проксирує запити на `${BACKEND_URL}/api/v1`.

## Скрипти

| Команда | Призначення |
| --- | --- |
| `pnpm dev` | dev-сервер на порту 3001 |
| `pnpm build` | продакшн-збірка |
| `pnpm start` | запуск продакшн-збірки |
| `pnpm test` | тести (Vitest + React Testing Library) |
| `pnpm test:watch` | тести у режимі watch |
| `pnpm typecheck` | перевірка типів (`tsc --noEmit`) |
| `pnpm lint` | ESLint |

Потрібен Node 20+ і пакувальник `pnpm`.

## Архітектура (BFF)

Фронтенд не звертається до бекенда напряму з браузера — він працює як BFF (Backend-For-Frontend):

- Усі клієнтські запити йдуть на `/api/v1/*`, які переспрямовуються на `${BACKEND_URL}/api/v1` (маршрут `src/app/api/v1/[...path]/route.ts`).
- Пара JWT-токенів (access + refresh) зберігається в httpOnly-cookie `piyachok_session` — токени недоступні з JS (`document.cookie` їх не містить), refresh виконується на сервері.
- Оновлення access-токена відбувається автоматично всередині проксі `/api/v1`: отримавши 401, він сам викликає `/auth/refresh` на бекенді й ротує cookie на сервері, тому окремого BFF-хендлера `/api/auth/refresh` навмисно немає.
- OAuth (Google/Facebook) — кнопки ведуть на бекенд; колбек `?access&refresh` обробляє `src/app/auth/callback` і встановлює ту саму cookie.
- Каталог закладів рендериться SSR: фільтри/сортування/пагінація зберігаються в URL.

## Структура

```
src/app       — маршрути App Router (сторінки, layout, /api/v1-проксі, auth)
src/components — UI-компоненти дизайн-системи та layout
src/lib       — api-клієнт, сесія, валідація (zod), побудова query
src/types     — типи даних API та парсери
```

## Брами якості

Перед комітом мають проходити:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```
