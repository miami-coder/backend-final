# Дизайн Плану 3 «Кабінет + публічні сторінки» — фронтенд «Пиячок»

**Дата:** 2026-09-10
**Статус:** Погоджено (усі секції схвалені власником продукту в діалозі цього ж дня)
**Базова спека:** [2026-09-08-pyiachok-frontend-design.md](./2026-09-08-pyiachok-frontend-design.md) — розділи 4–7 і 8 лишаються чинними; цей документ фіксує доповнення і рішення, ухвалені під час звірки з бекендом.

---

## 1. Погоджені рішення цього плану

| Питання | Рішення |
|---|---|
| Геп бекенда «мої заклади» | Дотягнути бекенд: `GET /me/venues` + `GET /me/venues/:id` у backend-final (не обхідні шляхи на фронті) |
| Сторінка деталей зустрічі | `/hangouts/[id]` — включено в План 3 (у handoff-обсязі її не було, у базовій спекі є) |
| Резидуали Плану 2 | Дешеві (5 шт.) — окремі поліровні задачі в кінці плану; складні (7 шт.) залишаються припаркованими |
| Загальний підхід | A: конвенції Планів 1–2 (Server Components + клієнтські острови), SVG-графік без бібліотеки |
| Спека | Новий документ (цей) із посиланням на базову; базову не переписуємо |

## 2. Зміни в backend-final (єдині для плану)

У `users.controller` (`@Controller('me')`, JwtAuthGuard):

1. **`GET /me/venues`** — заклади поточного користувача (`ownerId = sub`, `createdAt DESC`, усі статуси). Відповідь `{data: Venue[]}` — **без пагінації** (той самий свідомий компроміс, що й `limit=100`-проекції Плану 2).
2. **`GET /me/venues/:id`** — свій заклад **незалежно від статусу** (pending/approved/rejected/archived): guard `ownerId === sub` АБО permission `venue:edit:any`, інакше 403/404. Віддає те саме, що `GET /venues/:id`, **плюс** `status` і `photos`-реляція (сторінка керування потребує поля, статус і список фото).

Реюз патерну `assertOwnerOrAll` з analytics-модуля. Публічні ендпоінти не змінюються. Тести — за конвенціями backend-final.

**Контекст гепу (чому без цього не можна):** публічний `GET /venues/:id` віддає лише `Approved` (`findOnePublic`), а `GET /venues` не має owner-фільтра — власник pending/rejected закладу не міг ані переглянути список своїх, ані прочитати свій заклад для редагування, хоча всі мутації (`PATCH /venues/:id`, `POST /:id/photos`, `POST /me/venues/:id/news`, `GET /me/venues/:id/analytics`) уже існують і працюють за permissions.

## 3. Факти про бекенд-контракти, звірені в коді (2026-09-10)

- `GET /me/hangouts?role=` (required: `created|joined|all`) → `{data: Hangout[]}` — **масив, без `meta`** → сторінка без пагінації.
- `GET /hangouts` — фільтри `venueId`, `date` (YYYY-MM-DD), `status` (`open|filled|cancelled|completed`), `page`, `limit` — звичайна пагінована відповідь.
- `GET /hangouts/:id` — **лише для учасників** (403 «Ви не учасник цієї заявки»).
- `GET /me/venues/:id/analytics?from&to` → `{data: {totalViews, viewsByDay[{date,count}], eventsByType[{eventType,count}]}}`.
- `PATCH /me/profile` — поля опційні; аватар — рядок `avatarUrl`, аплоаду немає.
- Таксономії (теги/фічі/типи) **не мають ендпоінта** — у формах це вільні CSV-текстові поля (як фільтри каталогу Плану 1).
- `POST /venues` → 201, створений заклад у статусі `pending`; відоме обмеження «завантажене фото не мапиться в entity автоматично» — показуємо чесним toast + поясненням.

## 4. Кабінет `/account/*` (guard уже в `layout.tsx`)

| Маршрут | Зміст |
|---|---|
| `/account` | Профіль: перегляд (`GET /me`) + острів `ProfileForm` → `PATCH /me/profile` (firstname, lastname, phone, age, avatarUrl). Нова zod-схема `profileUpdate` у `lib/validation/` |
| `/account/reviews` | `GET /me/reviews` (бекенд віддає `{data: Review[]}` — масив без `meta`, пагінації немає) → «заклад (посилання) + мій відгук»; редагування — reuse `ReviewForm` (PATCH `/reviews/:id`), видалення — `DELETE /reviews/:id` (порожнє тіло) з confirm |
| `/account/hangouts` | Таби `?role=created|joined|all` (default `created`) у URL; `GET /me/hangouts?role=` без пагінації. Дії: «Скасувати» (creator → `POST /hangouts/:id/cancel`), «Покинути» (→ `/hangouts/:id/leave`), «Деталі» → `/hangouts/[id]` |
| `/account/venues` | `GET /me/venues` → картки з бейджами статусу + «Додати заклад» → `/venues/new`; картка → керування |
| `/account/venues/[id]` | `GET /me/venues/:id`; вкладки в URL `?tab=`: **Редагування** (форма UpdateVenueDto: name, description, address, lat/lng, contacts, workingHours, averageCheck → `PATCH /venues/:id`; нова zod-схема `venueUpdate`), **Фото** (multipart `POST /venues/:id/photos` + список наявних), **Новини** (`GET /news?venueId=` + `POST /me/venues/:venueId/news`, `PATCH|DELETE /news/:id`), **Аналітика** (`GET /me/venues/:id/analytics?from&to`, дефолт 30 днів, from/to у URL): stat-плитка totalViews, SVG-барчарт `viewsByDay`, список `eventsByType` |

Дії над чужим закладом → 403 від бекенда → inline «Немає доступу» (бекенд — джерело правди).

## 5. Публічні сторінки

| Маршрут | Зміст |
|---|---|
| `/venues/new` | Guard на сервері (немає сесії → redirect `/auth/login?next=`). Форма CreateVenueDto: name ≥3, address ≥5, description, lat/lng, contacts, workingHours, averageCheck ≥0, featureCodes/tagSlugs ≤20 (CSV-текст), typeSlug. `workingHours` у DTO — `Record<день, "HH:MM-HH:MM">`: у формі — по одному полю на день доби (порожнє = вихідний), склеюється в об'єкт перед сабмітом. POST `/venues` → 201 → redirect `/account/venues` + toast «Заклад подано на модерацію» |
| `/news` | revalidate 60; вкладки `?category=general|promo|event` + `?page=`; картка: фото, заголовок, дата uk-UA, заклад. Пагінація наявним `Pagination` |
| `/news/[id]` | title, фото, категорія-бейдж, контент, «Заклад: …» якщо venueId; `generateMetadata`; 404 → not-found |
| `/hangouts` | revalidate 30; фільтри `?venueId=&date=&status=` (default `open`) + `?page=`; картка: дата/час, мета, gender, groupSize, payer, budget (`Number()`); «Приєднатися» — reuse `HangoutButton` (гість → login?next=, 409 inline); клік на картку → `/hangouts/[id]` |
| `/hangouts/[id]` | Клієнтська сторінка: 401 → login-redirect, 403 → error-стан «Ви не учасник цієї зустрічі». Контент: деталі + учасники; дії за роллю: приєднатися (open і не учасник), покинути (учасник), скасувати (creator) |

## 6. Навігація

- Header: nav + «Новини», «Зустрічі».
- `UserMenu` замінює пару email+«Вийти»: кнопка з іменем/роллю, дропдаун «Кабінет», «Адмінка» (тільки super_admin), «Вихід». Закриття: клік поза / Escape; `aria-expanded`, повернення фокуса.

## 7. Поліровка (дешеві резидуали Плану 2, задачі в кінці плану)

1. a11y-пас Modal/focus-trap: клік між елементами, фокус на діалог AgeGate при монтуванні, `FOCUSABLE` + `[tabindex]:not([tabindex="-1"])` і `[contenteditable]`.
2. `img loading="lazy"` (галерея/картки/обране).
3. EULA-чекбокс `aria-describedby`.
4. Toast не мелькає при `apiVoid` 401 перед redirectToLogin.
5. Косметика: коментар photo-gallery, назва Button-тесту.

## 8. Тестування і гейти

Як у Планах 1–2: TDD на логіці (zod-схеми `venueCreate/venueUpdate/profile/news`, parse нових відповідей), компонентні тести форм і списків (`vi.stubGlobal('fetch')` + `unstubAllGlobals`, `apiCalls`-патерн із фільтрацією UserProvider-фетчів, повні фікстури SessionUser, trailing newlines), серверні тести сторінок із замоканим `serverFetch`. Бекенд-ендпоінти — тести за конвенціями backend-final.

Гейти: `pnpm typecheck/lint/test/build` в обох репозиторіях (frontend-final і backend-final).

## 9. Свідомо не робимо (припарковане)

- invocationOrder-assertion (OAuth-тест), parseList meta Partial→NaN, double-fetch `/auth/me` на /account, limit=100-проекції, E2E-кандидати (Playwright-інфраструктури немає), негативні TZ для hangout date, view-дедуп-флаг із таймстемпом.
- Ручна перевірка браузером проти живого бекенда (чекліст Плану 2 + нові сторінки) — після Планів 3–4, перед релізом.

**Наступний план:** План 4 «Адмінка» (~8–10 задач: overview, moderation, users, complaints, news; role-guard super_admin).