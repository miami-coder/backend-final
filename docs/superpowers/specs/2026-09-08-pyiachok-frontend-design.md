# Дизайн фронтенду «Пиячок»

**Дата:** 2026-09-08
**Статус:** Погоджено (усі секції схвалені власником продукту)
**Джерело вимог:** `/home/palamar/Desktop/dev/backend-final/Пиячок_Технічне_завдання_BA.md`
**Бекенд:** NestJS, `http://localhost:3000/api/v1` (контракт — розділ «API-контракт» нижче)
**Фронтенд-репозиторій:** `/home/palamar/Desktop/dev/frontend-final`

---

## 1. Погоджені рішення

| Питання | Рішення |
|---|---|
| Scope | Повний ТЗ: Must Have + Should Have (скарги, аналітика, клікабельні теги) |
| UI | Кастомна дизайн-система на Tailwind v4, мінімалізм (NFR-002), без UI-бібліотек |
| Маршрут до закладу | Зовнішні посилання на мапу (Google Maps), без вбудованої карти |
| Вікове попередження (FR-001) | Модалка при кожному новому сеансі браузера (sessionStorage) |
| OAuth | Повний flow: Google/Facebook через бекендовий redirect, колбек `/auth/callback` |
| Архітектура автентифікації | **BFF**: токени в httpOnly-cookie, Next route handlers як проксі |
| Мова інтерфейсу | Українська |

## 2. Стек

- Next.js 16.3.4 App Router + React 19 + TypeScript (зі скелета).
- Tailwind CSS v4 (зі скелета).
- Додатково: `zod` — клієнтська валідація (правила 1:1 з DTO бекенда).
- Тести: Vitest + React Testing Library (dev-dependencies).
- Зауваження: Next.js 16 має breaking changes відносно старіших мажорів — перед імплементацією звірятися з `node_modules/next/dist/docs/` (Middleware перейменовано на Proxy — `proxy.ts`; params/searchParams асинхронні; детальний гайд `guides/backend-for-frontend` описує BFF-патерн).

## 3. Архітектура (BFF)

```
Браузер ──(cookie httpOnly)──> Next.js (route handlers /api/* + Server Components)
                                   │
                                   ├──> NestJS http://localhost:3000/api/v1/*
                                   └── cookie {accessToken, refreshToken}
```

- **Сесія**: один httpOnly-cookie `piyachok_session` (JSON `{accessToken, refreshToken}`), `sameSite=lax`, `secure` у production. Клієнтський JS токенів не бачить.
- **Проксі**: catch-all route handler `src/app/api/v1/[...path]/route.ts` (GET/POST/PATCH/DELETE):
  1. читає cookie, додає `Authorization: Bearer <access>`;
  2. форвардить запит (заголовки, query, body, multipart) у `BACKEND_URL/api/v1/<path>`;
  3. при 401 — один раз виконує `POST /auth/refresh` (ротація обох токенів у cookie) і повторює вихідний запит;
  4. при мертвому refresh — повертає 401 клієнтові.
- **Auth-хендлери окремо** (маніпулюють cookie): `/api/auth/login`, `/api/auth/register`, `/api/auth/logout`, `/api/auth/refresh` — викликають NestJS і кладуть/видаляють cookie.
- **OAuth-колбек**: `src/app/auth/callback/route.ts` (GET) приймає `?access&refresh` від бекендового 302, кладе токени в cookie, 302 на `/`. Токени не залишаються в історії браузера і не потрапляють у клієнтський JS. Кнопки OAuth роблять повний browser-redirect на `BACKEND_URL/api/v1/auth/{google|facebook}`.
- **Отримання даних — два шляхи**:
  - **Server Components**: викликають NestJS server-to-server напряму (`lib/api/server-client.ts`), bearer з cookie за потреби. Публічні сторінки — `next: { revalidate: 60 }` (каталог, сторінка закладу, новини, hangouts); кабінетні — `no-store` (персональні дані).
  - **Клієнтські виклики** (фільтри, пагінація, обране, форми, join): `lib/api/client.ts` фетчить відносний `/api/v1/...` → проксі → NestJS.
- **Контекст користувача**: серверний layout читає cookie → `GET /me` → передає `{id, email, roles}` в React Context. Ролі керують видимістю UI.
- **Видимість дій для гостя**: кнопки (обране, відгук, «Пиячок», «Приєднатися») показуються, але ведуть на `/auth/login?next=<повернення>`.

### Формат відповідей бекенда (парається в API-шарі)

- Стандарт: `{ "data": ..., "meta": {page, limit, total, hasMore}? }`.
- **Без `data`-обгортки**: `auth/register|login|refresh` (топ-рівневі `accessToken/refreshToken/user`), обидва analytics-GET, обидва health-GET.
- **Порожнє тіло**: `POST /auth/logout`, `DELETE /reviews/:id`, `DELETE /news/:id`.
- **Помилка**: `{ "error": { "code": "NOT_FOUND", "message": "...", "details": null } }`; коди: `BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, UNPROCESSABLE_ENTITY, TOO_MANY_REQUESTS, INTERNAL_ERROR`.
- **Numeric-поля рядками** (Postgres decimal через TypeORM): `ratingAvg`, `averageCheck`, `latitude`, `longitude`, `desiredBudget` — парсити `Number()` в API-шарі.
- **Валідація бекенда**: `whitelist + forbidNonWhitelisted` — надсилали тільки поля з DTO, інакше 400.
- **POST повертає 201** — не вважати помилкою.
- **`passwordHash` підтікає** у `GET /venues/:id` (owner), `GET /venues/:id/reviews` (user), `GET /admin/users` — типи ці поля не містять, API-шар їх відкидає.
- Кешування бекенда: venues 60 с, hangouts 30 с, permissions 5 хв — дані можуть відставати на цей час.

### Відомі обмеження бекенду (не блокують фронтенд, приймаємо)

1. `/static/*` (завантажені фото) бекенд сам не роздає — потрібен проксі/nginx. Фронт рендерить URL як `BACKEND_URL + url`, у dev можна додати rewrite в `next.config.ts` на `http://localhost:3000/static/:path*`.
2. Завантажене фото закладу не з'являється в entity автоматично (немає поля фото в UpdateVenueDto) — завантаження фото доступне, але відображення в галереї обмежене тим, що бекенд дозволяє.
3. `PATCH /venues/:id` ігнорує `featureCodes/tagSlugs/typeSlug`.
4. Декларовані permissions (`@Permissions`) фактично перевіряються лише для venue edit/photo, news createForVenue, analytics; решта admin-ендпоінтів зараз приймають будь-який JWT з роллю. Фронт будує UI за ролями з токена; реальний захист — відповідальність бекенда.
5. `GET /hangouts` не повертає кількість учасників (поле не мапиться) — на картці не показуємо.
6. `join-hangout.dto.ts` (`message`) контролером не приймається — у формі join поле повідомлення не робимо.
7. Бекенд не має ендпоінту «один заклад із повними відносинами» (`GET /venues/:id` повертає лише owner+profile, повні photos/tags/types/features — лише в елементах `GET /venues`). Сторінка закладу збагачує дані list-пошуком `?q=<назва>&limit=100` з пошуком за id; якщо елемент не знайдено (наприклад, заклад поза першими 100 результатами), сторінка рендериться без галереї/тегів/фіч — тиха деградація.

## 4. Структура проєкту

```
src/
  app/
    layout.tsx                — кореневий layout: Header, Footer, AgeGate, UserProvider
    page.tsx                  — каталог закладів (маршрут "/")
    (public)/
      venues/[id]/page.tsx
      venues/new/page.tsx
      news/page.tsx
      news/[id]/page.tsx
      hangouts/page.tsx
      hangouts/[id]/page.tsx  — client, доступ лише учаснику (403 від бекенда → error-стан)
    auth/
      login/page.tsx
      register/page.tsx
      callback/route.ts       — OAuth route handler
    account/
      layout.tsx              — guard: немає сесії → /auth/login?next=
      page.tsx                — профіль
      favorites/page.tsx
      reviews/page.tsx
      hangouts/page.tsx
      venues/page.tsx
      venues/[id]/page.tsx    — керування закладом: редагування, фото, новини, статистика
    admin/
      layout.tsx              — guard: role super_admin, інакше redirect
      page.tsx                — огляд аналітики
      moderation/page.tsx
      users/page.tsx
      complaints/page.tsx
      news/page.tsx
    api/
      auth/{login,register,logout,refresh}/route.ts
      v1/[...path]/route.ts   — catch-all проксі
  components/
    ui/                       — Button, Input, Textarea, Select, Modal, Rating, Pagination,
                                Badge, Skeleton, EmptyState, Toast, Tabs, Avatar
    layout/                   — Header, Footer, AgeGate, SearchBar, UserMenu
    features/                 — venues/ (VenueCard, VenueFilters, SortSelect, WorkingHours,
                                PhotoGallery, ReviewList, ReviewForm, FavoriteButton, HangoutForm,
                                RouteButton, ComplaintForm), news/, hangouts/, account/, admin/
  lib/
    api/
      server-client.ts        — fetch NestJS з серверних компонентів (bearer, revalidate)
      client.ts               — fetch '/api/v1/...' з браузера + 401→login
      parse.ts                — розгортання {data,meta}, рядкові numeric, ApiError
    auth/
      session.ts              — читання/запис cookie, refresh з ротацією
      guards.ts               — requireAuth / requireRole для layout-ів
    validation/schemas.ts     — zod-схеми форм
    utils/                    — query-string, formatDate, money, ratingColor
  types/                      — Venue, Review, News, Hangout, Complaint, User, Profile,
                                Paginated<T>, ApiError
docs/superpowers/specs/       — цей документ
```

## 5. Сторінки та маршрути

### Публічна частина

| Маршрут | Зміст і поведінка |
|---|---|
| `/` | Каталог. Картка закладу: фото, назва, рейтинг (зірки + числовий), середній чек, адреса, теги. Пошук `?q=`, фільтри `?type=&feature=(CSV)&tag=(CSV)&minCheck=&maxCheck=&minRating=`, сортування `?sort=rating\|check\|newest\|name\|distance`, пагінація `?page=`. Весь стан у URL (SSR + шаринг). Фільтр «Поблизу»: `navigator.geolocation` → `lat&lng&radiusKm`; відмова/недоступність геолокації → інлайн-повідомлення, сортування за відстанню недоступне |
| `/venues/[id]` | Фото-галерея, опис, графік роботи, контакти (phone/instagram/facebook/website), клікабельні теги → `/venues?tag=slug`, середній чек, рейтинг, відгуки (пагінація, сортування newest/oldest/highest/lowest), форма відгуку (rating 1–5 int, text 10–2000, опц. фото чека multipart `checkPhoto`), FavoriteButton, кнопка «Пиячок» (модалка: date ISO, time HH:MM, purpose 10–500, gender male/female/any, groupSize 1–20, payer me/split/them, desiredBudget 0–100000; перед першим використанням — модалка попередження про безпеку), кнопка «Маршрут» (зовнішня мапа: координати, або адреса-гео-пошук якщо координат немає), форма звернення до менеджера → скарга (venueId, reason fake_promo/fraud/other, text ≥20). Запис перегляду при монтуванні: `POST /api/v1/venues/:id/view` з sessionId (UUID у localStorage, дедуплікація бекенда 30 хв). Якщо користувач уже залишив відгук (409 при спробі або перевірка через /me/reviews) — форма замінюється «Редагувати мій відгук» |
| `/venues/new` | Auth. Форма CreateVenueDto: name ≥3, address ≥5, description?, lat/lng?, contacts {phone, instagram, facebook, website}?, workingHours Record<string,string>?, averageCheck ≥0, featureCodes ≤20, tagSlugs ≤20, typeSlug?. Після сабміту: статус pending + пояснення про модерацію |
| `/news` | Вкладки категорій `?category=general\|promo\|event`, пагінація. Карточка: фото, заголовок, дата, заклад |
| `/news/[id]` | Заголовок, фото, текст, категорія, посилання на заклад (якщо venueId) |
| `/hangouts` | Список зустрічей: фільтри `?venueId=&date=&status=` (default open), пагінація. Карта: дата, час, мета, gender, groupSize, payer, budget, заклад. Кнопка «Приєднатися» (auth; 409 «вже приєднані»/«заповнена» — інлайн) |
| `/auth/login` | Email+пароль; 401 «Невірний email або пароль»; кнопки Google/Facebook (browser-redirect на бекенд); посилання на реєстрацію; `?next=` |
| `/auth/register` | firstname ≥2, lastname ≥2, email, password ≥8 з великою літерою і цифрою, age ≥18 (опц.), phone (опц.), acceptEula — обов'язковий чекбокс (401→409 «Потрібно прийняти угоду» показуємо як помилку форми) |

### Кабінет `/account` (auth; layout-guard)

| Маршрут | Зміст |
|---|---|
| `/account` | Профіль: перегляд/редагування (PATCH /me/profile: firstname, lastname, phone, age, avatarUrl — усі опційні; avatarUrl рядком, аплоаду немає) |
| `/account/favorites` | Обране (GET /me/favorites, пагінація): картки-проекції (id, name, address, ratingAvg, mainPhotoUrl), видалення |
| `/account/reviews` | Мої відгуки (GET /me/reviews): заклад, мій відгук, редагувати (PATCH /reviews/:id), видалити (DELETE, порожнє тіло) |
| `/account/hangouts` | Мої «Пиячки» (GET /me/hangouts?role=created\|joined\|all): деталі, скасувати (тільки творець), покинути (не творець) |
| `/account/venues` | Мої заклади: картки зі статусами pending/approved/rejected; додавання → /venues/new |
| `/account/venues/[id]` | Керування (власник/venue_admin): редагування полів (PATCH приймає name, description, address, lat/lng, contacts, workingHours, averageCheck), завантаження фото (POST multipart `file`), новини закладу (POST /me/venues/:id/news, PATCH/DELETE /news/:id), статистика (GET /me/venues/:id/analytics?from&to — графік viewsByDay) |

### Адмінка `/admin` (layout-guard role=super_admin)

| Маршрут | Зміст |
|---|---|
| `/admin` | Огляд: GET /admin/analytics/overview (totalViews, totalEvents, eventsByType) — stat-плитки + розподіл подій |
| `/admin/moderation` | GET /admin/venues/pending (createdAt ASC): перегляд, approve, reject (обов'язкове reason — показуємо поле причини), assign-owner (userId) |
| `/admin/users` | GET /admin/users (пагінація): редагування профілю (PATCH), soft-delete (403 «Не можна видалити самого себе» — інлайн; себе ховаємо/блокуємо кнопку), ролі add/remove (user, venue_admin, super_admin, critic) |
| `/admin/complaints` | GET /admin/complaints (new/in_review, ASC): перегляд, resolve → in_review/resolved/rejected |
| `/admin/news` | Глобальні новини: POST /admin/news (venueId не вказуємо → null), список |

### Глобальні елементи

- **Header**: лого, пошук (→ `/venues?q=`), навігація (Каталог, Новини, Зустрічі), UserMenu (аватар, ім'я, роль; пункти «Кабінет»/«Адмінкі» за ролями) або «Увійти».
- **AgeGate (FR-001)**: повноекранна модалка «вам є 18 років» на кожен новий сеанс (sessionStorage-прапорець `age-confirmed`); до підтвердження контент недоступний.
- **Footer**: копірайт, посилання.
- **Попередження безпеки «Пиячка»**: перша модалка перед першим створенням зустрічі (localStorage-прапорець — на відміну від AgeGate він постійний).

## 6. Обробка помилок і станів

- `ApiError { code, message, details, status }` — єдиний тип, будується в API-шарі.
- 401 → refresh → retry once → при повторному 401 клієнтський apiClient: очистка стану, redirect `/auth/login?next=…`.
- 403 → «Немає доступу».
- 404 → `not-found.tsx` (глобальний + `/venues/[id]`): «Заклад не знайдено або видалений» (включно з не-approved).
- 409 → показуємо `message` бекенда inline (українською): дублікат відгуку, «вже приєднані», «заявка заповнена», «email зайнято».
- 429 → «Занадто багато спроб, спробуйте пізніше».
- 5xx/мережа → глобальний toast «Сервіс тимчасово недоступний»; мутації — кнопка «Повторити».
- Стани списків: skeleton → error+retry → empty (персоніфікований) → content. Пагінація нумерована за `meta`.
- Empty states: «Нічого не знайдено за запитом», «У обраному поки порожньо», «Немає відкритих зустрічей», «Закладів з цим тегом ще немає».
- Optimistic UI лише для FavoriteButton (миттєве перемикання, відкат + toast при помилці). Усе інше — чесна обробка відповіді.
- Геолокація: відмова користувача / недоступні координати → інлайн-повідомлення, сортування/фільтр за відстанню вимкнені.
- Маршрут без координат → зовнішня мапа з текстовим geocode-запитом за адресою.

## 7. Валідація (zod-схеми = правила DTO бекенда)

| Схема | Правила |
|---|---|
| login | email; password: string |
| register | firstname ≥2, lastname ≥2, email, password ≥8 + ≥1 uppercase + ≥1 digit, age ≥18 опц., phone опц., acceptEula literal true |
| venueCreate | name ≥3, address ≥5, description?, lat/lng?, contacts?, workingHours?, averageCheck ≥0, featureCodes ≤20, tagSlugs ≤20, typeSlug? |
| review | rating int 1–5, text 10–2000, checkPhoto опц. (jpeg/png/webp ≤5 MB) |
| news | category enum general/promo/event, title ≥5, content ≥20, imageUrl?, status enum draft/published/archived (default published) |
| complaint | venueId або reviewId (refine), reason enum fake_promo/fraud/other, text ≥20 |
| hangout | date ISO не в минулому, time `^([01]\d|2[0-3]):[0-5]\d$`, purpose 10–500, gender enum male/female/any, groupSize int 1–20, payer enum me/split/them, desiredBudget 0–100000 опц. |
| profileUpdate | усі поля опційні: firstname ≥2, lastname ≥2, phone, age, avatarUrl |

Помилки серверної валідації (рядок з `"; "`) — fallback-показ під формою.

## 8. Тестування

- **Vitest + React Testing Library**.
- Юніт: zod-схеми (граничні значення), API-шар (розгортання `{data,meta}`, рядкові numeric, ApiError), утиліти.
- Component-тести: AgeGate (sessionStorage), FavoriteButton (optimistic + відкат), ReviewForm (валідація + 409).
- Інтеграційний: проксі route handler з замоканим fetch — bearer, refresh при 401 + ротація cookie + retry, прохід multipart.
- Брами: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- Логіка — test-first (TDD); верстка — перевірка build + ручний чекліст acceptance criteria (розділ 27 ТЗ).
- E2E (Playwright) — поза межами першої версії.

## 9. Конфігурація та оточення

- `BACKEND_URL` (server-only env): dev `http://localhost:3000`.
- Frontend dev порт: `3001` (CORS бекенда очікує `FRONTEND_URL=http://localhost:3001`).
- `next.config.ts`: rewrite `/static/:path*` → `${BACKEND_URL}/static/:path*` (щоб завантажені фото працювали в dev без nginx); подивитися актуальний синтаксис rewrites у доках встановленої версії.
- Формат дат в UI: українська локаль (`uk-UA`).

## 10. Що свідомо НЕ робимо (Out of scope, з ТЗ розділ 3.2)

- Внутрішні повідомлення/чат.
- Платіжна система / платне розміщення новин (`isPromoted` лише відображаємо, якщо бекенд його віддає).
- Роль критика як окремий permission set у UI (кнопка «feature» для відгуку — лише для role critic/super_admin, бо permission `review:feature`).
- Вбудована інтерактивна мапа.
- E2E-тести.

## 11. Acceptance-чекліст (з розділу 27 ТЗ — кожен пункт покривається сторінками вище)

Каталог, пошук, сортування, фільтрація, сторінка закладу, рейтинги/відгуки, обране, оцінка/відгук, подання закладу на модерацію, модерація супер адміном, керування закладом представником, новини (додавання/видалення/сторінка), «Пиячок», маршрут, статистика переглядів для дозволених ролей, адаптивний інтерфейс (mobile-first breakpoints Tailwind: смартфон/планшет/десктоп), вікове попередження, попередження про безпеку зустрічей.
