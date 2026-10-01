# Пиячок — бекенд

NestJS API для каталогу закладів «Пиячок» (`:3000`, префікс `/api/v1`).

## Запуск через Docker

1. Скопіюй зразок конфігу і заповни значення (JWT/DB-секрети обовʼязкові — без них стартує fail-fast):

   ```bash
   cp .env.example .env
   ```

2. Підніми стек (postgres + redis + бекенд з hot-reload; міграції накочує окремий контейнер `migrate` автоматично):

   ```bash
   docker compose up -d
   ```

   Логи: `docker compose logs -f backend`. Зупинка: `docker compose down`.

3. API: `http://localhost:3000/api/v1`, Swagger (у dev): `http://localhost:3000/api/v1/docs`.

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