# Пиячок — фронтенд

Каталог закладів «Пиячок»: Next.js 16 App Router, React 19, TypeScript, Tailwind v4. Інтерфейс — українською. Порт `3001`, потрібен запущений бекенд на `:3000`.

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