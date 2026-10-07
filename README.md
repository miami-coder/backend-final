# Пиячок — бекенд

NestJS API для каталогу закладів «Пиячок» (`:3000`, префікс `/api/v1`).

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