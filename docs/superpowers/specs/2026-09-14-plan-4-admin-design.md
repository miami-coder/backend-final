# Дизайн-спека: План 4 «Адмінка» (фронтенд «Пиячок»)

Дата: 2026-09-14. Прецеденти: План 2 «Сторінка закладу», План 3 «Кабінет + публічні сторінки» (злито в main 2026-09-14).

## 1. Мета

Веб-адмінка `/admin` для `super_admin`: огляд-дашборд, модерaція закладів, керування користувачами, скарги, глобальні новини. Бекенд-ендпоінти всі існують (permission-guarded) — **нових бекенд-гепів немає**.

## 2. Non-goals

- Пошук/фільтр користувачів (бекенд `GET /admin/users` має лише page/limit) — пагінація вистачає; пошук — кандидат у наступний план.
- Audit-лог у UI (бекенд пише audit, але read-гепа немає).
- Бекенд-зміни будь-якого роду (гейти ролей/permissions вже в Guards).

## 3. Архітектура

Патерн Плану 3 (кабінет) як зразок:

- **Route-група `/admin`** з власним `layout.tsx`: server-компонент, `revalidate: 0`, `getSessionTokens()` → `serverFetch<SessionUser>('/auth/me', { tokens, revalidate: 0 })`. Гейт: `roles.includes('super_admin')`, інакше — `redirect('/')`; мертва сесія / помилка фетчу — теж `redirect('/')` (адмінка не потребує логін-редіректу з `next=`, бо UserMenu її показує лише адмінам).
- **Навігація секцій** в layout: «Огляд» `/admin`, «Заклади» `/admin/venues`, «Користувачі» `/admin/users`, «Скарги» `/admin/complaints`, «Новини» `/admin/news`; `aria-current="page"` на активній.
- **Списки** — server-компоненти: `serverFetchList<T>(path, { tokens, revalidate: 0 })`, пагінація `Pagination` (`?page=`). Мутації — client-острови `api()`/`apiVoid()` з `@/lib/api/client`, toast + `router.refresh()`.
- **BFF** `/api/v1/[...path]` з Плану 1 прикриває admin-маршрути як є.

## 4. Секції

### 4.1 «Огляд» (`/admin`)

Server-сторінка. Паралельно: `GET /admin/analytics/overview` (`{ totalViews, totalEvents, eventsByType[] }`, permission `analytics:view:all` є у super_admin) + 4 фетчі списків з `limit=1` заради `meta.total`: `/admin/venues/pending`, `/admin/users`, `/admin/complaints`, `/admin/news`. Стат-плитки в один ряд (патерн VenueAnalytics Плану 3): Перегляди, Події, Заклади на модерації, Користувачі, Скарги, Новини. `overview` — під `.catch(() => null)` → «—» у плитках; списки без catch (Next error-сторінка, свідомо симетрично до кабінету).

### 4.2 «Заклади» (`/admin/venues`)

- Список pending: `serverFetchList<Venue>('/admin/venues/pending', …)`, пагінація. Картка: назва, адреса, статус-бейдж (`VENUE_STATUS_LABELS`), дата створення (`formatDate`), лінк на `/venues/[id]` (публічна; не-approved → notFound — лінк показуємо лише для Approved, для pending — без лінка).
- `VenueApproveButton`: POST `admin/venues/:id/approve` (без тіла) → toast «Заклад схвалено» + refresh; in-flight гард.
- `VenueRejectButton`: POST `admin/venues/:id/reject` з `{}` (бекенд ігнорує body) → модалка підтвердження → toast + refresh.
- `VenueAssignOwnerButton`: POST `admin/venues/:id/assign-owner` `{ userId }` — модалка з вибором користувача (fetch `admin/users?limit=100`, select за email+імʼям) → toast + refresh.

### 4.3 «Користувачі» (`/admin/users` + `/admin/users/[id]`)

- Список: `serverFetchList<User>('/admin/users', …)` (relations profile включно). Рядок: email, імʼя з profile, бейджі ролей, дата реєстрації. Клік → `/admin/users/[id]`.
- Деталі: `serverFetch<{ data: User }>`-через-`serverFetchList`-симетрія: бекенд `GET /admin/users/:id` віддає `{ data }` → використати `serverFetch<{ data: User }>` з деструктуризацією (симетрично до news-деталей Плану 3).
- Профіль: форма з тими самими полями, що кабінетний профіль (`ProfileFields`), PATCH `admin/users/:id` (бекенд аплає до Profile).
- Ролі: POST `admin/users/:id/roles` `{ roleCode, action: 'add' | 'remove' }`; UI — бейдж-чипи поточних ролей + селект додавання і кнопка зняття; додавання/зняття `super_admin` — модалка підтвердження.
- Видалення: DELETE `admin/users/:id` (мʼяке) — модалка з введенням email користувача для підтвердження (деструктивна дія); після успіху — toast + redirect на `/admin/users`.

### 4.4 «Скарги» (`/admin/complaints`)

- Список: `serverFetchList<Complaint>('/admin/complaints', …)` (бекенд `listPending` — лише нові; пагінація page/limit). Рядок: reason-бейдж, текст (обрізаний ~140 символів), ціль і дата. Ціль: план звіряє, чи `listPending` повертає relations (venue/review); якщо так і ціль — venue, лінк на `/venues/[id]`; якщо review — лінк на сторінку закладу цього review; якщо relations немає — ціль як текст без лінка (не гіп, не блокер).
- `ComplaintResolveButton`: модалка з вибором статусу (`Resolved` / `Rejected`) + optional note (textarea) → POST `admin/complaints/:id/resolve` `{ status, note? }` → toast + refresh. 409 (вже вирішено) → inline ApiError message.

### 4.5 «Новини» (`/admin/news`)

- Список: `serverFetchList<News>('/admin/news', …)` — усі статуси, пагінація. Рядок: статус-бейдж, категорія, title, дата; лінк на публічну `/news/[id]` (published-only гард уже в коді; не-published — без лінка).
- Форма глобального створення (острів): category, title, content, imageUrl, isPromoted (чекбокс), status → POST `admin/news`. Патерн VenueNewsManager Плану 3 (схема, валідація, помилки inline).

## 5. Обробка помилок

- Списки/деталі: без catch → Next error-сторінка (симетрично до кабінету; припаркований мінор Плану 3 не чіпаємо тут).
- Мутації: `ApiError` → `e.message` у toast (error-варіант); 401 на мутації → авто-redirect клієнта (наявна поведінка `api()`).
- Подвійний клік: in-flight busy-гард на кожному острові (закриває deferred-мінор Task 11 Плану 3 для нових компонентів).

## 6. Тестування і гейти

- Server-сторінки: `renderToStaticMarkup` + `vi.mock('@/lib/api/server-client')` + `vi.mock('@/lib/auth/session')` + `vi.mock('next/navigation')` (патерн Плану 3).
- Острови: RTL, `vi.stubGlobal('fetch', …)` + `afterEach(vi.unstubAllGlobals)`; мутаційні тести стверджують method/url/body.
- Layout-гейт: тести на redirect для не-super_admin і мертвої сесії.
- Гейти: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`; бекенд-гейти лише фінально (без змін бекенда).

## 7. Глобальні констрейнти (успадковані з Плану 3)

- Українська UI; апостроф U+02BC (ʼ); коментарі українською.
- Файли — рівно один `\n` наприкінці.
- zod-схеми у `@/lib/validation`, парсери/лейбли у `@/types`.
- `serverFetch<T>` — unwrapped; конверти `{ data }`/`{ data, meta }` — `serverFetchList` або деструктуризація.
- Публічні API компонентів не змінюються; нові компоненти — окремі файли в `src/components/features/admin/`.
- revalidate: 0 на всіх адмін-сторінках + токени з `getSessionTokens()`.

## 8. Після виконання плану

1. Фінал-ревʼю гілки (найпотужніша модель) → фікс-хвиля → merge у main (після підтвердження людини).
2. Ручна перевірка браузером проти живого бекенда (чекліст Плану 2/3 + адмінські флоу).
3. Далі: припарковані мінори / E2E (Playwright) — окремий цикл.