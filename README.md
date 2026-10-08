# Пиячок — фронтенд

Каталог закладів «Пиячок»: Next.js 16 App Router, React 19, TypeScript, Tailwind v4. Інтерфейс — українською. Порт `3001`, потрібен запущений бекенд на `:3000`.

## Технології і навіщо вони

- **Next.js 16 (App Router) + React 19** — SSR-каталог (фільтри й сорти зберігаються в URL і віддаються з сервера) плюс клієнтські компоненти там, де потрібна взаємодія; React Compiler увімкнено (`reactCompiler: true`) — автоматична оптимізація ре-рендерів.
- **TypeScript** — типи відповідей API зведені у `src/types/*`, що дає контракт з бекендом на рівні компіляції.
- **Tailwind v4** — атомарні стилі; дизайн-токени (кольори, шрифти) описані напряму в CSS (`@tailwindcss/postcss`).
- **BFF-проксі Next.js route handlers** (`src/app/api/v1/[...path]`, `src/app/api/auth/*`) — JWT зберігається **в httpOnly cookie**, клієнтський JS його не бачить; проксі інжектує `Authorization`, сам рефрешить токени і виставляє cookie при логіні/логауті. Безпечніше за токени в `localStorage` й не потребує окремого сесійного бекенду.
- **Zod** — валідація форм на клієнті (реєстрація, подача закладу, відгук, новина, зустріч, скарга) до відправки на бекенд.
- **Vitest + Testing Library + jsdom** — unit і компонентні тести (сторінки, компоненти, BFF, `lib/`), команда `pnpm test`.
- **ESLint 9 + eslint-config-next** — лінт за правилами Next.js.
- **pnpm**, Node 22, Docker (compose для dev-стека).

## Запуск через Docker

```bash
docker compose up -d
```

Підніме фронтенд на `http://localhost:3001` з hot-reload (вихідники змонтує з диска, перезбірка не потрібна). `BACKEND_URL` всередині контейнера сам вийде на хост-бекенд (`http://host.docker.internal:3000`), нічого конфігурувати не треба.

Логи: `docker compose logs -f frontend`. Зупинка: `docker compose down`.

## Запуск без Docker

Потрібні Node 22 і pnpm, і бекенд на `http://localhost:3000`.

1. Змінні оточення:

   ```bash
   cp .env.example .env.local
   ```

   `.env.local`: `BACKEND_URL=http://localhost:3000` — адреса бекенда, куди фронте́нд проксує `/api/v1`.

2. Залежності та dev-сервер:

   ```bash
   pnpm install
   pnpm dev
   # → http://localhost:3001
   ```

3. Тести:

   ```bash
   pnpm test
   ```