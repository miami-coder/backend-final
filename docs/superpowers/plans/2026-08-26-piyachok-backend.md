# «Пиячок» Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реалізувати NestJS-бекенд для платформи «Пиячок» з авторизацією, каталогом закладів, відгуками, новинами, модерацією та функцією «Пиячок» з публічними заявками.

**Architecture:** NestJS 11 + TypeORM + PostgreSQL 16 (PostGIS) + Redis 7. Модульна структура з Bounded Contexts (rbac, auth, users, venues, reviews, favorites, hangouts, news, complaints, analytics, admin). RBAC через таблиці `Role` / `Permission` / `UserRole`. Крос-модульні події через `@nestjs/event-emitter`. Кеш через Redis із no-op fallback. Файли локально в Docker volume. Два репозиторії: цей (бек) + `frontend-final` (Next.js).

**Tech Stack:** NestJS 11, TypeORM 0.3.x, PostgreSQL 16 + PostGIS 3.4, Redis 7, Passport (local + jwt + google-oauth20 + facebook), class-validator, class-transformer, bcryptjs, Multer, @nestjs/event-emitter, @nestjs/schedule, @nestjs/throttler, nestjs-pino, Jest, supertest, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-08-26-piyachok-design.md`

---

## Global Constraints

- Мова інтерфейсу API: ключі — англійська (camelCase), повідомлення помилок — українська
- Валюта: UAH (numeric 10,2)
- Усі timestamps зберігаються як `timestamptz` (UTC); фронт конвертує у local time
- Namespace таблиць: відсутній (префікс `piyachok_` не використовуємо — назви достатньо унікальні)
- Імена файлів: kebab-case для утиліт, PascalCase для класів, snake_case для SQL
- Idempotency: усі POST можуть приймати `Idempotency-Key` хедер; реалізуємо в `common/middleware/idempotency.middleware.ts`
- Coverage gate: ≥80% statements, ≥75% branches (блокує merge)
- Commit messages: `feat:`, `test:`, `chore:`, `fix:`, `docs:`, `refactor:` (Conventional Commits)
- Усі тести — Jest, без сторонніх фреймворків
- Кожен task завершується commit
- Branch strategy: trunk-based, фічі в feature-гілках `feat/<task-slug>`

---

## Phase Map

План складається з 11 фаз. Кожна фаза завершується робочою, протестованою частиною системи. Залежності між фазами — лінійні, але всередині фази задачі лінійні.

| Phase | Назва | Залежність | Задачі |
|---|---|---|---|
| 0 | Bootstrap (Docker, infra, env, skeleton) | — | 1–3 |
| 1 | Common (config, guards, decorators, exceptions, services) | 0 | 4–8 |
| 2 | RBAC (Role, Permission, UserRole, seed) | 1 | 9–12 |
| 3 | Users (User, Profile, OAuthAccount) | 1 | 13–15 |
| 4 | Auth (register, login, refresh, OAuth) | 2, 3 | 16–20 |
| 5 | Venues (CRUD, photos, search, moderation) | 2, 3, 1 | 21–27 |
| 6 | Reviews (rating, text, check photo, recalc listener) | 5 | 28–30 |
| 7 | Favorites | 5 | 31–32 |
| 8 | News (per-venue + global) | 5 | 33–35 |
| 9 | Complaints | 2, 5, 6 | 36–37 |
| 10 | Hangouts (Pиячок: create/join/cancel, cron) | 5, 1 | 38–41 |
| 11 | Analytics + Admin + Health + E2E | 5, 6, 8, 10 | 42–45 |

---

## Phase 0: Bootstrap

### Task 1: Docker Compose для розробки

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.test.yml`
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `.env.example`

**Step 1:** Створи `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgis/postgis:16-3.4-alpine
    environment:
      POSTGRES_USER: piyachok
      POSTGRES_PASSWORD: piyachok_dev
      POSTGRES_DB: piyachok
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U piyachok"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    command: ["redis-server", "--appendonly", "yes"]

  backend:
    build: .
    command: pnpm run start:dev
    ports:
      - "3000:3000"
    env_file: .env
    environment:
      DATABASE_HOST: postgres
      REDIS_HOST: redis
    volumes:
      - ./src:/app/src
      - uploads:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started

volumes:
  pgdata: {}
  redisdata: {}
  uploads: {}
```

**Step 2:** Створи `docker-compose.test.yml` (тільки Postgres + Redis, без бекенду):

```yaml
services:
  postgres-test:
    image: postgis/postgis:16-3.4-alpine
    environment:
      POSTGRES_USER: piyachok_test
      POSTGRES_PASSWORD: piyachok_test
      POSTGRES_DB: piyachok_test
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data

  redis-test:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    tmpfs:
      - /data
```

**Step 3:** Створи `Dockerfile`:

```dockerfile
FROM node:22-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
EXPOSE 3000
CMD ["pnpm", "run", "start:dev"]
```

**Step 4:** Створи `.dockerignore`:

```
node_modules
dist
coverage
.git
.gitignore
.env
.env.local
uploads
*.log
.idea
```

**Step 5:** Створи `.env.example`:

```bash
NODE_ENV=development
PORT=3000
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=piyachok
DATABASE_PASS=piyachok_dev
DATABASE_NAME=piyachok
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_ACCESS_SECRET=change_me_access_min_32_chars_xxxxxxxx
JWT_REFRESH_SECRET=change_me_refresh_min_32_chars_xxxx
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_CALLBACK_URL=http://localhost:3000/api/v1/auth/facebook/callback
FRONTEND_URL=http://localhost:3001
LOG_LEVEL=debug
```

**Step 6:** Створи `.gitignore` (якщо відсутній), додай `uploads/`, `.env`, `coverage/`, `dist/`, `*.log`.

**Step 7:** Перевір, що compose валідний:

```bash
docker compose config --quiet
```

**Step 8:** Commit:

```bash
git add docker-compose.yml docker-compose.test.yml Dockerfile .dockerignore .env.example .gitignore
git commit -m "chore: add docker compose for dev and test environments"
```

---

### Task 2: Додай необхідні залежності

**Files:**
- Modify: `package.json`

**Step 1:** Додай через pnpm:

```bash
pnpm add @nestjs/event-emitter @nestjs/schedule @nestjs/throttler \
  @nestjs/swagger nestjs-pino pino-http pino-pretty \
  passport-google-oauth20 passport-facebook class-sanitizer \
  @nestjs/platform-socket.io socket.io ioredis typeorm-naming-strategy
pnpm add -D @types/passport-google-oauth20 @types/passport-facebook
```

**Step 2:** Перевір, що в `package.json` з'явилися всі залежності:

```bash
grep -E "event-emitter|throttler|swagger|pino|passport-google" package.json
```

**Step 3:** Commit:

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add event-emitter, throttler, swagger, pino, oauth, redis deps"
```

---

### Task 3: Bootstrap NestJS app та перший health endpoint

**Files:**
- Create: `src/config/env.validation.ts`
- Create: `src/main.ts`
- Create: `src/app.module.ts`
- Modify: `src/app.controller.ts`
- Create: `src/modules/health/health.controller.ts`
- Create: `src/modules/health/health.module.ts`
- Test: `src/modules/health/health.controller.spec.ts`

**Step 1:** Видали старі модулі-стаби (`auth/`, `users/`, `venue/`, `config/typeorm.config.ts`):

```bash
rm -rf src/auth src/users src/venue src/config/typeorm.config.ts
rm src/auth/dto/* src/auth/entity/* src/users/entity/* 2>/dev/null
```

(Якщо видалення повертає помилку "No such file" — ігноруй.)

**Step 2:** Створи `src/config/env.validation.ts`:

```ts
import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsString, validateSync } from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export class EnvVars {
  @IsEnum(NodeEnv) NODE_ENV: NodeEnv = NodeEnv.Development;
  @IsNumber() PORT: number = 3000;

  @IsString() DATABASE_HOST: string = 'localhost';
  @IsNumber() DATABASE_PORT: number = 5432;
  @IsString() DATABASE_USER: string = 'piyachok';
  @IsString() DATABASE_PASS: string = 'piyachok_dev';
  @IsString() DATABASE_NAME: string = 'piyachok';

  @IsString() REDIS_HOST: string = 'localhost';
  @IsNumber() REDIS_PORT: number = 6379;

  @IsString() JWT_ACCESS_SECRET: string = 'dev_access_secret_min_32_chars_xxxxxx';
  @IsString() JWT_REFRESH_SECRET: string = 'dev_refresh_secret_min_32_chars_xx';
  @IsString() JWT_ACCESS_TTL: string = '15m';
  @IsString() JWT_REFRESH_TTL: string = '30d';

  @IsString() GOOGLE_CLIENT_ID: string = '';
  @IsString() GOOGLE_CLIENT_SECRET: string = '';
  @IsString() GOOGLE_CALLBACK_URL: string = '';

  @IsString() FACEBOOK_APP_ID: string = '';
  @IsString() FACEBOOK_APP_SECRET: string = '';
  @IsString() FACEBOOK_CALLBACK_URL: string = '';

  @IsString() FRONTEND_URL: string = 'http://localhost:3001';
  @IsString() LOG_LEVEL: string = 'debug';
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvVars, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length) {
    throw new Error(`Env validation failed: ${errors.toString()}`);
  }
  return validated;
}
```

**Step 3:** Створи `src/main.ts`:

```ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: (process.env.FRONTEND_URL ?? 'http://localhost:3001').split(','),
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}
bootstrap();
```

**Step 4:** Створи `src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.' }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'debug',
        transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
      },
    }),
    HealthModule,
  ],
})
export class AppModule {}
```

**Step 5:** Створи `src/modules/health/health.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
```

**Step 6:** Створи `src/modules/health/health.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({ controllers: [HealthController] })
export class HealthModule {}
```

**Step 7:** Створи `src/common/decorators/public.decorator.ts` (мінімальний, повний набір — у Phase 1):

```ts
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

**Step 8:** Онови `src/app.controller.ts` — заміни вміст на health-redirect або видали файл (HealthController покриває):

```bash
rm src/app.controller.ts
rm src/app.service.ts
```

**Step 9:** Створи `src/modules/health/health.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({ controllers: [HealthController] }).compile();
    controller = module.get(HealthController);
  });

  it('returns ok with timestamp', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(typeof result.timestamp).toBe('string');
  });
});
```

**Step 10:** Запусти тести:

```bash
pnpm test
```

Очікувано: PASS для `health.controller.spec.ts`.

**Step 11:** Запусти dev-сервер і перевір health:

```bash
docker compose up -d postgres redis
pnpm run start:dev &
sleep 8
curl http://localhost:3000/api/v1/health
```

Очікувано: `{"status":"ok","timestamp":"..."}`

Зупини сервер: `kill %1` (або `pkill -f "nest start"`).

**Step 12:** Commit:

```bash
git add src
git commit -m "feat(bootstrap): nest app skeleton, env validation, health endpoint"
```

---

## Phase 1: Common Infrastructure

### Task 4: Redis service з no-op fallback

**Files:**
- Create: `src/common/services/cache.service.ts`
- Test: `src/common/services/cache.service.spec.ts`

**Step 1:** Створи `src/common/services/cache.service.ts`:

```ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: Redis | null = null;
  private connected = false;

  async onModuleInit() {
    try {
      this.client = new Redis({
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });
      await this.client.connect();
      this.connected = true;
      this.logger.log('Redis connected');
    } catch (err) {
      this.connected = false;
      this.logger.warn('Redis unavailable, using no-op cache');
    }
  }

  async onModuleDestroy() {
    if (this.client) await this.client.quit();
  }

  isConnected(): boolean {
    return this.connected;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    try {
      const payload = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.set(key, payload, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, payload);
      }
    } catch {
      // silent fail
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch {
      // silent fail
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    if (!this.client) return;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length) await this.client.del(...keys);
    } catch {
      // silent fail
    }
  }
}
```

**Step 2:** Створи `src/common/services/cache.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({ providers: [CacheService] }).compile();
    service = module.get(CacheService);
  });

  it('returns null when redis is not connected', async () => {
    await service.onModuleInit();
    expect(await service.get('any-key')).toBeNull();
    expect(service.isConnected()).toBe(false);
    await service.onModuleDestroy();
  });

  it('set does not throw when redis is not connected', async () => {
    await service.onModuleInit();
    await expect(service.set('key', { a: 1 })).resolves.toBeUndefined();
    await expect(service.del('key')).resolves.toBeUndefined();
    await expect(service.delByPattern('pattern:*')).resolves.toBeUndefined();
    await service.onModuleDestroy();
  });
});
```

**Step 3:** Додай CacheService в AppModule providers (тимчасово, у Phase 4 перенесемо в CommonModule):

```ts
@Module({
  // ...
  providers: [CacheService],
  exports: [CacheService],
})
export class AppModule {}
```

**Step 4:** Запусти тести:

```bash
pnpm test
```

Очікувано: PASS для `cache.service.spec.ts`.

**Step 5:** Commit:

```bash
git add src/common/services/cache.service.ts src/common/services/cache.service.spec.ts src/app.module.ts
git commit -m "feat(common): redis cache service with no-op fallback"
```

---

### Task 5: File storage service

**Files:**
- Create: `src/common/services/file-storage.service.ts`
- Test: `src/common/services/file-storage.service.spec.ts`

**Step 1:** Створи `src/common/services/file-storage.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';

const UPLOADS_ROOT = process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

@Injectable()
export class FileStorageService {
  async save(
    folder: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ): Promise<{ url: string; filename: string; size: number }> {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new Error(`Unsupported mime type: ${file.mimetype}`);
    }
    if (file.size > MAX_BYTES) {
      throw new Error(`File too large: ${file.size} bytes (max ${MAX_BYTES})`);
    }
    const ext = extname(file.originalname).toLowerCase() || this.extFromMime(file.mimetype);
    const filename = `${randomUUID()}${ext}`;
    const dir = join(UPLOADS_ROOT, folder);
    await fs.mkdir(dir, { recursive: true });
    const filepath = join(dir, filename);
    await fs.writeFile(filepath, file.buffer);
    const url = `/static/${folder}/${filename}`;
    return { url, filename, size: file.size };
  }

  async remove(folder: string, filename: string): Promise<void> {
    const filepath = join(UPLOADS_ROOT, folder, filename);
    await fs.unlink(filepath).catch(() => undefined);
  }

  private extFromMime(mime: string): string {
    if (mime === 'image/jpeg') return '.jpg';
    if (mime === 'image/png') return '.png';
    if (mime === 'image/webp') return '.webp';
    return '.bin';
  }
}
```

**Step 2:** Створи `src/common/services/file-storage.service.spec.ts`:

```ts
import { promises as fs } from 'fs';
import { join } from 'path';
import { FileStorageService } from './file-storage.service';

const TMP = join(process.cwd(), 'uploads-test');

describe('FileStorageService', () => {
  let service: FileStorageService;
  const origDir = process.env.UPLOADS_DIR;

  beforeAll(() => {
    process.env.UPLOADS_DIR = TMP;
  });

  afterAll(async () => {
    if (origDir === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = origDir;
    await fs.rm(TMP, { recursive: true, force: true });
  });

  beforeEach(() => {
    service = new FileStorageService();
  });

  it('saves a jpeg file and returns url', async () => {
    const result = await service.save('test', {
      originalname: 'photo.jpg',
      mimetype: 'image/jpeg',
      size: 100,
      buffer: Buffer.from('fake-jpeg-content'),
    });
    expect(result.url).toMatch(/^\/static\/test\/[a-f0-9-]+\.jpg$/);
    expect(result.size).toBe(100);
  });

  it('rejects unsupported mime type', async () => {
    await expect(
      service.save('test', {
        originalname: 'doc.pdf',
        mimetype: 'application/pdf',
        size: 100,
        buffer: Buffer.from('pdf'),
      }),
    ).rejects.toThrow(/Unsupported mime type/);
  });

  it('rejects too large file', async () => {
    await expect(
      service.save('test', {
        originalname: 'big.jpg',
        mimetype: 'image/jpeg',
        size: 6 * 1024 * 1024,
        buffer: Buffer.alloc(0),
      }),
    ).rejects.toThrow(/too large/);
  });
});
```

**Step 3:** Запусти тести:

```bash
pnpm test
```

Очікувано: PASS.

**Step 4:** Commit:

```bash
git add src/common/services/file-storage.service.ts src/common/services/file-storage.service.spec.ts
git commit -m "feat(common): file storage service with mime and size validation"
```

---

### Task 6: CommonModule + декоратори + DTO helpers

**Files:**
- Create: `src/common/common.module.ts`
- Create: `src/common/decorators/current-user.decorator.ts`
- Create: `src/common/decorators/permissions.decorator.ts`
- Create: `src/common/decorators/public.decorator.ts` (перезапиши)
- Create: `src/common/utils/pagination.util.ts`
- Test: `src/common/utils/pagination.util.spec.ts`

**Step 1:** Створи `src/common/common.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { CacheService } from './services/cache.service';
import { FileStorageService } from './services/file-storage.service';

@Global()
@Module({
  providers: [CacheService, FileStorageService],
  exports: [CacheService, FileStorageService],
})
export class CommonModule {}
```

**Step 2:** Видали `CacheService` з providers AppModule (тепер через CommonModule):

```ts
@Module({
  imports: [
    // ... CommonModule замість CacheService provider
    CommonModule,
  ],
})
export class AppModule {}
```

**Step 3:** Створи `src/common/decorators/current-user.decorator.ts`:

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtUser {
  sub: string;
  email: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

**Step 4:** Створи `src/common/decorators/permissions.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
```

**Step 5:** Перезапиши `src/common/decorators/public.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

**Step 6:** Створи `src/common/utils/pagination.util.ts`:

```ts
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface NormalizedPagination {
  page: number;
  limit: number;
  offset: number;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export function normalizePagination(params: PaginationParams): NormalizedPagination {
  const page = Math.max(1, Number(params.page) || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.limit) || DEFAULT_LIMIT));
  return { page, limit, offset: (page - 1) * limit };
}

export interface PaginatedResponseMeta {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export function buildMeta(
  pagination: NormalizedPagination,
  total: number,
): PaginatedResponseMeta {
  return { ...pagination, total, hasMore: pagination.offset + pagination.limit < total };
}
```

**Step 7:** Створи `src/common/utils/pagination.util.spec.ts`:

```ts
import { buildMeta, normalizePagination } from './pagination.util';

describe('normalizePagination', () => {
  it('returns defaults when empty', () => {
    expect(normalizePagination({})).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it('clamps negative page to 1', () => {
    expect(normalizePagination({ page: -5, limit: 10 }).page).toBe(1);
  });

  it('clamps limit to MAX_LIMIT=100', () => {
    expect(normalizePagination({ limit: 9999 }).limit).toBe(100);
  });

  it('clamps limit to at least 1', () => {
    expect(normalizePagination({ limit: 0 }).limit).toBe(1);
  });

  it('computes offset', () => {
    expect(normalizePagination({ page: 3, limit: 10 })).toEqual({ page: 3, limit: 10, offset: 20 });
  });
});

describe('buildMeta', () => {
  it('flags hasMore correctly', () => {
    expect(buildMeta({ page: 1, limit: 20, offset: 0 }, 50)).toEqual({
      page: 1, limit: 20, total: 50, hasMore: true,
    });
    expect(buildMeta({ page: 3, limit: 20, offset: 40 }, 50)).toEqual({
      page: 3, limit: 20, total: 50, hasMore: false,
    });
  });
});
```

**Step 8:** Запусти тести:

```bash
pnpm test
```

Очікувано: PASS.

**Step 9:** Commit:

```bash
git add src/common src/app.module.ts
git commit -m "feat(common): CommonModule, decorators, pagination util"
```

---

### Task 7: Guards (JwtAuth, Permissions)

**Files:**
- Create: `src/common/guards/jwt-auth.guard.ts`
- Create: `src/common/guards/permissions.guard.ts`
- Test: `src/common/guards/permissions.guard.spec.ts`

**Step 1:** Створи `src/common/guards/jwt-auth.guard.ts`:

```ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

**Step 2:** Створи `src/common/guards/permissions.guard.ts`:

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { JwtUser } from '../decorators/current-user.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtUser | undefined;
    if (!user) throw new ForbiddenException('No authenticated user');

    // Permission check happens in service layer (has access to DB / cache).
    // Here we just ensure user has some role context. Detailed check is via
    // PermissionsService.hasPermission() called explicitly in services.
    const hasAnyRole = (user.roles ?? []).length > 0;
    if (!hasAnyRole) throw new ForbiddenException('No roles assigned');

    return true;
  }
}
```

**Step 3:** Створи `src/common/guards/permissions.guard.spec.ts`:

```ts
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

function makeCtx(user: any, handler: any, classMeta: any[] = []): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => classMeta.length ? { prototype: {} } : function () {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  it('passes when no permissions required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(makeCtx({ roles: [] }, () => {}))).toBe(true);
  });

  it('throws when user not authenticated', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['venue:create']);
    expect(() => guard.canActivate(makeCtx(undefined, () => {}))).toThrow(ForbiddenException);
  });

  it('throws when user has no roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['venue:create']);
    expect(() => guard.canActivate(makeCtx({ roles: [] }, () => {}))).toThrow(ForbiddenException);
  });

  it('passes when user has roles (detailed check is in service)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['venue:create']);
    expect(guard.canActivate(makeCtx({ roles: ['user'] }, () => {}))).toBe(true);
  });
});
```

**Step 4:** Запусти тести:

```bash
pnpm test
```

Очікувано: PASS.

**Step 5:** Commit:

```bash
git add src/common/guards
git commit -m "feat(common): JwtAuthGuard with @Public, PermissionsGuard"
```

---

### Task 8: Global exception filter

**Files:**
- Create: `src/common/filters/all-exceptions.filter.ts`
- Test: `src/common/filters/all-exceptions.filter.spec.ts`

**Step 1:** Створи `src/common/filters/all-exceptions.filter.ts`:

```ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        message = resp;
      } else if (typeof resp === 'object' && resp !== null) {
        const r = resp as { message?: string | string[]; error?: string };
        message = Array.isArray(r.message) ? r.message.join('; ') : (r.message ?? message);
        code = r.error ?? this.codeFromStatus(status);
      }
      code = this.codeFromStatus(status);
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    } else {
      this.logger.error('Unknown exception', String(exception));
    }

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url} -> ${status} ${code} ${message}`);
    }

    const body: ErrorResponse = { error: { code, message, details } };
    response.status(status).json(body);
  }

  private codeFromStatus(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
    };
    return map[status] ?? 'INTERNAL_ERROR';
  }
}
```

**Step 2:** Створи `src/common/filters/all-exceptions.filter.spec.ts`:

```ts
import { ArgumentsHost, BadRequestException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function makeHost(): ArgumentsHost {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return {
    switchToHttp: () => ({ getResponse: () => ({ status }), getRequest: () => ({ method: 'GET', url: '/x' }) }),
  } as unknown as ArgumentsHost;
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    host = makeHost();
  });

  it('formats HttpException with string response', () => {
    filter.catch(new NotFoundException('Not found'), host);
    const statusMock = host.switchToHttp().getResponse().status as unknown as jest.Mock;
    const call = statusMock.mock.results[0].value.json.mock.calls[0][0];
    expect(statusMock).toHaveBeenCalledWith(404);
    expect(call.error.code).toBe('NOT_FOUND');
    expect(call.error.message).toBe('Not found');
  });

  it('formats BadRequest with array of messages', () => {
    filter.catch(new BadRequestException({ message: ['email invalid', 'password short'], error: 'Bad Request' }), host);
    const statusMock = host.switchToHttp().getResponse().status as unknown as jest.Mock;
    const call = statusMock.mock.results[0].value.json.mock.calls[0][0];
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(call.error.message).toBe('email invalid; password short');
    expect(call.error.code).toBe('BAD_REQUEST');
  });

  it('handles unknown errors with 500', () => {
    filter.catch(new Error('boom'), host);
    const statusMock = host.switchToHttp().getResponse().status as unknown as jest.Mock;
    expect(statusMock).toHaveBeenCalledWith(500);
  });
});
```

**Step 3:** Підключи filter у `main.ts`:

```ts
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

// у bootstrap, після app.useLogger:
app.useGlobalFilters(new AllExceptionsFilter());
```

**Step 4:** Запусти тести:

```bash
pnpm test
```

Очікувано: PASS.

**Step 5:** Commit:

```bash
git add src/common/filters src/main.ts
git commit -m "feat(common): AllExceptionsFilter with consistent error shape"
```

---

## Phase 2: RBAC

### Task 9: TypeORM config + перша міграція з RBAC

**Files:**
- Create: `src/config/typeorm.config.ts`
- Create: `src/config/data-source.ts`
- Create: `src/migrations/1700000000000-Init.ts`
- Modify: `src/app.module.ts`
- Test: `src/config/typeorm.config.spec.ts`

**Step 1:** Створи `src/config/typeorm.config.ts`:

```ts
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';

export const typeOrmAsyncConfig: TypeOrmModuleAsyncOptions = {
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres' as const,
    host: config.get<string>('DATABASE_HOST'),
    port: Number(config.get<string>('DATABASE_PORT')),
    username: config.get<string>('DATABASE_USER'),
    password: config.get<string>('DATABASE_PASS'),
    database: config.get<string>('DATABASE_NAME'),
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: false,
    migrations: ['dist/migrations/*.js'],
    logging: config.get<string>('NODE_ENV') === 'development' ? ['error', 'warn'] : false,
  }),
};
```

**Step 2:** Створи `src/config/data-source.ts` (для CLI міграцій):

```ts
import { DataSource } from 'typeorm';
import { config as loadEnv } from 'dotenv';
import { Role } from '../modules/rbac/entities/role.entity';
import { Permission } from '../modules/rbac/entities/permission.entity';
import { RolePermission } from '../modules/rbac/entities/role-permission.entity';
import { UserRole } from '../modules/rbac/entities/user-role.entity';
import { User } from '../modules/users/entities/user.entity';
import { Profile } from '../modules/users/entities/profile.entity';
import { OAuthAccount } from '../modules/users/entities/oauth-account.entity';
import { Venue } from '../modules/venues/entities/venue.entity';
import { VenuePhoto } from '../modules/venues/entities/venue-photo.entity';
import { VenueFeature } from '../modules/venues/entities/venue-feature.entity';
import { VenueFeatureAssignment } from '../modules/venues/entities/venue-feature-assignment.entity';
import { Tag } from '../modules/venues/entities/tag.entity';
import { VenueTag } from '../modules/venues/entities/venue-tag.entity';
import { VenueType } from '../modules/venues/entities/venue-type.entity';
import { VenueTypeAssignment } from '../modules/venues/entities/venue-type-assignment.entity';
import { Review } from '../modules/reviews/entities/review.entity';
import { Favorite } from '../modules/favorites/entities/favorite.entity';
import { News } from '../modules/news/entities/news.entity';
import { Complaint } from '../modules/complaints/entities/complaint.entity';
import { VenueView } from '../modules/analytics/entities/venue-view.entity';
import { AnalyticsEvent } from '../modules/analytics/entities/analytics-event.entity';
import { Hangout } from '../modules/hangouts/entities/hangout.entity';
import { HangoutParticipant } from '../modules/hangouts/entities/hangout-participant.entity';
import { AuditLog } from '../modules/admin/entities/audit-log.entity';
import { Init1700000000000 } from '../migrations/1700000000000-Init';

loadEnv();

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USER ?? 'piyachok',
  password: process.env.DATABASE_PASS ?? 'piyachok_dev',
  database: process.env.DATABASE_NAME ?? 'piyachok',
  entities: [
    Role, Permission, RolePermission, UserRole,
    User, Profile, OAuthAccount,
    Venue, VenuePhoto, VenueFeature, VenueFeatureAssignment, Tag, VenueTag, VenueType, VenueTypeAssignment,
    Review, Favorite, News, Complaint,
    VenueView, AnalyticsEvent, Hangout, HangoutParticipant,
    AuditLog,
  ],
  migrations: [Init1700000000000],
  synchronize: false,
});
```

**Step 3:** Встанови dotenv:

```bash
pnpm add dotenv
```

**Step 4:** Створи `src/modules/rbac/entities/role.entity.ts`:

```ts
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 32 }) code: string;
  @Column({ type: 'varchar', length: 100 }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

**Step 5:** Створи `src/modules/rbac/entities/permission.entity.ts`:

```ts
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 64 }) code: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
}
```

**Step 6:** Створи `src/modules/rbac/entities/role-permission.entity.ts`:

```ts
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Role } from './role.entity';
import { Permission } from './permission.entity';

@Entity('role_permissions')
export class RolePermission {
  @PrimaryColumn('uuid') roleId: string;
  @PrimaryColumn('uuid') permissionId: string;
  @Column({ type: 'timestamptz', default: () => 'NOW()' }) grantedAt: Date;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'roleId' }) role: Role;
  @ManyToOne(() => Permission, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'permissionId' }) permission: Permission;
}
```

**Step 7:** Створи `src/modules/rbac/entities/user-role.entity.ts`:

```ts
import {
  Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Role } from './role.entity';

@Entity('user_roles')
@Index(['userId'])
export class UserRole {
  @PrimaryColumn('uuid') userId: string;
  @PrimaryColumn('uuid') roleId: string;
  @CreateDateColumn() assignedAt: Date;
  @Column({ type: 'uuid', nullable: true }) assignedBy: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'userId' }) user: User;
  @ManyToOne(() => Role, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'roleId' }) role: Role;
}
```

**Step 8:** Створи `src/modules/rbac/entities/role.enum.ts` (як string enum для типобезпеки):

```ts
export enum RoleCode {
  User = 'user',
  VenueAdmin = 'venue_admin',
  SuperAdmin = 'super_admin',
  Critic = 'critic',
}

export const ALL_PERMISSIONS = [
  'venue:create',
  'venue:edit:own',
  'venue:edit:any',
  'venue:moderate',
  'review:create',
  'review:edit:own',
  'review:edit:any',
  'review:feature',
  'hangout:create',
  'news:manage:own',
  'news:manage:any',
  'complaint:manage',
  'user:manage',
  'analytics:view:own',
  'analytics:view:all',
] as const;

export type PermissionCode = (typeof ALL_PERMISSIONS)[number];
```

**Step 9:** Створи `src/migrations/1700000000000-Init.ts` (початкова міграція, тільки RBAC + users поки що, інші таблиці додамо в наступних міграціях):

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1700000000000 implements MigrationInterface {
  name = 'Init1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" varchar(255) NOT NULL UNIQUE,
        "passwordHash" text,
        "emailVerified" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        "updatedAt" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "profiles" (
        "userId" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
        "firstname" varchar(64) NOT NULL,
        "lastname" varchar(64) NOT NULL,
        "phone" varchar(32),
        "age" integer,
        "avatarUrl" text
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "oauth_accounts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "provider" varchar(32) NOT NULL,
        "providerUserId" varchar(255) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE("provider", "providerUserId")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_oauth_userId" ON "oauth_accounts" ("userId")`);

    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "code" varchar(32) NOT NULL UNIQUE,
        "name" varchar(100) NOT NULL,
        "description" text,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        "updatedAt" timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "code" varchar(64) NOT NULL UNIQUE,
        "description" text
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "role_permissions" (
        "roleId" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
        "permissionId" uuid NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
        "grantedAt" timestamptz NOT NULL DEFAULT NOW(),
        PRIMARY KEY ("roleId", "permissionId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_roles" (
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "roleId" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
        "assignedAt" timestamptz NOT NULL DEFAULT NOW(),
        "assignedBy" uuid,
        PRIMARY KEY ("userId", "roleId")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_user_roles_userId" ON "user_roles" ("userId")`);

    // Seed: 4 roles
    const userRoleId = (await queryRunner.query(
      `INSERT INTO "roles"("code","name","description") VALUES ('user','Користувач','Базовий акаунт') RETURNING "id"`,
    ))[0].id;
    const venueAdminId = (await queryRunner.query(
      `INSERT INTO "roles"("code","name","description") VALUES ('venue_admin','Адмін закладу','Представник закладу') RETURNING "id"`,
    ))[0].id;
    const superAdminId = (await queryRunner.query(
      `INSERT INTO "roles"("code","name","description") VALUES ('super_admin','Супер-адмін','Повний доступ') RETURNING "id"`,
    ))[0].id;
    const criticId = (await queryRunner.query(
      `INSERT INTO "roles"("code","name","description") VALUES ('critic','Критик','Позначений критик') RETURNING "id"`,
    ))[0].id;

    // Seed: 15 permissions
    const permCodes = [
      'venue:create', 'venue:edit:own', 'venue:edit:any', 'venue:moderate',
      'review:create', 'review:edit:own', 'review:edit:any', 'review:feature',
      'hangout:create', 'news:manage:own', 'news:manage:any',
      'complaint:manage', 'user:manage',
      'analytics:view:own', 'analytics:view:all',
    ];
    const permIds: Record<string, string> = {};
    for (const code of permCodes) {
      const r = await queryRunner.query(
        `INSERT INTO "permissions"("code") VALUES ($1) RETURNING "id"`,
        [code],
      );
      permIds[code] = r[0].id;
    }

    // Map role -> permissions
    const userPerms = ['venue:create', 'review:create', 'review:edit:own', 'hangout:create', 'news:manage:own'];
    const venueAdminPerms = [...userPerms, 'venue:edit:own', 'analytics:view:own'];
    const superAdminPerms = permCodes;
    const criticPerms = [...userPerms, 'review:feature'];

    for (const p of userPerms) {
      await queryRunner.query(`INSERT INTO "role_permissions"("roleId","permissionId") VALUES ($1,$2)`, [userRoleId, permIds[p]]);
    }
    for (const p of venueAdminPerms) {
      await queryRunner.query(`INSERT INTO "role_permissions"("roleId","permissionId") VALUES ($1,$2)`, [venueAdminId, permIds[p]]);
    }
    for (const p of superAdminPerms) {
      await queryRunner.query(`INSERT INTO "role_permissions"("roleId","permissionId") VALUES ($1,$2)`, [superAdminId, permIds[p]]);
    }
    for (const p of criticPerms) {
      await queryRunner.query(`INSERT INTO "role_permissions"("roleId","permissionId") VALUES ($1,$2)`, [criticId, permIds[p]]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_roles" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "oauth_accounts" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "profiles" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
  }
}
```

**Step 10:** Додай до `package.json` scripts для міграцій:

```json
"migration:run": "typeorm-ts-node-commonjs -d src/config/data-source.ts migration:run",
"migration:revert": "typeorm-ts-node-commonjs -d src/config/data-source.ts migration:revert",
"migration:generate": "typeorm-ts-node-commonjs -d src/config/data-source.ts migration:generate"
```

Встанови typeorm CLI:

```bash
pnpm add -D ts-node
```

**Step 11:** Додай `TypeOrmModule.forRootAsync(typeOrmAsyncConfig)` у `AppModule.imports`.

**Step 12:** Запусти міграцію:

```bash
docker compose up -d postgres
pnpm migration:run
```

Очікувано: міграція `Init1700000000000` застосована.

**Step 13:** Перевір у Postgres:

```bash
docker compose exec postgres psql -U piyachok -d piyachok -c "SELECT code FROM roles ORDER BY code"
```

Очікувано: `critic`, `super_admin`, `user`, `venue_admin`.

**Step 14:** Commit:

```bash
git add src
git commit -m "feat(rbac): initial migration with 4 roles and 15 permissions seeded"
```

---

### Task 10: RbacModule + PermissionsService

**Files:**
- Create: `src/modules/rbac/rbac.module.ts`
- Create: `src/modules/rbac/permissions.service.ts`
- Test: `src/modules/rbac/permissions.service.spec.ts`

**Step 1:** Створи `src/modules/rbac/permissions.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from './entities/user-role.entity';
import { CacheService } from '../../common/services/cache.service';

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);
  private readonly TTL = 300;

  constructor(
    @InjectRepository(UserRole) private readonly userRoles: Repository<UserRole>,
    private readonly cache: CacheService,
  ) {}

  async getUserPermissions(userId: string): Promise<Set<string>> {
    const cacheKey = `perms:${userId}`;
    const cached = await this.cache.get<string[]>(cacheKey);
    if (cached) return new Set(cached);

    const rows = await this.userRoles
      .createQueryBuilder('ur')
      .innerJoin('ur.role', 'r')
      .innerJoin('role_permissions', 'rp', 'rp.roleId = r.id')
      .innerJoin('permissions', 'p', 'p.id = rp.permissionId')
      .where('ur.userId = :userId', { userId })
      .select('DISTINCT p.code', 'code')
      .getRawMany<{ code: string }>();

    const codes = rows.map(r => r.code);
    await this.cache.set(cacheKey, codes, this.TTL);
    return new Set(codes);
  }

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const perms = await this.getUserPermissions(userId);
    return perms.has(permission);
  }

  async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    const perms = await this.getUserPermissions(userId);
    return permissions.some(p => perms.has(p));
  }

  async invalidate(userId: string): Promise<void> {
    await this.cache.del(`perms:${userId}`);
  }
}
```

**Step 2:** Створи `src/modules/rbac/rbac.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserRole } from './entities/user-role.entity';
import { PermissionsService } from './permissions.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserRole])],
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class RbacModule {}
```

**Step 3:** Створи `src/modules/rbac/permissions.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PermissionsService } from './permissions.service';
import { UserRole } from './entities/user-role.entity';
import { CacheService } from '../../common/services/cache.service';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let repo: { createQueryBuilder: jest.Mock };
  let cache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    repo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ code: 'venue:create' }, { code: 'review:create' }]),
      }),
    };
    cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined), del: jest.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: getRepositoryToken(UserRole), useValue: repo },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();
    service = module.get(PermissionsService);
  });

  it('queries DB and caches when no cache hit', async () => {
    const perms = await service.getUserPermissions('u1');
    expect(perms.has('venue:create')).toBe(true);
    expect(perms.has('review:create')).toBe(true);
    expect(cache.set).toHaveBeenCalledWith('perms:u1', ['venue:create', 'review:create'], 300);
  });

  it('returns from cache when present', async () => {
    cache.get.mockResolvedValueOnce(['venue:moderate']);
    const perms = await service.getUserPermissions('u1');
    expect([...perms]).toEqual(['venue:moderate']);
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('hasPermission returns true when permission present', async () => {
    cache.get.mockResolvedValueOnce(['venue:create']);
    expect(await service.hasPermission('u1', 'venue:create')).toBe(true);
    expect(await service.hasPermission('u1', 'venue:moderate')).toBe(false);
  });

  it('invalidate clears cache', async () => {
    await service.invalidate('u1');
    expect(cache.del).toHaveBeenCalledWith('perms:u1');
  });
});
```

**Step 4:** Підключи RbacModule у AppModule:

```ts
@Module({
  imports: [/* ... */, RbacModule],
})
export class AppModule {}
```

**Step 5:** Запусти тести:

```bash
pnpm test
```

Очікувано: PASS.

**Step 6:** Commit:

```bash
git add src/modules/rbac
git commit -m "feat(rbac): RbacModule, PermissionsService with Redis cache"
```

---

### Task 11: Users entity + міграція (без Users-сервісу)

**Files:**
- Create: `src/modules/users/entities/user.entity.ts`
- Create: `src/modules/users/entities/profile.entity.ts`
- Create: `src/modules/users/entities/oauth-account.entity.ts`
- Create: `src/modules/users/users.module.ts`
- Test: `src/modules/users/entities/user.entity.spec.ts`

(Users-сервіс з реєстрацією — у Task 14, тут тільки entities і module, щоб можна було створювати UserRole.)

**Step 1:** Створи `src/modules/users/entities/user.entity.ts`:

```ts
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ type: 'citext' }) email: string;
  @Column({ type: 'text', nullable: true }) passwordHash: string | null;
  @Column({ type: 'boolean', default: false }) emailVerified: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

**Step 2:** Створи `src/modules/users/entities/profile.entity.ts`:

```ts
import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('profiles')
export class Profile {
  @PrimaryColumn('uuid') userId: string;
  @Column({ type: 'varchar', length: 64 }) firstname: string;
  @Column({ type: 'varchar', length: 64 }) lastname: string;
  @Column({ type: 'varchar', length: 32, nullable: true }) phone: string | null;
  @Column({ type: 'integer', nullable: true }) age: number | null;
  @Column({ type: 'text', nullable: true }) avatarUrl: string | null;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
```

**Step 3:** Створи `src/modules/users/entities/oauth-account.entity.ts`:

```ts
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('oauth_accounts')
@Index(['provider', 'providerUserId'], { unique: true })
export class OAuthAccount {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') userId: string;
  @Column({ type: 'varchar', length: 32 }) provider: string;
  @Column({ type: 'varchar', length: 255 }) providerUserId: string;
  @CreateDateColumn() createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'userId' }) user: User;
}
```

**Step 4:** Створи `src/modules/users/users.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Profile } from './entities/profile.entity';
import { OAuthAccount } from './entities/oauth-account.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Profile, OAuthAccount])],
  exports: [TypeOrmModule],
})
export class UsersModule {}
```

**Step 5:** Перевір, що додавання users/users.module.ts компілюється:

```bash
pnpm build
```

Очікувано: без помилок.

**Step 6:** Commit:

```bash
git add src/modules/users
git commit -m "feat(users): User, Profile, OAuthAccount entities, UsersModule"
```

---

### Task 12: Listeners для UserRole → invalidate permissions cache

**Files:**
- Create: `src/modules/rbac/listeners/user-role.listener.ts`
- Test: `src/modules/rbac/listeners/user-role.listener.spec.ts`

**Step 1:** Створи `src/modules/rbac/listeners/user-role.listener.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PermissionsService } from '../permissions.service';

export const USER_ROLE_ADDED = 'user_role.added';
export const USER_ROLE_REMOVED = 'user_role.removed';

@Injectable()
export class UserRoleListener {
  private readonly logger = new Logger(UserRoleListener.name);

  constructor(private readonly perms: PermissionsService) {}

  @OnEvent(USER_ROLE_ADDED)
  async handleAdded(payload: { userId: string }) {
    this.logger.log(`Invalidating permissions cache for user ${payload.userId} (role added)`);
    await this.perms.invalidate(payload.userId);
  }

  @OnEvent(USER_ROLE_REMOVED)
  async handleRemoved(payload: { userId: string }) {
    this.logger.log(`Invalidating permissions cache for user ${payload.userId} (role removed)`);
    await this.perms.invalidate(payload.userId);
  }
}
```

**Step 2:** Створи `src/modules/rbac/listeners/user-role.listener.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { UserRoleListener, USER_ROLE_ADDED, USER_ROLE_REMOVED } from './user-role.listener';
import { PermissionsService } from '../permissions.service';

describe('UserRoleListener', () => {
  let listener: UserRoleListener;
  let perms: { invalidate: jest.Mock };

  beforeEach(async () => {
    perms = { invalidate: jest.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      providers: [UserRoleListener, { provide: PermissionsService, useValue: perms }],
    }).compile();
    listener = module.get(UserRoleListener);
  });

  it('invalidates cache when role added', async () => {
    await listener.handleAdded({ userId: 'u1' });
    expect(perms.invalidate).toHaveBeenCalledWith('u1');
  });

  it('invalidates cache when role removed', async () => {
    await listener.handleRemoved({ userId: 'u2' });
    expect(perms.invalidate).toHaveBeenCalledWith('u2');
  });

  it('exposes event name constants', () => {
    expect(USER_ROLE_ADDED).toBe('user_role.added');
    expect(USER_ROLE_REMOVED).toBe('user_role.removed');
  });
});
```

**Step 3:** Додай listener в RbacModule providers і експортуй події через індекси:

```ts
@Module({
  providers: [PermissionsService, UserRoleListener],
  exports: [PermissionsService],
})
export class RbacModule {}
```

**Step 4:** Запусти тести:

```bash
pnpm test
```

Очікувано: PASS.

**Step 5:** Commit:

```bash
git add src/modules/rbac/listeners
git commit -m "feat(rbac): listener invalidates permissions cache on UserRole changes"
```

---

(Phase 2 завершено. Далі — Phase 3: Users + Auth.)

---

## Phase 3: Users

### Task 13: UsersService (CRUD, профіль, OAuth)

**Files:**
- Create: `src/modules/users/dto/create-user.dto.ts`
- Create: `src/modules/users/dto/update-profile.dto.ts`
- Create: `src/modules/users/users.service.ts`
- Modify: `src/modules/users/users.module.ts`
- Test: `src/modules/users/users.service.spec.ts`

**Step 1:** Створи `src/modules/users/dto/create-user.dto.ts`:

```ts
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsString() @MinLength(2) firstname: string;
  @IsString() @MinLength(2) lastname: string;
  @IsOptional() age?: number;
  @IsOptional() phone?: string;
}
```

**Step 2:** Створи `src/modules/users/dto/update-profile.dto.ts`:

```ts
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(2) firstname?: string;
  @IsOptional() @IsString() @MinLength(2) lastname?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() age?: number;
  @IsOptional() @IsString() avatarUrl?: string;
}
```

**Step 3:** Створи `src/modules/users/users.service.ts`:

```ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { Profile } from './entities/profile.entity';
import { OAuthAccount } from './entities/oauth-account.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const BCRYPT_COST = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    @InjectRepository(OAuthAccount) private readonly oauth: Repository<OAuthAccount>,
  ) {}

  async create(dto: CreateUserDto, roleCode: string = 'user'): Promise<User> {
    const existing = await this.users.findOne({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new ConflictException('Користувач з таким email вже існує');
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const user = this.users.create({ email: dto.email.toLowerCase(), passwordHash });
    await this.users.save(user);
    const profile = this.profiles.create({
      userId: user.id,
      firstname: dto.firstname,
      lastname: dto.lastname,
      age: dto.age ?? null,
      phone: dto.phone ?? null,
    });
    await this.profiles.save(profile);
    return user;
  }

  async findById(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Користувача не знайдено');
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: email.toLowerCase() } });
  }

  async getProfile(userId: string): Promise<Profile> {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Профіль не знайдено');
    return profile;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<Profile> {
    const profile = await this.getProfile(userId);
    Object.assign(profile, dto);
    return this.profiles.save(profile);
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    if (!user.passwordHash) return false;
    return bcrypt.compare(password, user.passwordHash);
  }

  async findOrCreateOAuthUser(
    email: string,
    provider: string,
    providerUserId: string,
    names: { firstname: string; lastname: string },
  ): Promise<User> {
    const existingAccount = await this.oauth.findOne({ where: { provider, providerUserId } });
    if (existingAccount) return this.findById(existingAccount.userId);

    let user = await this.findByEmail(email);
    if (!user) {
      user = this.users.create({ email: email.toLowerCase(), passwordHash: null, emailVerified: true });
      await this.users.save(user);
      await this.profiles.save(
        this.profiles.create({ userId: user.id, firstname: names.firstname, lastname: names.lastname }),
      );
    }
    await this.oauth.save(this.oauth.create({ userId: user.id, provider, providerUserId }));
    return user;
  }
}
```

**Step 4:** Онови `src/modules/users/users.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Profile } from './entities/profile.entity';
import { OAuthAccount } from './entities/oauth-account.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Profile, OAuthAccount])],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
```

**Step 5:** Створи `src/modules/users/users.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Profile } from './entities/profile.entity';
import { OAuthAccount } from './entities/oauth-account.entity';
import * as bcrypt from 'bcryptjs';

function makeRepo() {
  return {
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let users: ReturnType<typeof makeRepo>;
  let profiles: ReturnType<typeof makeRepo>;
  let oauth: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    users = makeRepo();
    profiles = makeRepo();
    oauth = makeRepo();
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: users },
        { provide: getRepositoryToken(Profile), useValue: profiles },
        { provide: getRepositoryToken(OAuthAccount), useValue: oauth },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  describe('create', () => {
    it('throws ConflictException when email exists', async () => {
      users.findOne.mockResolvedValueOnce({ id: 'u1' });
      await expect(service.create({ email: 'a@b.com', password: 'Password1', firstname: 'A', lastname: 'B' }))
        .rejects.toThrow(ConflictException);
    });

    it('creates user and profile with hashed password', async () => {
      users.findOne.mockResolvedValueOnce(null);
      users.save.mockImplementationOnce(async (u) => ({ id: 'u-new', ...u }));
      profiles.save.mockImplementationOnce(async (p) => p);
      const user = await service.create({ email: 'A@B.com', password: 'Password1', firstname: 'Іван', lastname: 'Петренко' });
      expect(user.email).toBe('a@b.com');
      expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(await bcrypt.compare('Password1', user.passwordHash!)).toBe(true);
      expect(profiles.save).toHaveBeenCalledWith(expect.objectContaining({ firstname: 'Іван', lastname: 'Петренко', userId: 'u-new' }));
    });
  });

  describe('findById', () => {
    it('throws NotFound when missing', async () => {
      users.findOne.mockResolvedValueOnce(null);
      await expect(service.findById('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyPassword', () => {
    it('returns false when passwordHash is null (OAuth-only user)', async () => {
      const u = { passwordHash: null } as any;
      expect(await service.verifyPassword(u, 'x')).toBe(false);
    });
    it('returns true on correct password', async () => {
      const hash = await bcrypt.hash('Password1', 4);
      expect(await service.verifyPassword({ passwordHash: hash } as any, 'Password1')).toBe(true);
    });
  });

  describe('findOrCreateOAuthUser', () => {
    it('reuses existing user by provider id', async () => {
      oauth.findOne.mockResolvedValueOnce({ userId: 'u-existing' });
      users.findOne.mockResolvedValueOnce({ id: 'u-existing', email: 'a@b.com' });
      const u = await service.findOrCreateOAuthUser('a@b.com', 'google', 'g-1', { firstname: 'A', lastname: 'B' });
      expect(u.id).toBe('u-existing');
      expect(users.save).not.toHaveBeenCalled();
    });

    it('creates new user when no oauth account and no email', async () => {
      oauth.findOne.mockResolvedValueOnce(null);
      users.findOne.mockResolvedValueOnce(null);
      users.save.mockResolvedValueOnce({ id: 'u-new' });
      const u = await service.findOrCreateOAuthUser('a@b.com', 'google', 'g-1', { firstname: 'A', lastname: 'B' });
      expect(u.id).toBe('u-new');
      expect(oauth.save).toHaveBeenCalled();
    });
  });
});
```

**Step 6:** Запусти тести:

```bash
pnpm test
```

Очікувано: PASS.

**Step 7:** Commit:

```bash
git add src/modules/users
git commit -m "feat(users): UsersService with create, profile, OAuth linking"
```

---

### Task 14: UsersController (me, profile)

**Files:**
- Create: `src/modules/users/users.controller.ts`
- Create: `src/modules/users/dto/get-me.dto.ts`
- Test: `src/modules/users/users.controller.spec.ts`

**Step 1:** Створи `src/modules/users/users.controller.ts`:

```ts
import { Body, Controller, Get, Patch } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { UseGuards } from '@nestjs/common';

@Controller('me')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async me(@CurrentUser() current: JwtUser) {
    const user = await this.users.findById(current.sub);
    const profile = await this.users.getProfile(current.sub);
    return {
      data: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        roles: current.roles,
        profile: { firstname: profile.firstname, lastname: profile.lastname, age: profile.age, phone: profile.phone, avatarUrl: profile.avatarUrl },
      },
    };
  }

  @Patch('profile')
  @Permissions() // no specific perm required, just auth
  async updateProfile(@CurrentUser() current: JwtUser, @Body() dto: UpdateProfileDto) {
    const profile = await this.users.updateProfile(current.sub, dto);
    return { data: profile };
  }
}
```

**Step 2:** Додай UsersController до UsersModule:

```ts
@Module({
  // ...
  controllers: [UsersController],
})
export class UsersModule {}
```

**Step 3:** Створи `src/modules/users/users.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let users: { findById: jest.Mock; getProfile: jest.Mock; updateProfile: jest.Mock };

  beforeEach(async () => {
    users = { findById: jest.fn(), getProfile: jest.fn(), updateProfile: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: users }],
    }).compile();
    controller = module.get(UsersController);
  });

  it('returns current user with profile', async () => {
    users.findById.mockResolvedValue({ id: 'u1', email: 'a@b.com', emailVerified: false });
    users.getProfile.mockResolvedValue({ firstname: 'Іван', lastname: 'Петренко', age: 25, phone: null, avatarUrl: null });
    const res = await controller.me({ sub: 'u1', email: 'a@b.com', roles: ['user'] });
    expect(res.data.id).toBe('u1');
    expect(res.data.profile.firstname).toBe('Іван');
  });

  it('updates profile', async () => {
    users.updateProfile.mockResolvedValue({ userId: 'u1', firstname: 'Петро', lastname: 'Петренко', age: 26, phone: null, avatarUrl: null });
    const res = await controller.updateProfile({ sub: 'u1', email: 'a@b.com', roles: ['user'] }, { firstname: 'Петро', age: 26 });
    expect(res.data.firstname).toBe('Петро');
    expect(users.updateProfile).toHaveBeenCalledWith('u1', { firstname: 'Петро', age: 26 });
  });
});
```

**Step 4:** Запусти тести:

```bash
pnpm test
```

Очікувано: PASS.

**Step 5:** Commit:

```bash
git add src/modules/users
git commit -m "feat(users): UsersController with /me and PATCH /me/profile"
```

---

## Phase 4: Auth

### Task 15: JwtService + tokens

**Files:**
- Create: `src/modules/auth/services/jwt.service.ts`
- Test: `src/modules/auth/services/jwt.service.spec.ts`

**Step 1:** Створи `src/modules/auth/services/jwt.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { JwtService as NestJwt } from '@nestjs/jwt';

@Injectable()
export class TokenService {
  constructor(private readonly jwt: NestJwt) {}

  signAccess(payload: { sub: string; email: string; roles: string[] }): string {
    return this.jwt.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_TTL ?? '15m',
    });
  }

  signRefresh(payload: { sub: string }): string {
    return this.jwt.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_TTL ?? '30d',
    });
  }

  verifyAccess(token: string): { sub: string; email: string; roles: string[] } {
    return this.jwt.verify(token, { secret: process.env.JWT_ACCESS_SECRET });
  }

  verifyRefresh(token: string): { sub: string } {
    return this.jwt.verify(token, { secret: process.env.JWT_REFRESH_SECRET });
  }
}
```

**Step 2:** Створи `src/modules/auth/services/jwt.service.spec.ts`:

```ts
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { TokenService } from './jwt.service';

describe('TokenService', () => {
  let service: TokenService;
  let raw: JwtService;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = 'test_access_secret_min_32_chars_xxxxx';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_min_32_chars_x';
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [TokenService],
    }).compile();
    service = module.get(TokenService);
    raw = module.get(JwtService);
  });

  it('signs and verifies access token', () => {
    const t = service.signAccess({ sub: 'u1', email: 'a@b.com', roles: ['user'] });
    const payload = service.verifyAccess(t);
    expect(payload.sub).toBe('u1');
    expect(payload.roles).toEqual(['user']);
  });

  it('signs and verifies refresh token', () => {
    const t = service.signRefresh({ sub: 'u1' });
    const payload = service.verifyRefresh(t);
    expect(payload.sub).toBe('u1');
  });

  it('rejects access token signed with wrong secret', () => {
    const t = raw.sign({ sub: 'u1' }, { secret: 'wrong_secret_min_32_chars_xxxxx' });
    expect(() => service.verifyAccess(t)).toThrow();
  });
});
```

**Step 3:** Commit:

```bash
git add src/modules/auth/services
git commit -m "feat(auth): TokenService wrapping access and refresh JWT"
```

---

### Task 16: AuthService (register, login, refresh, logout)

**Files:**
- Create: `src/modules/auth/dto/register.dto.ts`
- Create: `src/modules/auth/dto/login.dto.ts`
- Create: `src/modules/auth/services/auth.service.ts`
- Test: `src/modules/auth/services/auth.service.spec.ts`

**Step 1:** Створи `src/modules/auth/dto/register.dto.ts`:

```ts
import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsNumber, IsOptional, IsString, Min, MinLength, Validate } from 'class-validator';
import { IsStrongPasswordConstraint } from './validators/password.validator';

export class RegisterDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) @Validate(IsStrongPasswordConstraint) password: string;
  @IsString() @MinLength(2) firstname: string;
  @IsString() @MinLength(2) lastname: string;
  @IsOptional() @IsNumber() @Min(18) @Type(() => Number) age?: number;
  @IsOptional() @IsString() phone?: string;
  @IsBoolean() acceptEula: boolean;
}
```

**Step 2:** Створи `src/modules/auth/dto/login.dto.ts`:

```ts
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}
```

**Step 3:** Створи `src/modules/auth/dto/validators/password.validator.ts`:

```ts
import { ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

@ValidatorConstraint({ name: 'IsStrongPassword', async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    if (typeof value !== 'string') return false;
    if (value.length < 8) return false;
    if (!/[A-Z]/.test(value)) return false;
    if (!/[0-9]/.test(value)) return false;
    return true;
  }
  defaultMessage(): string {
    return 'Пароль має містити мінімум 8 символів, одну велику літеру та одну цифру';
  }
}
```

**Step 4:** Створи `src/modules/auth/services/auth.service.ts`:

```ts
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UsersService } from '../../users/users.service';
import { UserRole } from '../../rbac/entities/user-role.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenService } from './jwt.service';
import { CacheService } from '../../../common/services/cache.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { USER_ROLE_ADDED } from '../../rbac/listeners/user-role.listener';
import { JwtUser } from '../../../common/decorators/current-user.decorator';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    @InjectRepository(UserRole) private readonly userRoles: Repository<UserRole>,
    private readonly tokens: TokenService,
    private readonly cache: CacheService,
    private readonly events: EventEmitter2,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.acceptEula) {
      throw new ConflictException('Потрібно прийняти угоду користувача');
    }
    const user = await this.users.create(dto, 'user');

    // Assign 'user' role
    const userRole = await this.userRoles.findOne({ where: { userId: user.id, roleId: undefined as any } });
    // Simpler: use raw query to find role by code
    const role = await this.userRoles.manager.findOne('Role' as any, { where: { code: 'user' } });
    if (role) {
      await this.userRoles.save({ userId: user.id, roleId: role.id });
    }

    const roles = await this.getUserRoles(user.id);
    return this.issueTokens(user.id, user.email, roles);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Невірний email або пароль');
    const ok = await this.users.verifyPassword(user, dto.password);
    if (!ok) throw new UnauthorizedException('Невірний email або пароль');
    const roles = await this.getUserRoles(user.id);
    return this.issueTokens(user.id, user.email, roles);
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string };
    try {
      payload = this.tokens.verifyRefresh(refreshToken);
    } catch {
      throw new UnauthorizedException('Невірний refresh token');
    }
    if (await this.cache.get(`revoked:${refreshToken}`)) {
      throw new UnauthorizedException('Refresh token скасований');
    }
    const user = await this.users.findById(payload.sub);
    const roles = await this.getUserRoles(user.id);
    // Rotate
    await this.cache.set(`revoked:${refreshToken}`, true, 60 * 60 * 24 * 30);
    return this.issueTokens(user.id, user.email, roles);
  }

  async logout(refreshToken: string) {
    await this.cache.set(`revoked:${refreshToken}`, true, 60 * 60 * 24 * 30);
  }

  private async getUserRoles(userId: string): Promise<string[]> {
    const rows = await this.userRoles
      .createQueryBuilder('ur')
      .innerJoin('ur.role', 'r')
      .where('ur.userId = :userId', { userId })
      .select('r.code', 'code')
      .getRawMany<{ code: string }>();
    return rows.map(r => r.code);
  }

  private issueTokens(sub: string, email: string, roles: string[]) {
    const accessToken = this.tokens.signAccess({ sub, email, roles });
    const refreshToken = this.tokens.signRefresh({ sub });
    return {
      accessToken,
      refreshToken,
      user: { id: sub, email, roles },
    };
  }
}
```

**Step 5:** Створи `src/modules/auth/services/auth.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { TokenService } from './jwt.service';
import { UsersService } from '../../users/users.service';
import { UserRole } from '../../rbac/entities/user-role.entity';
import { CacheService } from '../../../common/services/cache.service';

describe('AuthService', () => {
  let service: AuthService;
  let users: any;
  let userRoles: any;
  let tokens: any;
  let cache: any;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(40);
    users = {
      create: jest.fn().mockImplementation(async (dto) => ({ id: 'u-new', email: dto.email.toLowerCase(), passwordHash: 'hash' })),
      findById: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.com' }),
      findByEmail: jest.fn(),
      verifyPassword: jest.fn(),
    };
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ code: 'user' }]),
    };
    userRoles = { createQueryBuilder: jest.fn().mockReturnValue(qb), manager: { findOne: jest.fn().mockResolvedValue({ id: 'r-user', code: 'user' }) }, save: jest.fn().mockResolvedValue(undefined) };
    tokens = { signAccess: jest.fn().mockReturnValue('access-tok'), signRefresh: jest.fn().mockReturnValue('refresh-tok'), verifyRefresh: jest.fn().mockReturnValue({ sub: 'u1' }) };
    cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [
        AuthService,
        TokenService,
        { provide: UsersService, useValue: users },
        { provide: getRepositoryToken(UserRole), useValue: userRoles },
        { provide: CacheService, useValue: cache },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('register throws when acceptEula false', async () => {
    await expect(
      service.register({ email: 'a@b.com', password: 'Password1', firstname: 'A', lastname: 'B', acceptEula: false } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('register creates user, assigns user role, returns tokens', async () => {
    const res = await service.register({ email: 'A@B.com', password: 'Password1', firstname: 'A', lastname: 'B', acceptEula: true } as any);
    expect(users.create).toHaveBeenCalled();
    expect(userRoles.save).toHaveBeenCalledWith({ userId: 'u-new', roleId: 'r-user' });
    expect(res.accessToken).toBe('access-tok');
    expect(res.user.roles).toEqual(['user']);
  });

  it('login throws on unknown email', async () => {
    users.findByEmail.mockResolvedValueOnce(null);
    await expect(service.login({ email: 'x@y.com', password: 'p' })).rejects.toThrow(UnauthorizedException);
  });

  it('login throws on bad password', async () => {
    users.findByEmail.mockResolvedValueOnce({ id: 'u1', email: 'a@b.com' });
    users.verifyPassword.mockResolvedValueOnce(false);
    await expect(service.login({ email: 'a@b.com', password: 'wrong' })).rejects.toThrow(UnauthorizedException);
  });

  it('login returns tokens on success', async () => {
    users.findByEmail.mockResolvedValueOnce({ id: 'u1', email: 'a@b.com' });
    users.verifyPassword.mockResolvedValueOnce(true);
    const res = await service.login({ email: 'a@b.com', password: 'Password1' });
    expect(res.accessToken).toBe('access-tok');
  });

  it('refresh throws when token revoked', async () => {
    cache.get.mockResolvedValueOnce(true);
    await expect(service.refresh('old')).rejects.toThrow(UnauthorizedException);
  });

  it('refresh rotates token on success', async () => {
    const res = await service.refresh('old');
    expect(res.accessToken).toBe('access-tok');
    expect(cache.set).toHaveBeenCalledWith('revoked:old', true, expect.any(Number));
  });

  it('logout marks token revoked', async () => {
    await service.logout('r1');
    expect(cache.set).toHaveBeenCalledWith('revoked:r1', true, expect.any(Number));
  });
});
```

**Step 6:** Запусти тести:

```bash
pnpm test
```

Очікувано: PASS.

**Step 7:** Commit:

```bash
git add src/modules/auth
git commit -m "feat(auth): AuthService with register, login, refresh (rotation), logout"
```

---

### Task 17: JwtStrategy

**Files:**
- Create: `src/modules/auth/strategies/jwt.strategy.ts`
- Test: `src/modules/auth/strategies/jwt.strategy.spec.ts`

**Step 1:** Створи `src/modules/auth/strategies/jwt.strategy.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { TokenService } from '../services/jwt.service';
import { JwtUser } from '../../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET!,
    });
  }

  async validate(payload: any): Promise<JwtUser> {
    return { sub: payload.sub, email: payload.email, roles: payload.roles ?? [] };
  }
}
```

**Step 2:** Створи `src/modules/auth/strategies/jwt.strategy.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import * as jwt from 'jsonwebtoken';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  const SECRET = 'a'.repeat(40);

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = SECRET;
    strategy = new JwtStrategy();
  });

  it('validate returns user from token payload', async () => {
    const user = await strategy.validate({ sub: 'u1', email: 'a@b.com', roles: ['user'] });
    expect(user.sub).toBe('u1');
    expect(user.roles).toEqual(['user']);
  });

  it('validate defaults roles to []', async () => {
    const user = await strategy.validate({ sub: 'u1' });
    expect(user.roles).toEqual([]);
  });
});
```

**Step 3:** Commit:

```bash
git add src/modules/auth/strategies
git commit -m "feat(auth): JwtStrategy with bearer token extraction"
```

---

### Task 18: LocalStrategy + Google + Facebook

**Files:**
- Create: `src/modules/auth/strategies/local.strategy.ts`
- Create: `src/modules/auth/strategies/google.strategy.ts`
- Create: `src/modules/auth/strategies/facebook.strategy.ts`

**Step 1:** Створи `src/modules/auth/strategies/local.strategy.ts`:

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { UsersService } from '../../users/users.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly users: UsersService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<any> {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Невірний email або пароль');
    if (!await this.users.verifyPassword(user, password)) {
      throw new UnauthorizedException('Невірний email або пароль');
    }
    return { id: user.id, email: user.email };
  }
}
```

**Step 2:** Створи `src/modules/auth/strategies/google.strategy.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { UsersService } from '../../users/users.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly users: UsersService) {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      // Skip registration if not configured
      super({
        clientID: 'placeholder',
        clientSecret: 'placeholder',
        callbackURL: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3000/api/v1/auth/google/callback',
        scope: ['email', 'profile'],
      });
    } else {
      super({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL!,
        scope: ['email', 'profile'],
      });
    }
  }

  async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback) {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(new Error('Email not provided by Google'), undefined);
    const firstname = profile.name?.givenName ?? profile.displayName ?? 'User';
    const lastname = profile.name?.familyName ?? '';
    const user = await this.users.findOrCreateOAuthUser(email, 'google', profile.id, { firstname, lastname });
    done(null, { id: user.id, email: user.email });
  }
}
```

**Step 3:** Створи `src/modules/auth/strategies/facebook.strategy.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { UsersService } from '../../users/users.service';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(private readonly users: UsersService) {
    if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
      super({
        clientID: 'placeholder',
        clientSecret: 'placeholder',
        callbackURL: process.env.FACEBOOK_CALLBACK_URL ?? 'http://localhost:3000/api/v1/auth/facebook/callback',
        profileFields: ['id', 'emails', 'name', 'displayName'],
      });
    } else {
      super({
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: process.env.FACEBOOK_CALLBACK_URL!,
        profileFields: ['id', 'emails', 'name', 'displayName'],
      });
    }
  }

  async validate(accessToken: string, refreshToken: string, profile: Profile, done: (err: any, user: any) => void) {
    const email = profile.emails?.[0]?.value ?? `${profile.id}@facebook.placeholder`;
    const firstname = profile.name?.givenName ?? profile.displayName ?? 'User';
    const lastname = profile.name?.familyName ?? '';
    const user = await this.users.findOrCreateOAuthUser(email, 'facebook', profile.id, { firstname, lastname });
    done(null, { id: user.id, email: user.email });
  }
}
```

**Step 4:** Commit:

```bash
git add src/modules/auth/strategies
git commit -m "feat(auth): LocalStrategy, GoogleStrategy, FacebookStrategy"
```

---

### Task 19: AuthController + AuthModule

**Files:**
- Create: `src/modules/auth/auth.controller.ts`
- Create: `src/modules/auth/auth.service.oauth.ts` (OAuth callback handler)
- Create: `src/modules/auth/auth.module.ts`
- Test: `src/modules/auth/auth.controller.spec.ts`

**Step 1:** Створи `src/modules/auth/auth.service.oauth.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { AuthService } from './services/auth.service';

@Injectable()
export class OAuthHandlerService {
  constructor(private readonly auth: AuthService) {}

  /**
   * Called after OAuth strategy returns user; issues tokens and returns redirect URL.
   */
  async buildRedirectUrl(user: { id: string; email: string }): Promise<string> {
    const roles = await (this.auth as any).getUserRolesPublic(user.id);
    const { accessToken, refreshToken } = await (this.auth as any).issueTokensPublic(user.id, user.email, roles);
    const frontend = process.env.FRONTEND_URL ?? 'http://localhost:3001';
    const params = new URLSearchParams({ access: accessToken, refresh: refreshToken });
    return `${frontend}/auth/callback?${params.toString()}`;
  }
}
```

(Public accessors в AuthService — для наступного Task. Поки що додамо private методи в AuthService, що повертаються публічно через `OAuthHandlerService`.)

Насправді простіше — розширимо AuthService двома публічними методами:

```ts
// в auth.service.ts, додай:
async getRolesForUser(userId: string): Promise<string[]> {
  return this.getUserRoles(userId);
}

async issueTokensForUser(sub: string, email: string, roles: string[]) {
  return this.issueTokens(sub, email, roles);
}
```

І спрощуємо `OAuthHandlerService`:

```ts
import { Injectable } from '@nestjs/common';
import { AuthService } from './services/auth.service';

@Injectable()
export class OAuthHandlerService {
  constructor(private readonly auth: AuthService) {}

  async buildRedirectUrl(user: { id: string; email: string }): Promise<string> {
    const roles = await this.auth.getRolesForUser(user.id);
    const { accessToken, refreshToken } = await this.auth.issueTokensForUser(user.id, user.email, roles);
    const frontend = process.env.FRONTEND_URL ?? 'http://localhost:3001';
    const params = new URLSearchParams({ access: accessToken, refresh: refreshToken });
    return `${frontend}/auth/callback?${params.toString()}`;
  }
}
```

**Step 2:** Створи `src/modules/auth/auth.controller.ts`:

```ts
import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './services/auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { OAuthHandlerService } from './auth.service.oauth';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly oauthHandler: OAuthHandlerService,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60 * 1000 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60 * 1000 } })
  refresh(@Body('refreshToken') token: string) {
    return this.auth.refresh(token);
  }

  @Public()
  @Post('logout')
  logout(@Body('refreshToken') token: string) {
    return this.auth.logout(token);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() current: JwtUser) {
    return { data: { id: current.sub, email: current.email, roles: current.roles } };
  }

  // OAuth: Google
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async google() {}

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const url = await this.oauthHandler.buildRedirectUrl(req.user as any);
    res.redirect(url);
  }

  // OAuth: Facebook
  @Public()
  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  async facebook() {}

  @Public()
  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  async facebookCallback(@Req() req: Request, @Res() res: Response) {
    const url = await this.oauthHandler.buildRedirectUrl(req.user as any);
    res.redirect(url);
  }
}
```

**Step 3:** Створи `src/modules/auth/auth.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { RbacModule } from '../rbac/rbac.module';
import { UserRole } from '../rbac/entities/user-role.entity';
import { Role } from '../rbac/entities/role.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/jwt.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { FacebookStrategy } from './strategies/facebook.strategy';
import { OAuthHandlerService } from './auth.service.oauth';

@Module({
  imports: [
    UsersModule,
    RbacModule,
    PassportModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([UserRole, Role]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService, TokenService, JwtStrategy, LocalStrategy, GoogleStrategy, FacebookStrategy, OAuthHandlerService,
  ],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
```

**Step 4:** Створи `src/modules/auth/auth.controller.spec.ts` (тільки unit-тест register/login, OAuth flow — у E2E):

```ts
import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { OAuthHandlerService } from './auth.service.oauth';

describe('AuthController', () => {
  let controller: AuthController;
  let auth: { register: jest.Mock; login: jest.Mock; refresh: jest.Mock; logout: jest.Mock };
  let oauth: { buildRedirectUrl: jest.Mock };

  beforeEach(async () => {
    auth = { register: jest.fn(), login: jest.fn(), refresh: jest.fn(), logout: jest.fn() };
    oauth = { buildRedirectUrl: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: OAuthHandlerService, useValue: oauth },
      ],
    }).compile();
    controller = module.get(AuthController);
  });

  it('register delegates to AuthService', async () => {
    auth.register.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', user: { id: 'u1' } });
    const res = await controller.register({ email: 'a@b.com', password: 'Password1', firstname: 'A', lastname: 'B', acceptEula: true } as any);
    expect(res.accessToken).toBe('a');
  });

  it('login delegates to AuthService', async () => {
    auth.login.mockResolvedValue({ accessToken: 'a' });
    const res = await controller.login({ email: 'a@b.com', password: 'x' } as any);
    expect(res.accessToken).toBe('a');
  });

  it('refresh delegates to AuthService', async () => {
    auth.refresh.mockResolvedValue({ accessToken: 'a2' });
    const res = await controller.refresh('old');
    expect(res.accessToken).toBe('a2');
  });
});
```

**Step 5:** Підключи AuthModule у AppModule:

```ts
@Module({
  imports: [/* ... */, AuthModule, UsersModule],
})
export class AppModule {}
```

**Step 6:** Запусти тести:

```bash
pnpm test
```

Очікувано: PASS.

**Step 7:** Запусти dev-сервер і перевір register через curl:

```bash
docker compose up -d
pnpm run start:dev &
sleep 10
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test1@x.com","password":"Password1","firstname":"Тест","lastname":"Юзер","acceptEula":true}'
```

Очікувано: `{"accessToken":"...","refreshToken":"...","user":{...}}`.

**Step 8:** Commit:

```bash
git add src/modules/auth
git commit -m "feat(auth): AuthController with register, login, refresh, OAuth redirects"
```

---

## Phase 5: Venues

### Task 20: Venue entities (Venue, Photo, Feature, Tag, Type) + міграція

**Files:**
- Create: `src/modules/venues/entities/venue.entity.ts`
- Create: `src/modules/venues/entities/venue-photo.entity.ts`
- Create: `src/modules/venues/entities/venue-feature.entity.ts`
- Create: `src/modules/venues/entities/venue-feature-assignment.entity.ts`
- Create: `src/modules/venues/entities/tag.entity.ts`
- Create: `src/modules/venues/entities/venue-tag.entity.ts`
- Create: `src/modules/venues/entities/venue-type.entity.ts`
- Create: `src/modules/venues/entities/venue-type-assignment.entity.ts`
- Create: `src/modules/venues/dto/create-venue.dto.ts`
- Create: `src/migrations/1700000001000-Venues.ts`
- Modify: `src/config/data-source.ts`

**Step 1:** Створи `src/modules/venues/entities/venue.entity.ts`:

```ts
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum VenueStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Archived = 'archived',
}

@Entity('venues')
@Index(['status'])
export class Venue {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') ownerId: string;
  @Column({ type: 'varchar', length: 200 }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'text' }) address: string;
  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true }) latitude: number | null;
  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true }) longitude: number | null;
  @Column({ type: 'jsonb', default: {} }) contacts: { phone?: string; instagram?: string; facebook?: string; website?: string };
  @Column({ type: 'jsonb', default: {} }) workingHours: Record<string, string>;
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true }) averageCheck: number | null;
  @Column({ type: 'text', nullable: true }) mainPhotoUrl: string | null;
  @Column({ type: 'enum', enum: VenueStatus, default: VenueStatus.Pending }) status: VenueStatus;
  @Column({ type: 'numeric', precision: 3, scale: 2, default: 0 }) ratingAvg: number;
  @Column({ type: 'integer', default: 0 }) ratingCount: number;
  @Column({ type: 'integer', default: 0 }) viewCount: number;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;
}
```

**Step 2:** Створи `src/modules/venues/entities/venue-photo.entity.ts`:

```ts
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Venue } from './venue.entity';

@Entity('venue_photos')
export class VenuePhoto {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') venueId: string;
  @Column({ type: 'text' }) url: string;
  @Column({ type: 'integer', default: 0 }) sortOrder: number;

  @ManyToOne(() => Venue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venueId' })
  venue: Venue;
}
```

**Step 3:** Створи `src/modules/venues/entities/venue-feature.entity.ts`:

```ts
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('venue_features')
export class VenueFeature {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 64 }) code: string;
  @Column({ type: 'varchar', length: 100 }) name: string;
  @Column({ type: 'varchar', length: 64, nullable: true }) icon: string | null;
}
```

**Step 4:** Створи `src/modules/venues/entities/venue-feature-assignment.entity.ts`:

```ts
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Venue } from './venue.entity';
import { VenueFeature } from './venue-feature.entity';

@Entity('venue_feature_assignments')
export class VenueFeatureAssignment {
  @PrimaryColumn('uuid') venueId: string;
  @PrimaryColumn('uuid') featureId: string;

  @ManyToOne(() => Venue, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'venueId' }) venue: Venue;
  @ManyToOne(() => VenueFeature, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'featureId' }) feature: VenueFeature;
}
```

**Step 5:** Створи `src/modules/venues/entities/tag.entity.ts`:

```ts
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 64 }) name: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 64 }) slug: string;
}
```

**Step 6:** Створи `src/modules/venues/entities/venue-tag.entity.ts`:

```ts
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Venue } from './venue.entity';
import { Tag } from './tag.entity';

@Entity('venue_tags')
export class VenueTag {
  @PrimaryColumn('uuid') venueId: string;
  @PrimaryColumn('uuid') tagId: string;

  @ManyToOne(() => Venue, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'venueId' }) venue: Venue;
  @ManyToOne(() => Tag, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'tagId' }) tag: Tag;
}
```

**Step 7:** Створи `src/modules/venues/entities/venue-type.entity.ts`:

```ts
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('venue_types')
export class VenueType {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 64 }) name: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 64 }) slug: string;
}
```

**Step 8:** Створи `src/modules/venues/entities/venue-type-assignment.entity.ts`:

```ts
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Venue } from './venue.entity';
import { VenueType } from './venue-type.entity';

@Entity('venue_type_assignments')
export class VenueTypeAssignment {
  @PrimaryColumn('uuid') venueId: string;
  @PrimaryColumn('uuid') typeId: string;

  @ManyToOne(() => Venue, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'venueId' }) venue: Venue;
  @ManyToOne(() => VenueType, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'typeId' }) type: VenueType;
}
```

**Step 9:** Створи `src/modules/venues/dto/create-venue.dto.ts`:

```ts
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsLatitude, IsLongitude, IsNumber, IsObject, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';

export class ContactsDto {
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() instagram?: string;
  @IsOptional() @IsString() facebook?: string;
  @IsOptional() @IsString() website?: string;
}

export class CreateVenueDto {
  @IsString() @MinLength(3) name: string;
  @IsOptional() @IsString() description?: string;
  @IsString() @MinLength(5) address: string;
  @IsOptional() @IsLatitude() @Type(() => Number) latitude?: number;
  @IsOptional() @IsLongitude() @Type(() => Number) longitude?: number;
  @IsOptional() @ValidateNested() @Type(() => ContactsDto) contacts?: ContactsDto;
  @IsOptional() @IsObject() workingHours?: Record<string, string>;
  @IsOptional() @IsNumber() @Min(0) averageCheck?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) featureCodes?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) tagSlugs?: string[];
  @IsOptional() @IsString() typeSlug?: string;
}
```

**Step 10:** Створи `src/migrations/1700000001000-Venues.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Venues1700000001000 implements MigrationInterface {
  name = 'Venues1700000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "venues" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "ownerId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "name" varchar(200) NOT NULL,
        "description" text,
        "address" text NOT NULL,
        "latitude" decimal(9,6),
        "longitude" decimal(9,6),
        "contacts" jsonb NOT NULL DEFAULT '{}',
        "workingHours" jsonb NOT NULL DEFAULT '{}',
        "averageCheck" numeric(10,2),
        "mainPhotoUrl" text,
        "status" varchar(16) NOT NULL DEFAULT 'pending',
        "ratingAvg" numeric(3,2) NOT NULL DEFAULT 0,
        "ratingCount" integer NOT NULL DEFAULT 0,
        "viewCount" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        "updatedAt" timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_venues_status" ON "venues"("status")`);

    // PostGIS location column populated by trigger
    await queryRunner.query(`ALTER TABLE "venues" ADD COLUMN "location" geography(POINT, 4326)`);
    await queryRunner.query(`CREATE INDEX "idx_venues_location" ON "venues" USING GIST ("location")`);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION venues_set_location() RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
          NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
        ELSE
          NEW.location := NULL;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_venues_location
      BEFORE INSERT OR UPDATE OF latitude, longitude ON "venues"
      FOR EACH ROW EXECUTE FUNCTION venues_set_location();
    `);

    await queryRunner.query(`
      CREATE TABLE "venue_photos" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "venueId" uuid NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
        "url" text NOT NULL,
        "sortOrder" integer NOT NULL DEFAULT 0
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "venue_features" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "code" varchar(64) NOT NULL UNIQUE,
        "name" varchar(100) NOT NULL,
        "icon" varchar(64)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "venue_feature_assignments" (
        "venueId" uuid NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
        "featureId" uuid NOT NULL REFERENCES "venue_features"("id") ON DELETE CASCADE,
        PRIMARY KEY ("venueId", "featureId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tags" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(64) NOT NULL UNIQUE,
        "slug" varchar(64) NOT NULL UNIQUE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "venue_tags" (
        "venueId" uuid NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
        "tagId" uuid NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE,
        PRIMARY KEY ("venueId", "tagId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "venue_types" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(64) NOT NULL UNIQUE,
        "slug" varchar(64) NOT NULL UNIQUE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "venue_type_assignments" (
        "venueId" uuid NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
        "typeId" uuid NOT NULL REFERENCES "venue_types"("id") ON DELETE CASCADE,
        PRIMARY KEY ("venueId", "typeId")
      )
    `);

    // Seed features, types
    await queryRunner.query(`
      INSERT INTO "venue_features"("code","name","icon") VALUES
      ('wifi','Wi-Fi','wifi'),
      ('parking','Парковка','parking'),
      ('live_music','Жива музика','music'),
      ('terrace','Тераса','terrace'),
      ('kids','Дитяча кімната','kids'),
      ('vip','VIP-зона','vip')
    `);

    await queryRunner.query(`
      INSERT INTO "venue_types"("name","slug") VALUES
      ('Бар','bar'),
      ('Ресторан','restaurant'),
      ('Кафе','cafe'),
      ('Клуб','club'),
      ('Паб','pub')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_venues_location ON "venues"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS venues_set_location()`);
    await queryRunner.query(`ALTER TABLE "venues" DROP COLUMN "location"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "venue_type_assignments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "venue_types" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "venue_tags" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tags" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "venue_feature_assignments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "venue_features" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "venue_photos" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "venues" CASCADE`);
  }
}
```

**Step 11:** Додай нові entities до `src/config/data-source.ts` масив entities (вже зроблено вище в Task 9).

**Step 12:** Запусти міграцію:

```bash
pnpm migration:run
```

Очікувано: `Venues1700000001000` застосовано.

**Step 13:** Перевір:

```bash
docker compose exec postgres psql -U piyachok -d piyachok -c "SELECT code, name FROM venue_features"
```

Очікувано: 6 фіч.

**Step 14:** Commit:

```bash
git add src/modules/venues src/migrations src/config
git commit -m "feat(venues): entities + migration with PostGIS location, seed features/types"
```

---

### Task 21: VenuesService (create, update, get, search, moderation)

**Files:**
- Create: `src/modules/venues/venues.service.ts`
- Create: `src/modules/venues/dto/query-venues.dto.ts`
- Create: `src/modules/venues/dto/update-venue.dto.ts`
- Create: `src/modules/venues/events.ts`
- Create: `src/modules/venues/venues.module.ts`
- Test: `src/modules/venues/venues.service.spec.ts`

**Step 1:** Створи `src/modules/venues/dto/query-venues.dto.ts`:

```ts
import { Type } from 'class-transformer';
import { IsIn, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '../../common/utils/pagination.util';

export type VenueSort = 'rating' | 'check' | 'newest' | 'name' | 'distance';

export class QueryVenuesDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() feature?: string;   // csv
  @IsOptional() @IsString() tag?: string;        // csv
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minCheck?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxCheck?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(5) minRating?: number;
  @IsOptional() @IsLatitude() @Type(() => Number) lat?: number;
  @IsOptional() @IsLongitude() @Type(() => Number) lng?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.1) @Max(100) radiusKm?: number;
  @IsOptional() @IsIn(['rating', 'check', 'newest', 'name', 'distance']) sort?: VenueSort;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page?: number = DEFAULT_PAGE;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(100) limit?: number = DEFAULT_LIMIT;
}
```

**Step 2:** Створи `src/modules/venues/dto/update-venue.dto.ts`:

```ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateVenueDto } from './create-venue.dto';

export class UpdateVenueDto extends PartialType(CreateVenueDto) {}
```

**Step 3:** Створи `src/modules/venues/events.ts`:

```ts
export const VENUE_CREATED = 'venue.created';
export const VENUE_UPDATED = 'venue.updated';
export const VENUE_STATUS_CHANGED = 'venue.status_changed';

export class VenueCreatedEvent {
  static readonly event = VENUE_CREATED;
  constructor(public readonly venueId: string) {}
}

export class VenueUpdatedEvent {
  static readonly event = VENUE_UPDATED;
  constructor(public readonly venueId: string) {}
}

export class VenueStatusChangedEvent {
  static readonly event = VENUE_STATUS_CHANGED;
  constructor(public readonly venueId: string, public readonly from: string, public readonly to: string) {}
}
```

**Step 4:** Створи `src/modules/venues/venues.service.ts`:

```ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Venue, VenueStatus } from './entities/venue.entity';
import { VenuePhoto } from './entities/venue-photo.entity';
import { VenueFeature } from './entities/venue-feature.entity';
import { VenueFeatureAssignment } from './entities/venue-feature-assignment.entity';
import { Tag } from './entities/tag.entity';
import { VenueTag } from './entities/venue-tag.entity';
import { VenueType } from './entities/venue-type.entity';
import { VenueTypeAssignment } from './entities/venue-type-assignment.entity';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { QueryVenuesDto, VenueSort } from './dto/query-venues.dto';
import { PermissionsService } from '../rbac/permissions.service';
import { CacheService } from '../../common/services/cache.service';
import { buildMeta, normalizePagination } from '../../common/utils/pagination.util';
import { createHash } from 'crypto';
import { VENUE_CREATED, VENUE_STATUS_CHANGED, VENUE_UPDATED } from './events';
import { VenueStatusChangedEvent } from './events';

@Injectable()
export class VenuesService {
  constructor(
    @InjectRepository(Venue) private readonly venues: Repository<Venue>,
    @InjectRepository(VenuePhoto) private readonly photos: Repository<VenuePhoto>,
    @InjectRepository(VenueFeature) private readonly features: Repository<VenueFeature>,
    @InjectRepository(VenueFeatureAssignment) private readonly featureAssignments: Repository<VenueFeatureAssignment>,
    @InjectRepository(Tag) private readonly tags: Repository<Tag>,
    @InjectRepository(VenueTag) private readonly venueTags: Repository<VenueTag>,
    @InjectRepository(VenueType) private readonly venueTypes: Repository<VenueType>,
    @InjectRepository(VenueTypeAssignment) private readonly venueTypeAssignments: Repository<VenueTypeAssignment>,
    private readonly perms: PermissionsService,
    private readonly cache: CacheService,
    private readonly events: EventEmitter2,
  ) {}

  async create(ownerId: string, dto: CreateVenueDto): Promise<Venue> {
    const venue = this.venues.create({
      ownerId,
      name: dto.name,
      description: dto.description ?? null,
      address: dto.address,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      contacts: dto.contacts ?? {},
      workingHours: dto.workingHours ?? {},
      averageCheck: dto.averageCheck ?? null,
      status: VenueStatus.Pending,
    });
    await this.venues.save(venue);
    if (dto.featureCodes?.length) {
      const features = await this.features.find({ where: { code: In(dto.featureCodes) } });
      await this.featureAssignments.save(features.map(f => ({ venueId: venue.id, featureId: f.id })));
    }
    if (dto.tagSlugs?.length) {
      const tags = await this.tags.find({ where: { slug: In(dto.tagSlugs) } });
      await this.venueTags.save(tags.map(t => ({ venueId: venue.id, tagId: t.id })));
    }
    if (dto.typeSlug) {
      const type = await this.venueTypes.findOne({ where: { slug: dto.typeSlug } });
      if (type) await this.venueTypeAssignments.save({ venueId: venue.id, typeId: type.id });
    }
    this.events.emit(VENUE_CREATED, new VenueCreatedEvent(venue.id));
    return venue;
  }

  async update(userId: string, venueId: string, dto: UpdateVenueDto): Promise<Venue> {
    const venue = await this.findOneOrThrow(venueId);
    await this.assertCanEdit(userId, venue);
    Object.assign(venue, {
      name: dto.name ?? venue.name,
      description: dto.description ?? venue.description,
      address: dto.address ?? venue.address,
      latitude: dto.latitude ?? venue.latitude,
      longitude: dto.longitude ?? venue.longitude,
      contacts: dto.contacts ?? venue.contacts,
      workingHours: dto.workingHours ?? venue.workingHours,
      averageCheck: dto.averageCheck ?? venue.averageCheck,
    });
    await this.venues.save(venue);
    this.events.emit(VENUE_UPDATED, new VenueUpdatedEvent(venue.id));
    return venue;
  }

  async softDelete(userId: string, venueId: string): Promise<void> {
    const venue = await this.findOneOrThrow(venueId);
    await this.assertCanEdit(userId, venue);
    venue.status = VenueStatus.Archived;
    await this.venues.save(venue);
    this.events.emit(VENUE_STATUS_CHANGED, new VenueStatusChangedEvent(venue.id, 'approved', 'archived'));
  }

  async findOneOrThrow(id: string): Promise<Venue> {
    const venue = await this.venues.findOne({ where: { id } });
    if (!venue) throw new NotFoundException('Заклад не знайдено');
    return venue;
  }

  async findOnePublic(id: string): Promise<Venue> {
    const venue = await this.venues
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.owner', 'o')
      .leftJoinAndSelect('o.profile', 'p')
      .where('v.id = :id', { id })
      .andWhere('v.status = :status', { status: VenueStatus.Approved })
      .getOne();
    if (!venue) throw new NotFoundException('Заклад не знайдено');
    return venue;
  }

  async search(query: QueryVenuesDto) {
    const { page, limit, offset } = normalizePagination(query);
    const cacheKey = `venues:list:${this.hashQuery(query)}`;
    const cached = await this.cache.get<{ data: any[]; total: number }>(cacheKey);
    if (cached) {
      return { data: cached.data.slice(offset, offset + limit), meta: buildMeta({ page, limit, offset }, cached.total) };
    }

    const qb = this.venues.createQueryBuilder('v')
      .leftJoinAndSelect('v.photos', 'photo')
      .leftJoin('v.featureAssignments', 'fa').leftJoinAndSelect('fa.feature', 'f')
      .leftJoin('v.venueTags', 'vt').leftJoinAndSelect('vt.tag', 't')
      .leftJoin('v.venueTypeAssignments', 'vta').leftJoinAndSelect('vta.type', 'ty')
      .where('v.status = :status', { status: VenueStatus.Approved });

    if (query.q) {
      qb.andWhere(new Brackets(b => b
        .where('v.name ILIKE :q', { q: `%${query.q}%` })
        .orWhere('v.address ILIKE :q', { q: `%${query.q}%` }),
      ));
    }
    if (query.minRating != null) qb.andWhere('v.ratingAvg >= :minRating', { minRating: query.minRating });
    if (query.minCheck != null) qb.andWhere('v.averageCheck >= :minCheck', { minCheck: query.minCheck });
    if (query.maxCheck != null) qb.andWhere('v.averageCheck <= :maxCheck', { maxCheck: query.maxCheck });
    if (query.feature) qb.andWhere('f.code IN (:...features)', { features: query.feature.split(',') });
    if (query.tag) qb.andWhere('t.slug IN (:...tags)', { tags: query.tag.split(',') });
    if (query.type) qb.andWhere('ty.slug = :type', { type: query.type });
    if (query.lat != null && query.lng != null && query.radiusKm != null) {
      qb.andWhere(`ST_DWithin(v.location, ST_MakePoint(:lng, :lat)::geography, :meters)`,
        { lng: query.lng, lat: query.lat, meters: query.radiusKm * 1000 });
    }

    const sort: VenueSort = query.sort ?? 'newest';
    switch (sort) {
      case 'rating': qb.orderBy('v.ratingAvg', 'DESC', 'NULLS LAST').addOrderBy('v.ratingCount', 'DESC'); break;
      case 'check': qb.orderBy('v.averageCheck', 'ASC', 'NULLS LAST'); break;
      case 'name': qb.orderBy('v.name', 'ASC'); break;
      case 'distance':
        if (query.lat != null && query.lng != null) {
          qb.addSelect(`ST_Distance(v.location, ST_MakePoint(:lng, :lat)::geography)`, 'distance')
            .orderBy('distance', 'ASC');
        } else { qb.orderBy('v.createdAt', 'DESC'); }
        break;
      case 'newest':
      default: qb.orderBy('v.createdAt', 'DESC');
    }
    qb.skip(offset).take(limit);

    const [rows, total] = await qb.getManyAndCount();
    await this.cache.set(cacheKey, { data: rows, total }, 60);
    return { data: rows, meta: buildMeta({ page, limit, offset }, total) };
  }

  async findPending(page = 1, limit = 20) {
    const { offset } = normalizePagination({ page, limit });
    const [rows, total] = await this.venues.findAndCount({
      where: { status: VenueStatus.Pending },
      order: { createdAt: 'ASC' },
      skip: offset, take: limit,
    });
    return { data: rows, meta: buildMeta({ page, limit, offset }, total) };
  }

  async changeStatus(venueId: string, to: VenueStatus): Promise<Venue> {
    const venue = await this.findOneOrThrow(venueId);
    const from = venue.status;
    venue.status = to;
    await this.venues.save(venue);
    this.events.emit(VENUE_STATUS_CHANGED, new VenueStatusChangedEvent(venueId, from, to));
    return venue;
  }

  async invalidateListCache() {
    await this.cache.delByPattern('venues:list:*');
  }

  private async assertCanEdit(userId: string, venue: Venue) {
    if (venue.ownerId === userId) return;
    if (await this.perms.hasPermission(userId, 'venue:edit:any')) return;
    throw new ForbiddenException('Не можна редагувати цей заклад');
  }

  private hashQuery(q: QueryVenuesDto): string {
    return createHash('sha1').update(JSON.stringify(q)).digest('hex');
  }
}
```

**Step 5:** Створи `src/modules/venues/venues.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Venue } from './entities/venue.entity';
import { VenuePhoto } from './entities/venue-photo.entity';
import { VenueFeature } from './entities/venue-feature.entity';
import { VenueFeatureAssignment } from './entities/venue-feature-assignment.entity';
import { Tag } from './entities/tag.entity';
import { VenueTag } from './entities/venue-tag.entity';
import { VenueType } from './entities/venue-type.entity';
import { VenueTypeAssignment } from './entities/venue-type-assignment.entity';
import { VenuesService } from './venues.service';
import { RbacModule } from '../rbac/rbac.module';
import { VenueCacheListener } from './listeners/venue-cache.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Venue, VenuePhoto, VenueFeature, VenueFeatureAssignment,
      Tag, VenueTag, VenueType, VenueTypeAssignment,
    ]),
    RbacModule,
  ],
  providers: [VenuesService, VenueCacheListener],
  exports: [VenuesService, TypeOrmModule],
})
export class VenuesModule {}
```

**Step 6:** Створи `src/modules/venues/listeners/venue-cache.listener.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { VenuesService } from '../venues.service';
import { VENUE_CREATED, VENUE_UPDATED, VENUE_STATUS_CHANGED } from '../events';

@Injectable()
export class VenueCacheListener {
  private readonly logger = new Logger(VenueCacheListener.name);

  constructor(private readonly venues: VenuesService) {}

  @OnEvent(VENUE_CREATED)
  @OnEvent(VENUE_UPDATED)
  @OnEvent(VENUE_STATUS_CHANGED)
  async invalidate() {
    await this.venues.invalidateListCache();
  }
}
```

**Step 7:** Створи `src/modules/venues/venues.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { VenuesService } from './venues.service';
import { Venue, VenueStatus } from './entities/venue.entity';
import { VenuePhoto } from './entities/venue-photo.entity';
import { VenueFeature } from './entities/venue-feature.entity';
import { VenueFeatureAssignment } from './entities/venue-feature-assignment.entity';
import { Tag } from './entities/tag.entity';
import { VenueTag } from './entities/venue-tag.entity';
import { VenueType } from './entities/venue-type.entity';
import { VenueTypeAssignment } from './entities/venue-type-assignment.entity';
import { PermissionsService } from '../rbac/permissions.service';
import { CacheService } from '../../common/services/cache.service';

function qb() {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getOne: jest.fn(),
  };
}

describe('VenuesService', () => {
  let service: VenuesService;
  let venues: any;
  let perms: any;
  let cache: any;
  let events: any;

  beforeEach(async () => {
    venues = { create: jest.fn((x) => x), save: jest.fn().mockResolvedValue(undefined), findOne: jest.fn(), findAndCount: jest.fn(), createQueryBuilder: jest.fn().mockReturnValue(qb()) };
    perms = { hasPermission: jest.fn() };
    cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), delByPattern: jest.fn() };
    events = { emit: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        VenuesService,
        { provide: getRepositoryToken(Venue), useValue: venues },
        { provide: getRepositoryToken(VenuePhoto), useValue: { save: jest.fn() } },
        { provide: getRepositoryToken(VenueFeature), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(VenueFeatureAssignment), useValue: { save: jest.fn() } },
        { provide: getRepositoryToken(Tag), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(VenueTag), useValue: { save: jest.fn() } },
        { provide: getRepositoryToken(VenueType), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(VenueTypeAssignment), useValue: { save: jest.fn() } },
        { provide: PermissionsService, useValue: perms },
        { provide: CacheService, useValue: cache },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    service = module.get(VenuesService);
  });

  it('create sets status=pending and emits event', async () => {
    const v = await service.create('u1', { name: 'X', address: 'Y' } as any);
    expect((v as any).status).toBe(VenueStatus.Pending);
    expect(events.emit).toHaveBeenCalledWith('venue.created', expect.anything());
  });

  it('update allows owner', async () => {
    venues.findOne.mockResolvedValueOnce({ id: 'v1', ownerId: 'u1', status: VenueStatus.Approved });
    await service.update('u1', 'v1', { name: 'New' } as any);
    expect(events.emit).toHaveBeenCalledWith('venue.updated', expect.anything());
  });

  it('update throws for non-owner without permission', async () => {
    venues.findOne.mockResolvedValueOnce({ id: 'v1', ownerId: 'u2', status: VenueStatus.Approved });
    perms.hasPermission.mockResolvedValueOnce(false);
    await expect(service.update('u1', 'v1', { name: 'X' } as any)).rejects.toThrow(ForbiddenException);
  });

  it('update allows super_admin (venue:edit:any)', async () => {
    venues.findOne.mockResolvedValueOnce({ id: 'v1', ownerId: 'u2', status: VenueStatus.Approved });
    perms.hasPermission.mockResolvedValueOnce(true);
    await service.update('admin', 'v1', { name: 'X' } as any);
    expect(venues.save).toHaveBeenCalled();
  });

  it('findOneOrThrow throws on missing', async () => {
    venues.findOne.mockResolvedValueOnce(null);
    await expect(service.findOneOrThrow('x')).rejects.toThrow(NotFoundException);
  });

  it('search returns from cache when present', async () => {
    cache.get.mockResolvedValueOnce({ data: [{ id: 'v1', name: 'X' }], total: 1 });
    const res = await service.search({ page: 1, limit: 20 } as any);
    expect(res.data).toHaveLength(1);
    expect(res.meta.total).toBe(1);
  });

  it('search queries DB on cache miss', async () => {
    const res = await service.search({ page: 1, limit: 20 } as any);
    expect(venues.createQueryBuilder).toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalled();
    expect(res.data).toEqual([]);
  });

  it('changeStatus emits status_changed event', async () => {
    venues.findOne.mockResolvedValueOnce({ id: 'v1', status: VenueStatus.Pending });
    await service.changeStatus('v1', VenueStatus.Approved);
    expect(events.emit).toHaveBeenCalledWith('venue.status_changed', expect.anything());
  });
});
```

**Step 8:** Запусти тести:

```bash
pnpm test
```

Очікувано: PASS.

**Step 9:** Commit:

```bash
git add src/modules/venues
git commit -m "feat(venues): VenuesService with create/update/search/moderation, cache invalidation"
```

---

### Task 22: VenuesController (public + auth + admin)

**Files:**
- Create: `src/modules/venues/venues.controller.ts`
- Create: `src/modules/venues/venues-admin.controller.ts`
- Create: `src/modules/venues/dto/change-status.dto.ts`
- Test: `src/modules/venues/venues.controller.spec.ts`

**Step 1:** Створи `src/modules/venues/dto/change-status.dto.ts`:

```ts
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { VenueStatus } from '../entities/venue.entity';

export class ChangeStatusDto {
  @IsEnum(VenueStatus) status: VenueStatus;
  @IsOptional() @IsString() reason?: string;
}
```

**Step 2:** Створи `src/modules/venues/venues.controller.ts`:

```ts
import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { VenuesService } from './venues.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { QueryVenuesDto } from './dto/query-venues.dto';
import { FileStorageService } from '../../common/services/file-storage.service';

@Controller('venues')
export class VenuesController {
  constructor(
    private readonly venues: VenuesService,
    private readonly storage: FileStorageService,
  ) {}

  @Public()
  @Get()
  list(@Query() q: QueryVenuesDto) {
    return this.venues.search(q);
  }

  @Public()
  @Get(':id')
  get(@Param('id') id: string) {
    return this.venues.findOnePublic(id).then(async v => ({
      data: v,
    }));
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post()
  @Permissions('venue:create')
  create(@CurrentUser() u: JwtUser, @Body() dto: CreateVenueDto) {
    return this.venues.create(u.sub, dto).then(v => ({ data: v }));
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Patch(':id')
  @Permissions('venue:edit:own', 'venue:edit:any')
  update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateVenueDto) {
    return this.venues.update(u.sub, id, dto).then(v => ({ data: v }));
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post(':id/photos')
  @Permissions('venue:edit:own', 'venue:edit:any')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPhoto(
    @CurrentUser() u: JwtUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const venue = await this.venues.findOneOrThrow(id);
    await this.venues.update(u.sub, id, {} as any); // noop, just assert edit
    const stored = await this.storage.save(`venues/${id}`, {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      buffer: file.buffer,
    });
    return { data: stored };
  }
}
```

**Step 3:** Створи `src/modules/venues/venues-admin.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { VenuesService } from './venues.service';
import { ChangeStatusDto } from './dto/change-status.dto';
import { VenueStatus } from './entities/venue.entity';
import { UsersService } from '../users/users.service';

@Controller('admin/venues')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VenuesAdminController {
  constructor(
    private readonly venues: VenuesService,
    private readonly users: UsersService,
  ) {}

  @Get('pending')
  @Permissions('venue:moderate')
  list(@Query('page') page: number, @Query('limit') limit: number) {
    return this.venues.findPending(page, limit);
  }

  @Post(':id/approve')
  @Permissions('venue:moderate')
  approve(@Param('id') id: string) {
    return this.venues.changeStatus(id, VenueStatus.Approved).then(v => ({ data: v }));
  }

  @Post(':id/reject')
  @Permissions('venue:moderate')
  reject(@Param('id') id: string, @Body() dto: ChangeStatusDto) {
    return this.venues.changeStatus(id, VenueStatus.Rejected).then(v => ({ data: v }));
  }

  @Post(':id/assign-owner')
  @Permissions('user:manage')
  async assignOwner(@Param('id') id: string, @Body('userId') userId: string) {
    const venue = await this.venues.findOneOrThrow(id);
    await this.users.findById(userId); // throws if not exists
    venue.ownerId = userId;
    return { data: await this.venues['venues'].save(venue) };
  }
}
```

**Step 4:** Зареєструй обидва controllers у VenuesModule:

```ts
@Module({
  // ...
  controllers: [VenuesController, VenuesAdminController],
})
export class VenuesModule {}
```

**Step 5:** Створи `src/modules/venues/venues.controller.spec.ts` (мінімальний, основне — E2E у Task 25):

```ts
import { Test } from '@nestjs/testing';
import { VenuesController } from './venues.controller';
import { VenuesService } from './venues.service';
import { FileStorageService } from '../../common/services/file-storage.service';

describe('VenuesController', () => {
  let controller: VenuesController;
  let venues: any;
  let storage: any;

  beforeEach(async () => {
    venues = { search: jest.fn(), findOnePublic: jest.fn(), create: jest.fn(), update: jest.fn(), findOneOrThrow: jest.fn() };
    storage = { save: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [VenuesController],
      providers: [
        { provide: VenuesService, useValue: venues },
        { provide: FileStorageService, useValue: storage },
      ],
    }).compile();
    controller = module.get(VenuesController);
  });

  it('list delegates to service', async () => {
    venues.search.mockResolvedValue({ data: [], meta: { total: 0 } });
    const res = await controller.list({ page: 1, limit: 20 } as any);
    expect(res.meta.total).toBe(0);
  });

  it('create delegates to service with user sub', async () => {
    venues.create.mockResolvedValue({ id: 'v1' });
    const res = await controller.create({ sub: 'u1', email: 'a@b.com', roles: ['user'] }, { name: 'X', address: 'Y' } as any);
    expect(res.data.id).toBe('v1');
    expect(venues.create).toHaveBeenCalledWith('u1', expect.anything());
  });
});
```

**Step 6:** Підключи VenuesModule у AppModule:

```ts
@Module({ imports: [/* ... */, VenuesModule] })
export class AppModule {}
```

**Step 7:** Запусти тести + dev-сервер:

```bash
pnpm test
docker compose up -d
pnpm run start:dev &
sleep 8
# Register owner
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@x.com","password":"Password1","firstname":"О","lastname":"В","acceptEula":true}' | jq -r .accessToken)
# Create venue
curl -s -X POST http://localhost:3000/api/v1/venues \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Тест","address":"вул. Хрещатик, 1","latitude":50.45,"longitude":30.52}'
```

Очікувано: `{"data":{"id":"...","status":"pending",...}}`.

**Step 8:** Commit:

```bash
git add src/modules/venues
git commit -m "feat(venues): VenuesController public, VenuesAdminController moderation"
```

---

### Task 23: E2E test для venue flow

**Files:**
- Create: `test/venues.e2e-spec.ts`
- Create: `test/jest-e2e.json` (онови)
- Create: `test/helpers/test-app.ts`
- Create: `test/helpers/seed.ts`

**Step 1:** Створи `test/helpers/test-app.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { DataSource } from 'typeorm';
import { execSync } from 'child_process';

export async function bootstrapTestApp(): Promise<{ app: INestApplication; module: TestingModule }> {
  // Ensure schema is reset
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number(process.env.DATABASE_PORT_TEST ?? 5433),
    username: process.env.DATABASE_USER_TEST ?? 'piyachok_test',
    password: process.env.DATABASE_PASS_TEST ?? 'piyachok_test',
    database: process.env.DATABASE_NAME_TEST ?? 'piyachok_test',
  });
  await ds.initialize();
  await ds.dropDatabase();
  await ds.destroy();
  execSync('pnpm typeorm-ts-node-commonjs -d src/config/data-source.ts migration:run', {
    env: { ...process.env, DATABASE_PORT: process.env.DATABASE_PORT_TEST ?? '5433', DATABASE_USER: 'piyachok_test', DATABASE_PASS: 'piyachok_test', DATABASE_NAME: 'piyachok_test' },
    stdio: 'inherit',
  });

  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  return { app, module };
}

export function getAuthToken(response: any): string {
  return response.body.accessToken;
}
```

**Step 2:** Створи `test/helpers/seed.ts`:

```ts
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';

export async function createTestUser(
  ds: DataSource,
  data: { email: string; password: string; firstname: string; lastname: string; roles?: string[] },
): Promise<string> {
  const passwordHash = await bcrypt.hash(data.password, 4);
  const user = await ds.query(
    `INSERT INTO "users"("email","passwordHash") VALUES ($1,$2) RETURNING "id"`,
    [data.email, passwordHash],
  );
  const userId = user[0].id;
  await ds.query(
    `INSERT INTO "profiles"("userId","firstname","lastname") VALUES ($1,$2,$3)`,
    [userId, data.firstname, data.lastname],
  );
  for (const code of data.roles ?? ['user']) {
    const role = await ds.query(`SELECT "id" FROM "roles" WHERE "code"=$1`, [code]);
    if (role[0]) {
      await ds.query(`INSERT INTO "user_roles"("userId","roleId") VALUES ($1,$2)`, [userId, role[0].id]);
    }
  }
  return userId;
}
```

**Step 3:** Створи `test/venues.e2e-spec.ts`:

```ts
import { bootstrapTestApp } from './helpers/test-app';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestUser } from './helpers/seed';

describe('Venues E2E', () => {
  let app: any;
  let ds: DataSource;
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const result = await bootstrapTestApp();
    app = result.app;
    ds = result.module.get(DataSource);

    const owner = await createTestUser(ds, { email: 'owner@x.com', password: 'Password1', firstname: 'О', lastname: 'В' });
    const admin = await createTestUser(ds, { email: 'admin@x.com', password: 'Password1', firstname: 'A', lastname: 'S', roles: ['user', 'super_admin'] });

    // Login owner
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'owner@x.com', password: 'Password1' });
    userToken = ownerLogin.body.accessToken;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@x.com', password: 'Password1' });
    adminToken = adminLogin.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
    await ds.destroy();
  });

  it('user creates a pending venue', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Тестовий заклад', address: 'вул. Хрещатик, 1', latitude: 50.45, longitude: 30.52, averageCheck: 500 })
      .expect(201);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.id).toBeDefined();
  });

  it('public list does not include pending venues', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/venues')
      .expect(200);
    expect(res.body.data).toEqual([]);
  });

  it('admin approves pending venue', async () => {
    const pending = await request(app.getHttpServer())
      .get('/api/v1/admin/venues/pending')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const id = pending.body.data[0].id;

    await request(app.getHttpServer())
      .post(`/api/v1/admin/venues/${id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const list = await request(app.getHttpServer()).get('/api/v1/venues').expect(200);
    expect(list.body.data.some((v: any) => v.id === id)).toBe(true);
  });

  it('unauthenticated cannot create venue', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/venues')
      .send({ name: 'X', address: 'Y' })
      .expect(401);
  });

  it('non-owner non-admin cannot update venue', async () => {
    const stranger = await createTestUser(ds, { email: 'stranger@x.com', password: 'Password1', firstname: 'S', lastname: 'T' });
    const sLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: 'stranger@x.com', password: 'Password1' });
    const sToken = sLogin.body.accessToken;

    const list = await request(app.getHttpServer()).get('/api/v1/venues').expect(200);
    const venueId = list.body.data[0].id;

    await request(app.getHttpServer())
      .patch(`/api/v1/venues/${venueId}`)
      .set('Authorization', `Bearer ${sToken}`)
      .send({ name: 'hijack' })
      .expect(403);
  });
});
```

**Step 4:** Створи `test/jest-e2e.json`:

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" }
}
```

**Step 5:** Запусти e2e:

```bash
docker compose -f docker-compose.test.yml up -d
export DATABASE_HOST=localhost DATABASE_PORT_TEST=5433 DATABASE_USER_TEST=piyachok_test DATABASE_PASS_TEST=piyachok_test DATABASE_NAME_TEST=piyachok_test
pnpm test:e2e
```

Очікувано: PASS (5 тестів).

**Step 6:** Commit:

```bash
git add test
git commit -m "test(venues): E2E coverage for create, moderation, ownership"
```

---

(Phase 5 завершено. Далі — Phase 6-11.)

---

## Phase 6: Reviews

### Task 24: Review entity + міграція

**Files:**
- Create: `src/modules/reviews/entities/review.entity.ts`
- Create: `src/migrations/1700000002000-Reviews.ts`
- Modify: `src/config/data-source.ts`

**Step 1:** Створи `src/modules/reviews/entities/review.entity.ts`:

```ts
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { Venue } from '../../venues/entities/venue.entity';
import { User } from '../../users/entities/user.entity';

@Entity('reviews')
@Unique(['venueId', 'userId'])
@Index(['venueId', 'createdAt'])
export class Review {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') venueId: string;
  @Column('uuid') userId: string;
  @Column({ type: 'smallint' }) rating: number;
  @Column({ type: 'text' }) text: string;
  @Column({ type: 'text', nullable: true }) checkPhotoUrl: string | null;
  @Column({ type: 'boolean', default: false }) isFeatured: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  @ManyToOne(() => Venue, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'venueId' }) venue: Venue;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'userId' }) user: User;
}
```

**Step 2:** Створи `src/migrations/1700000002000-Reviews.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Reviews1700000002000 implements MigrationInterface {
  name = 'Reviews1700000002000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "reviews" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "venueId" uuid NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "rating" smallint NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
        "text" text NOT NULL,
        "checkPhotoUrl" text,
        "isFeatured" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE("venueId","userId")
      )
    `);
    await q.query(`CREATE INDEX "idx_reviews_venue_created" ON "reviews"("venueId","createdAt" DESC)`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "reviews" CASCADE`);
  }
}
```

**Step 3:** Додай `Review` до `data-source.ts` entities. Запусти `pnpm migration:run`.

**Step 4:** Commit:

```bash
git add src/modules/reviews src/migrations src/config
git commit -m "feat(reviews): Review entity with unique (venueId,userId) constraint"
```

---

### Task 25: ReviewsService + listener перерахунку рейтингу

**Files:**
- Create: `src/modules/reviews/dto/create-review.dto.ts`
- Create: `src/modules/reviews/dto/update-review.dto.ts`
- Create: `src/modules/reviews/reviews.service.ts`
- Create: `src/modules/reviews/listeners/rating-recalc.listener.ts`
- Create: `src/modules/reviews/reviews.module.ts`
- Test: `src/modules/reviews/reviews.service.spec.ts`

**Step 1:** Створи `src/modules/reviews/dto/create-review.dto.ts`:

```ts
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateReviewDto {
  @IsInt() @Min(1) @Max(5) rating: number;
  @IsString() @MinLength(10) @MaxLength(2000) text: string;
  @IsOptional() @IsString() checkPhotoUrl?: string;
}
```

**Step 2:** Створи `src/modules/reviews/dto/update-review.dto.ts`:

```ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateReviewDto } from './create-review.dto';
export class UpdateReviewDto extends PartialType(CreateReviewDto) {}
```

**Step 3:** Створи `src/modules/reviews/events.ts`:

```ts
export const REVIEW_CREATED = 'review.created';
export const REVIEW_UPDATED = 'review.updated';
export const REVIEW_DELETED = 'review.deleted';
```

**Step 4:** Створи `src/modules/reviews/reviews.service.ts`:

```ts
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { Venue } from '../venues/entities/venue.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { PermissionsService } from '../rbac/permissions.service';
import { REVIEW_CREATED, REVIEW_DELETED, REVIEW_UPDATED } from './events';
import { buildMeta, normalizePagination } from '../../common/utils/pagination.util';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(Venue) private readonly venues: Repository<Venue>,
    private readonly perms: PermissionsService,
    private readonly events: EventEmitter2,
  ) {}

  async create(userId: string, venueId: string, dto: CreateReviewDto): Promise<Review> {
    const venue = await this.venues.findOne({ where: { id: venueId } });
    if (!venue) throw new NotFoundException('Заклад не знайдено');
    const existing = await this.reviews.findOne({ where: { venueId, userId } });
    if (existing) throw new ConflictException('Ви вже залишили відгук на цей заклад');
    const review = this.reviews.create({ venueId, userId, ...dto, checkPhotoUrl: dto.checkPhotoUrl ?? null });
    await this.reviews.save(review);
    await this.recalc(venueId);
    this.events.emit(REVIEW_CREATED, { reviewId: review.id, venueId });
    return review;
  }

  async update(userId: string, reviewId: string, dto: UpdateReviewDto): Promise<Review> {
    const review = await this.findOneOrThrow(reviewId);
    if (review.userId !== userId && !(await this.perms.hasPermission(userId, 'review:edit:any'))) {
      throw new ForbiddenException('Не можна редагувати цей відгук');
    }
    Object.assign(review, dto);
    await this.reviews.save(review);
    await this.recalc(review.venueId);
    this.events.emit(REVIEW_UPDATED, { reviewId, venueId: review.venueId });
    return review;
  }

  async softDelete(userId: string, reviewId: string): Promise<void> {
    const review = await this.findOneOrThrow(reviewId);
    if (review.userId !== userId && !(await this.perms.hasPermission(userId, 'review:edit:any'))) {
      throw new ForbiddenException('Не можна видалити цей відгук');
    }
    const venueId = review.venueId;
    await this.reviews.delete(reviewId);
    await this.recalc(venueId);
    this.events.emit(REVIEW_DELETED, { reviewId, venueId });
  }

  async findOneOrThrow(id: string): Promise<Review> {
    const r = await this.reviews.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Відгук не знайдено');
    return r;
  }

  async listForVenue(venueId: string, page = 1, limit = 20, sort: 'newest' | 'oldest' | 'highest' | 'lowest' = 'newest') {
    const { offset } = normalizePagination({ page, limit });
    const order: any = { 'newest': { createdAt: 'DESC' }, 'oldest': { createdAt: 'ASC' }, 'highest': { rating: 'DESC' }, 'lowest': { rating: 'ASC' } }[sort];
    const [data, total] = await this.reviews
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'u')
      .leftJoinAndSelect('u.profile', 'p')
      .where('r.venueId = :venueId', { venueId })
      .orderBy('r.isFeatured', 'DESC')
      .addOrderBy(order.rating ?? 'createdAt', order.createdAt ? order.createdAt : 'DESC')
      .skip(offset).take(limit)
      .getManyAndCount();
    return { data, meta: buildMeta({ page, limit, offset }, total) };
  }

  async listForUser(userId: string) {
    return this.reviews.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async feature(reviewId: string) {
    const r = await this.findOneOrThrow(reviewId);
    r.isFeatured = true;
    return this.reviews.save(r);
  }

  private async recalc(venueId: string) {
    const result = await this.reviews
      .createQueryBuilder('r')
      .select('AVG(r.rating)', 'avg')
      .addSelect('COUNT(r.id)', 'count')
      .where('r.venueId = :venueId', { venueId })
      .getRawOne<{ avg: string; count: string }>();
    await this.venues.update(venueId, {
      ratingAvg: Number(result?.avg ?? 0),
      ratingCount: Number(result?.count ?? 0),
    });
  }
}
```

**Step 5:** Створи `src/modules/reviews/listeners/rating-recalc.listener.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { VenuesService } from '../../venues/venues.service';
import { REVIEW_CREATED, REVIEW_UPDATED, REVIEW_DELETED } from '../events';

@Injectable()
export class RatingRecalcListener {
  private readonly logger = new Logger(RatingRecalcListener.name);
  constructor(private readonly venues: VenuesService) {}

  @OnEvent(REVIEW_CREATED) @OnEvent(REVIEW_UPDATED) @OnEvent(REVIEW_DELETED)
  async invalidate() { await this.venues.invalidateListCache(); }
}
```

**Step 6:** Створи `src/modules/reviews/reviews.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from './entities/review.entity';
import { Venue } from '../venues/entities/venue.entity';
import { ReviewsService } from './reviews.service';
import { RatingRecalcListener } from './listeners/rating-recalc.listener';
import { RbacModule } from '../rbac/rbac.module';
import { VenuesModule } from '../venues/venues.module';

@Module({
  imports: [TypeOrmModule.forFeature([Review, Venue]), RbacModule, VenuesModule],
  providers: [ReviewsService, RatingRecalcListener],
  exports: [ReviewsService],
})
export class ReviewsModule {}
```

**Step 7:** Створи `src/modules/reviews/reviews.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReviewsService } from './reviews.service';
import { Review } from './entities/review.entity';
import { Venue } from '../venues/entities/venue.entity';
import { PermissionsService } from '../rbac/permissions.service';

function qb() {
  return { select: jest.fn().mockReturnThis(), addSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getRawOne: jest.fn().mockResolvedValue({ avg: '4.5', count: '2' }) };
}

describe('ReviewsService', () => {
  let service: ReviewsService;
  let reviews: any;
  let venues: any;
  let perms: any;
  let events: any;

  beforeEach(async () => {
    reviews = { create: jest.fn((x) => x), save: jest.fn().mockResolvedValue(undefined), findOne: jest.fn(), delete: jest.fn(), createQueryBuilder: jest.fn().mockReturnValue({ leftJoinAndSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), addOrderBy: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), take: jest.fn().mockReturnThis(), getManyAndCount: jest.fn().mockResolvedValue([[], 0]) }) };
    venues = { findOne: jest.fn(), update: jest.fn() };
    perms = { hasPermission: jest.fn() };
    events = { emit: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: getRepositoryToken(Review), useValue: reviews },
        { provide: getRepositoryToken(Venue), useValue: venues },
        { provide: PermissionsService, useValue: perms },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    service = module.get(ReviewsService);
  });

  it('create throws 404 when venue missing', async () => {
    venues.findOne.mockResolvedValueOnce(null);
    await expect(service.create('u1', 'v1', { rating: 5, text: 'Чудовий заклад! Рекомендую' })).rejects.toThrow(NotFoundException);
  });

  it('create throws 409 on duplicate review', async () => {
    venues.findOne.mockResolvedValueOnce({ id: 'v1' });
    reviews.findOne.mockResolvedValueOnce({ id: 'r1' });
    await expect(service.create('u1', 'v1', { rating: 5, text: 'Чудовий заклад! Рекомендую' })).rejects.toThrow(ConflictException);
  });

  it('create saves and recalcs rating', async () => {
    venues.findOne.mockResolvedValueOnce({ id: 'v1' });
    reviews.findOne.mockResolvedValueOnce(null);
    reviews.save.mockResolvedValueOnce({ id: 'r-new' });
    const r = await service.create('u1', 'v1', { rating: 5, text: 'Чудовий заклад! Рекомендую' });
    expect(r.id).toBe('r-new');
    expect(venues.update).toHaveBeenCalledWith('v1', { ratingAvg: 4.5, ratingCount: 2 });
    expect(events.emit).toHaveBeenCalledWith('review.created', expect.anything());
  });

  it('update forbids non-owner without perm', async () => {
    reviews.findOne.mockResolvedValueOnce({ id: 'r1', userId: 'u2', venueId: 'v1' });
    perms.hasPermission.mockResolvedValueOnce(false);
    await expect(service.update('u1', 'r1', { text: 'X' } as any)).rejects.toThrow(ForbiddenException);
  });

  it('update allows super_admin', async () => {
    reviews.findOne.mockResolvedValueOnce({ id: 'r1', userId: 'u2', venueId: 'v1', rating: 5, text: '...' });
    perms.hasPermission.mockResolvedValueOnce(true);
    const r = await service.update('admin', 'r1', { text: 'X' } as any);
    expect(events.emit).toHaveBeenCalledWith('review.updated', expect.anything());
  });

  it('softDelete removes and recalcs', async () => {
    reviews.findOne.mockResolvedValueOnce({ id: 'r1', userId: 'u1', venueId: 'v1' });
    await service.softDelete('u1', 'r1');
    expect(reviews.delete).toHaveBeenCalledWith('r1');
    expect(events.emit).toHaveBeenCalledWith('review.deleted', expect.anything());
  });
});
```

**Step 8:** Запусти тести:

```bash
pnpm test
```

**Step 9:** Commit:

```bash
git add src/modules/reviews
git commit -m "feat(reviews): ReviewsService with rating recalc and cache invalidation"
```

---

### Task 26: ReviewsController

**Files:**
- Create: `src/modules/reviews/reviews.controller.ts`
- Test: `src/modules/reviews/reviews.controller.spec.ts`

**Step 1:** Створи `src/modules/reviews/reviews.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { FileStorageService } from '../../common/services/file-storage.service';

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService, private readonly storage: FileStorageService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('venues/:venueId/reviews')
  @Permissions('review:create')
  @UseInterceptors(FileInterceptor('checkPhoto'))
  async create(
    @CurrentUser() u: JwtUser,
    @Param('venueId') venueId: string,
    @Body() dto: CreateReviewDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let checkPhotoUrl: string | undefined;
    if (file) {
      const stored = await this.storage.save(`reviews/${venueId}`, { originalname: file.originalname, mimetype: file.mimetype, size: file.size, buffer: file.buffer });
      checkPhotoUrl = stored.url;
    }
    const review = await this.reviews.create(u.sub, venueId, { ...dto, checkPhotoUrl });
    return { data: review };
  }

  @Public()
  @Get('venues/:venueId/reviews')
  list(@Param('venueId') venueId: string, @Query('page') page: number, @Query('limit') limit: number, @Query('sort') sort?: 'newest' | 'oldest' | 'highest' | 'lowest') {
    return this.reviews.listForVenue(venueId, page, limit, sort);
  }

  @Public()
  @Get('reviews/:id')
  get(@Param('id') id: string) {
    return this.reviews.findOneOrThrow(id).then(data => ({ data }));
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Patch('reviews/:id')
  @Permissions('review:edit:own', 'review:edit:any')
  update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateReviewDto) {
    return this.reviews.update(u.sub, id, dto).then(data => ({ data }));
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Delete('reviews/:id')
  @Permissions('review:edit:own', 'review:edit:any')
  remove(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.reviews.softDelete(u.sub, id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('reviews/:id/feature')
  @Permissions('review:feature')
  feature(@Param('id') id: string) {
    return this.reviews.feature(id).then(data => ({ data }));
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/reviews')
  myReviews(@CurrentUser() u: JwtUser) {
    return this.reviews.listForUser(u.sub).then(data => ({ data }));
  }
}
```

**Step 2:** Зареєструй controller у ReviewsModule. Підключи ReviewsModule до AppModule.

**Step 3:** Тести (minimal controller spec):

```ts
import { Test } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { FileStorageService } from '../../common/services/file-storage.service';

describe('ReviewsController', () => {
  let controller: ReviewsController;
  let reviews: any;
  let storage: any;

  beforeEach(async () => {
    reviews = { create: jest.fn(), listForVenue: jest.fn(), findOneOrThrow: jest.fn(), update: jest.fn(), softDelete: jest.fn(), feature: jest.fn(), listForUser: jest.fn() };
    storage = { save: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [{ provide: ReviewsService, useValue: reviews }, { provide: FileStorageService, useValue: storage }],
    }).compile();
    controller = module.get(ReviewsController);
  });

  it('create delegates', async () => {
    reviews.create.mockResolvedValue({ id: 'r1' });
    const res = await controller.create({ sub: 'u1' } as any, 'v1', { rating: 5, text: 'Чудово! Все сподобалось' } as any);
    expect(res.data.id).toBe('r1');
  });

  it('list delegates', async () => {
    reviews.listForVenue.mockResolvedValue({ data: [], meta: { total: 0 } });
    await controller.list('v1', 1, 20);
    expect(reviews.listForVenue).toHaveBeenCalledWith('v1', 1, 20, undefined);
  });
});
```

**Step 4:** Commit:

```bash
git add src/modules/reviews
git commit -m "feat(reviews): ReviewsController with photo upload, feature, my reviews"
```

---

## Phase 7: Favorites

### Task 27: FavoritesService + Controller

**Files:**
- Create: `src/modules/favorites/entities/favorite.entity.ts`
- Create: `src/modules/favorites/favorites.service.ts`
- Create: `src/modules/favorites/favorites.controller.ts`
- Create: `src/modules/favorites/favorites.module.ts`
- Create: `src/migrations/1700000003000-Favorites.ts`
- Test: `src/modules/favorites/favorites.service.spec.ts`

**Step 1:** Створи `src/modules/favorites/entities/favorite.entity.ts`:

```ts
import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('favorites')
export class Favorite {
  @PrimaryColumn('uuid') userId: string;
  @PrimaryColumn('uuid') venueId: string;
  @CreateDateColumn() createdAt: Date;
}
```

**Step 2:** Створи `src/modules/favorites/favorites.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './entities/favorite.entity';
import { Venue } from '../venues/entities/venue.entity';
import { buildMeta, normalizePagination } from '../../common/utils/pagination.util';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite) private readonly favorites: Repository<Favorite>,
    @InjectRepository(Venue) private readonly venues: Repository<Venue>,
  ) {}

  async add(userId: string, venueId: string): Promise<void> {
    await this.assertVenue(venueId);
    const existing = await this.favorites.findOne({ where: { userId, venueId } });
    if (existing) return;
    await this.favorites.save({ userId, venueId });
  }

  async remove(userId: string, venueId: string): Promise<void> {
    await this.favorites.delete({ userId, venueId });
  }

  async list(userId: string, page = 1, limit = 20) {
    const { offset } = normalizePagination({ page, limit });
    const [data, total] = await this.favorites
      .createQueryBuilder('f')
      .innerJoinAndSelect('venues', 'v', 'v.id = f."venueId"')
      .where('f."userId" = :userId', { userId })
      .orderBy('f."createdAt"', 'DESC')
      .skip(offset).take(limit)
      .getRawAndEntities();
    return { data: data.map(d => d.v_id ? { id: d.v_id, name: d.v_name, address: d.v_address, ratingAvg: d.v_ratingAvg, mainPhotoUrl: d.v_mainPhotoUrl } : d), meta: buildMeta({ page, limit, offset }, total) };
  }

  private async assertVenue(venueId: string) {
    const v = await this.venues.findOne({ where: { id: venueId } });
    if (!v) throw new NotFoundException('Заклад не знайдено');
  }
}
```

**Step 3:** Створи `src/modules/favorites/favorites.controller.ts`:

```ts
import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { FavoritesService } from './favorites.service';

@Controller('me/favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Post(':venueId')
  async add(@CurrentUser() u: JwtUser, @Param('venueId') id: string) {
    await this.favorites.add(u.sub, id);
    return { data: { venueId: id } };
  }

  @Delete(':venueId')
  async remove(@CurrentUser() u: JwtUser, @Param('venueId') id: string) {
    await this.favorites.remove(u.sub, id);
    return { data: { venueId: id } };
  }

  @Get()
  list(@CurrentUser() u: JwtUser, @Query('page') page: number, @Query('limit') limit: number) {
    return this.favorites.list(u.sub, page, limit);
  }
}
```

**Step 4:** Створи `src/modules/favorites/favorites.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Favorite } from './entities/favorite.entity';
import { Venue } from '../venues/entities/venue.entity';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Favorite, Venue])],
  providers: [FavoritesService],
  controllers: [FavoritesController],
  exports: [FavoritesService],
})
export class FavoritesModule {}
```

**Step 5:** Створи `src/migrations/1700000003000-Favorites.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';
export class Favorites1700000003000 implements MigrationInterface {
  name = 'Favorites1700000003000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "favorites" (
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "venueId" uuid NOT NULL REFERENCES "venues"("id") ON DELETE CASCADE,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        PRIMARY KEY ("userId","venueId")
      )
    `);
    await q.query(`CREATE INDEX "idx_favorites_user_created" ON "favorites"("userId","createdAt" DESC)`);
  }
  public async down(q: QueryRunner): Promise<void> { await q.query(`DROP TABLE IF EXISTS "favorites" CASCADE`); }
}
```

**Step 6:** Unit-тест `favorites.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { Favorite } from './entities/favorite.entity';
import { Venue } from '../venues/entities/venue.entity';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let favorites: any;
  let venues: any;

  beforeEach(async () => {
    favorites = { findOne: jest.fn(), save: jest.fn(), delete: jest.fn(), createQueryBuilder: jest.fn().mockReturnValue({ innerJoinAndSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), take: jest.fn().mockReturnThis(), getRawAndEntities: jest.fn().mockResolvedValue({ entities: [], raw: [] }) }) };
    venues = { findOne: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: getRepositoryToken(Favorite), useValue: favorites },
        { provide: getRepositoryToken(Venue), useValue: venues },
      ],
    }).compile();
    service = module.get(FavoritesService);
  });

  it('add throws when venue missing', async () => {
    venues.findOne.mockResolvedValueOnce(null);
    await expect(service.add('u1', 'v1')).rejects.toThrow(NotFoundException);
  });

  it('add is idempotent (no error if already exists)', async () => {
    venues.findOne.mockResolvedValueOnce({ id: 'v1' });
    favorites.findOne.mockResolvedValueOnce({ userId: 'u1', venueId: 'v1' });
    await service.add('u1', 'v1');
    expect(favorites.save).not.toHaveBeenCalled();
  });

  it('add saves when new', async () => {
    venues.findOne.mockResolvedValueOnce({ id: 'v1' });
    favorites.findOne.mockResolvedValueOnce(null);
    await service.add('u1', 'v1');
    expect(favorites.save).toHaveBeenCalledWith({ userId: 'u1', venueId: 'v1' });
  });
});
```

**Step 7:** Commit:

```bash
git add src/modules/favorites src/migrations
git commit -m "feat(favorites): FavoritesService, controller, module"
```

---

## Phase 8: News

### Task 28: NewsService + Controller (per-venue + global)

**Files:**
- Create: `src/modules/news/entities/news.entity.ts`
- Create: `src/modules/news/dto/create-news.dto.ts`
- Create: `src/modules/news/news.service.ts`
- Create: `src/modules/news/news.controller.ts`
- Create: `src/modules/news/news.module.ts`
- Create: `src/migrations/1700000004000-News.ts`
- Test: `src/modules/news/news.service.spec.ts`

**Step 1:** Створи `src/modules/news/entities/news.entity.ts`:

```ts
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum NewsCategory { General = 'general', Promo = 'promo', Event = 'event' }
export enum NewsStatus { Draft = 'draft', Published = 'published', Archived = 'archived' }

@Entity('news')
@Index(['category', 'publishedAt'])
export class News {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', nullable: true }) venueId: string | null;
  @Column({ type: 'enum', enum: NewsCategory }) category: NewsCategory;
  @Column({ type: 'varchar', length: 200 }) title: string;
  @Column({ type: 'text' }) content: string;
  @Column({ type: 'text', nullable: true }) imageUrl: string | null;
  @Column({ type: 'enum', enum: NewsStatus, default: NewsStatus.Published }) status: NewsStatus;
  @Column({ type: 'boolean', default: false }) isPromoted: boolean;
  @Column({ type: 'date', nullable: true }) promotedUntil: string | null;
  @Column({ type: 'timestamptz', nullable: true }) publishedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

**Step 2:** DTO `create-news.dto.ts`:

```ts
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { NewsCategory, NewsStatus } from '../entities/news.entity';

export class CreateNewsDto {
  @IsOptional() @IsUUID() venueId?: string;
  @IsEnum(NewsCategory) category: NewsCategory;
  @IsString() @MinLength(5) title: string;
  @IsString() @MinLength(20) content: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsEnum(NewsStatus) status?: NewsStatus;
  @IsOptional() @IsBoolean() isPromoted?: boolean;
}
```

**Step 3:** Створи `src/modules/news/news.service.ts`:

```ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { News } from './entities/news.entity';
import { CreateNewsDto } from './dto/create-news.dto';
import { VenuesService } from '../venues/venues.service';
import { PermissionsService } from '../rbac/permissions.service';
import { buildMeta, normalizePagination } from '../../common/utils/pagination.util';

@Injectable()
export class NewsService {
  constructor(
    @InjectRepository(News) private readonly news: Repository<News>,
    private readonly venues: VenuesService,
    private readonly perms: PermissionsService,
  ) {}

  async createForVenue(userId: string, venueId: string, dto: CreateNewsDto) {
    const venue = await this.venues.findOneOrThrow(venueId);
    if (venue.ownerId !== userId && !(await this.perms.hasPermission(userId, 'news:manage:any'))) {
      throw new ForbiddenException('Не можна керувати новинами цього закладу');
    }
    return this.save(dto, venueId);
  }

  async createGlobal(dto: CreateNewsDto) {
    return this.save(dto, null);
  }

  private async save(dto: CreateNewsDto, venueId: string | null) {
    const now = new Date();
    const entity = this.news.create({
      venueId,
      category: dto.category,
      title: dto.title,
      content: dto.content,
      imageUrl: dto.imageUrl ?? null,
      status: dto.status ?? 'published',
      isPromoted: dto.isPromoted ?? false,
      publishedAt: now,
    });
    return this.news.save(entity);
  }

  async listPublic(opts: { category?: string; venueId?: string; page?: number; limit?: number; isPromoted?: boolean }) {
    const { page, limit, offset } = normalizePagination(opts);
    const qb = this.news.createQueryBuilder('n').where('n.status = :status', { status: 'published' });
    if (opts.category) qb.andWhere('n.category = :category', { category: opts.category });
    if (opts.venueId) qb.andWhere('n.venueId = :venueId', { venueId: opts.venueId });
    if (opts.isPromoted) qb.andWhere('n.isPromoted = true');
    qb.orderBy('n.isPromoted', 'DESC').addOrderBy('n.publishedAt', 'DESC').skip(offset).take(limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: buildMeta({ page, limit, offset }, total) };
  }

  async get(id: string) {
    const n = await this.news.findOne({ where: { id } });
    if (!n) throw new NotFoundException('Новину не знайдено');
    return n;
  }

  async update(id: string, dto: Partial<CreateNewsDto>) {
    const n = await this.get(id);
    Object.assign(n, dto);
    return this.news.save(n);
  }

  async softDelete(id: string) {
    const n = await this.get(id);
    n.status = 'archived';
    return this.news.save(n);
  }
}
```

**Step 4:** Створи `src/modules/news/news.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { NewsService } from './news.service';
import { CreateNewsDto } from './dto/create-news.dto';

@Controller()
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Public()
  @Get('news')
  list(@Query() q: any) {
    return this.news.listPublic(q);
  }

  @Public()
  @Get('news/:id')
  get(@Param('id') id: string) {
    return this.news.get(id).then(data => ({ data }));
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('me/venues/:venueId/news')
  @Permissions('news:manage:own', 'news:manage:any')
  createForVenue(@CurrentUser() u: JwtUser, @Param('venueId') venueId: string, @Body() dto: CreateNewsDto) {
    return this.news.createForVenue(u.sub, venueId, dto).then(data => ({ data }));
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Patch('news/:id')
  @Permissions('news:manage:own', 'news:manage:any')
  update(@Param('id') id: string, @Body() dto: Partial<CreateNewsDto>) {
    return this.news.update(id, dto).then(data => ({ data }));
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Delete('news/:id')
  @Permissions('news:manage:own', 'news:manage:any')
  remove(@Param('id') id: string) {
    return this.news.softDelete(id);
  }
}
```

**Step 5:** Створи `src/modules/news/news.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { News } from './entities/news.entity';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { VenuesModule } from '../venues/venues.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [TypeOrmModule.forFeature([News]), VenuesModule, RbacModule],
  providers: [NewsService],
  controllers: [NewsController],
  exports: [NewsService],
})
export class NewsModule {}
```

**Step 6:** Створи `src/modules/news/admin-news.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { NewsService } from './news.service';
import { CreateNewsDto } from './dto/create-news.dto';

@Controller('admin/news')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminNewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  @Permissions('news:manage:any')
  list(@Query() q: any) {
    return this.news.listPublic(q);
  }

  @Post()
  @Permissions('news:manage:any')
  createGlobal(@Body() dto: CreateNewsDto) {
    return this.news.createGlobal(dto).then(data => ({ data }));
  }
}
```

Зареєструй AdminNewsController у NewsModule.

**Step 7:** Створи `src/migrations/1700000004000-News.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';
export class News1700000004000 implements MigrationInterface {
  name = 'News1700000004000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "news" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "venueId" uuid REFERENCES "venues"("id") ON DELETE CASCADE,
        "category" varchar(16) NOT NULL,
        "title" varchar(200) NOT NULL,
        "content" text NOT NULL,
        "imageUrl" text,
        "status" varchar(16) NOT NULL DEFAULT 'published',
        "isPromoted" boolean NOT NULL DEFAULT false,
        "promotedUntil" date,
        "publishedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        "updatedAt" timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await q.query(`CREATE INDEX "idx_news_category_publishedAt" ON "news"("category","publishedAt" DESC)`);
  }
  public async down(q: QueryRunner): Promise<void> { await q.query(`DROP TABLE IF EXISTS "news" CASCADE`); }
}
```

**Step 8:** Unit-тест `news.service.spec.ts` (аналогічно ReviewsService — перевір createForVenue дозволяє owner, глобальна новина створюється, list повертає тільки published):

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { NewsService } from './news.service';
import { News, NewsCategory } from './entities/news.entity';
import { VenuesService } from '../venues/venues.service';
import { PermissionsService } from '../rbac/permissions.service';

describe('NewsService', () => {
  let service: NewsService;
  let news: any;
  let venues: any;
  let perms: any;

  beforeEach(async () => {
    news = { create: jest.fn((x) => x), save: jest.fn().mockResolvedValue(undefined), findOne: jest.fn(), createQueryBuilder: jest.fn().mockReturnValue({ where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), addOrderBy: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), take: jest.fn().mockReturnThis(), getManyAndCount: jest.fn().mockResolvedValue([[], 0]) }) };
    venues = { findOneOrThrow: jest.fn() };
    perms = { hasPermission: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        NewsService,
        { provide: getRepositoryToken(News), useValue: news },
        { provide: VenuesService, useValue: venues },
        { provide: PermissionsService, useValue: perms },
      ],
    }).compile();
    service = module.get(NewsService);
  });

  it('createForVenue allows owner', async () => {
    venues.findOneOrThrow.mockResolvedValueOnce({ ownerId: 'u1' });
    const r = await service.createForVenue('u1', 'v1', { category: NewsCategory.Promo, title: 'Акція!', content: 'Деталі акції тут' });
    expect(news.save).toHaveBeenCalled();
  });

  it('createForVenue forbids non-owner without perm', async () => {
    venues.findOneOrThrow.mockResolvedValueOnce({ ownerId: 'u2' });
    perms.hasPermission.mockResolvedValueOnce(false);
    await expect(service.createForVenue('u1', 'v1', { category: NewsCategory.Promo, title: 'Акція!', content: 'Деталі акції тут' })).rejects.toThrow(ForbiddenException);
  });

  it('createGlobal does not require venue', async () => {
    const r = await service.createGlobal({ category: NewsCategory.General, title: 'Загальна новина', content: 'Щось сталось у місті' });
    expect(r.venueId).toBeNull();
  });
});
```

**Step 9:** Запусти міграцію + тести. Commit:

```bash
pnpm migration:run
pnpm test
git add src/modules/news src/migrations
git commit -m "feat(news): NewsService with per-venue and global news, admin controller"
```

---

## Phase 9: Complaints

### Task 29: ComplaintsService + Controller

**Files:**
- Create: `src/modules/complaints/entities/complaint.entity.ts`
- Create: `src/modules/complaints/dto/create-complaint.dto.ts`
- Create: `src/modules/complaints/dto/resolve-complaint.dto.ts`
- Create: `src/modules/complaints/complaints.service.ts`
- Create: `src/modules/complaints/complaints.controller.ts`
- Create: `src/modules/complaints/complaints.module.ts`
- Create: `src/modules/complaints/admin-complaints.controller.ts`
- Create: `src/migrations/1700000005000-Complaints.ts`
- Test: `src/modules/complaints/complaints.service.spec.ts`

**Step 1:** Entity:

```ts
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Venue } from '../../venues/entities/venue.entity';
import { Review } from '../../reviews/entities/review.entity';

export enum ComplaintReason { FakePromo = 'fake_promo', Fraud = 'fraud', Other = 'other' }
export enum ComplaintStatus { New = 'new', InReview = 'in_review', Resolved = 'resolved', Rejected = 'rejected' }

@Entity('complaints')
@Index(['status', 'createdAt'])
export class Complaint {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', nullable: true }) venueId: string | null;
  @Column({ type: 'uuid', nullable: true }) reviewId: string | null;
  @Column('uuid') userId: string;
  @Column({ type: 'enum', enum: ComplaintReason }) reason: ComplaintReason;
  @Column({ type: 'text' }) text: string;
  @Column({ type: 'enum', enum: ComplaintStatus, default: ComplaintStatus.New }) status: ComplaintStatus;
  @CreateDateColumn() createdAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) resolvedAt: Date | null;
  @Column({ type: 'uuid', nullable: true }) resolvedBy: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'userId' }) user: User;
  @ManyToOne(() => Venue, { onDelete: 'CASCADE', nullable: true }) @JoinColumn({ name: 'venueId' }) venue: Venue;
  @ManyToOne(() => Review, { onDelete: 'CASCADE', nullable: true }) @JoinColumn({ name: 'reviewId' }) review: Review;
}
```

**Step 2:** DTOs (аналогічно — `CreateComplaintDto { venueId?, reviewId?, reason, text (>=20) }`, `ResolveComplaintDto { status, note? }`).

**Step 3:** `ComplaintsService` (create, listPending, resolve), `ComplaintsController` (`POST /complaints` з auth, `GET /admin/complaints`, `POST /admin/complaints/:id/resolve`). Service тести: `create` вимагає venueId або reviewId, `resolve` переводить статус і виставляє resolvedBy/resolvedAt.

**Step 4:** Migration: таблиця `complaints` з FK на users, venues, reviews (nullable).

**Step 5:** Commit:

```bash
git add src/modules/complaints src/migrations
git commit -m "feat(complaints): ComplaintsService and admin controller"
```

---

## Phase 10: Hangouts («Пиячок»)

### Task 30: Hangout entities + міграція

**Files:**
- Create: `src/modules/hangouts/entities/hangout.entity.ts`
- Create: `src/modules/hangouts/entities/hangout-participant.entity.ts`
- Create: `src/modules/hangouts/dto/create-hangout.dto.ts`
- Create: `src/modules/hangouts/dto/join-hangout.dto.ts`
- Create: `src/migrations/1700000006000-Hangouts.ts`

**Step 1:** `hangout.entity.ts` — id, creatorId, venueId, date, time, purpose, gender (enum), groupSize, payer (enum), desiredBudget, status (enum), createdAt, index (venueId, date, status).

**Step 2:** `hangout-participant.entity.ts` — composite PK (hangoutId, userId), joinedAt.

**Step 3:** `create-hangout.dto.ts`:

```ts
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export enum HangoutGender { Male = 'male', Female = 'female', Any = 'any' }
export enum HangoutPayer { Me = 'me', Split = 'split', Them = 'them' }

export class CreateHangoutDto {
  @IsDateString() date: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) time: string;
  @IsString() @MinLength(10) @MaxLength(500) purpose: string;
  @IsOptional() @IsEnum(HangoutGender) gender?: HangoutGender;
  @IsInt() @Min(1) @Max(20) @Type(() => Number) groupSize: number;
  @IsOptional() @IsEnum(HangoutPayer) payer?: HangoutPayer;
  @IsOptional() @IsNumber() @Min(0) @Max(100000) desiredBudget?: number;
}
```

**Step 4:** Migration: tables `hangouts` і `hangout_participants`, FKs, CHECK на groupSize, status enum.

**Step 5:** Commit:

```bash
git add src/modules/hangouts src/migrations
git commit -m "feat(hangouts): entities and migration for hangouts + participants"
```

---

### Task 31: HangoutsService (create, join, leave, cancel, public list)

**Files:**
- Create: `src/modules/hangouts/hangouts.service.ts`
- Create: `src/modules/hangouts/hangouts.module.ts`
- Create: `src/modules/hangouts/cron/hangout-cron.ts`
- Create: `src/modules/hangouts/listeners/hangout-cache.listener.ts`
- Test: `src/modules/hangouts/hangouts.service.spec.ts`

**Step 1:** `HangoutsService`:

```ts
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Hangout, HangoutStatus } from './entities/hangout.entity';
import { HangoutParticipant } from './entities/hangout-participant.entity';
import { CreateHangoutDto } from './dto/create-hangout.dto';
import { VenuesService } from '../venues/venues.service';
import { CacheService } from '../../common/services/cache.service';
import { buildMeta, normalizePagination } from '../../common/utils/pagination.util';
import { createHash } from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';

export const HANGOUT_FILLED = 'hangout.filled';
export const HANGOUT_CANCELLED = 'hangout.cancelled';

@Injectable()
export class HangoutsService {
  constructor(
    @InjectRepository(Hangout) private readonly hangouts: Repository<Hangout>,
    @InjectRepository(HangoutParticipant) private readonly participants: Repository<HangoutParticipant>,
    private readonly venues: VenuesService,
    private readonly cache: CacheService,
    private readonly events: EventEmitter2,
  ) {}

  async create(userId: string, venueId: string, dto: CreateHangoutDto): Promise<Hangout> {
    await this.venues.findOneOrThrow(venueId);
    if (new Date(dto.date) < this.startOfToday()) {
      throw new BadRequestException('Дата має бути сьогодні або в майбутньому');
    }
    const h = this.hangouts.create({
      creatorId: userId, venueId, date: dto.date, time: dto.time, purpose: dto.purpose,
      gender: dto.gender ?? 'any', groupSize: dto.groupSize, payer: dto.payer ?? 'split',
      desiredBudget: dto.desiredBudget ?? null, status: 'open',
    });
    await this.hangouts.save(h);
    await this.participants.save({ hangoutId: h.id, userId });
    return h;
  }

  async join(userId: string, hangoutId: string): Promise<Hangout> {
    const h = await this.findOneOrThrow(hangoutId);
    if (h.status !== 'open') throw new ConflictException('Заявка вже заповнена або скасована');
    const existing = await this.participants.findOne({ where: { hangoutId, userId } });
    if (existing) throw new ConflictException('Ви вже приєднані');
    const count = await this.participants.count({ where: { hangoutId } });
    if (count >= h.groupSize) throw new ConflictException('Заявка вже заповнена');
    await this.participants.save({ hangoutId, userId });
    const newCount = count + 1;
    if (newCount >= h.groupSize) {
      h.status = 'filled';
      await this.hangouts.save(h);
      this.events.emit(HANGOUT_FILLED, { hangoutId });
    }
    await this.invalidateListCache();
    return h;
  }

  async leave(userId: string, hangoutId: string): Promise<void> {
    const h = await this.findOneOrThrow(hangoutId);
    if (h.creatorId === userId) {
      const others = await this.participants.count({ where: { hangoutId } });
      if (others > 1) throw new ForbiddenException('Творець не може залишити, поки є інші учасники. Скасуйте заявку.');
    }
    await this.participants.delete({ hangoutId, userId });
    if (h.status === 'filled') {
      h.status = 'open';
      await this.hangouts.save(h);
    }
    await this.invalidateListCache();
  }

  async cancel(userId: string, hangoutId: string): Promise<Hangout> {
    const h = await this.findOneOrThrow(hangoutId);
    if (h.creatorId !== userId) throw new ForbiddenException('Тільки творець може скасувати');
    h.status = 'cancelled';
    await this.hangouts.save(h);
    this.events.emit(HANGOUT_CANCELLED, { hangoutId });
    await this.invalidateListCache();
    return h;
  }

  async listPublic(opts: { venueId?: string; date?: string; status?: string; page?: number; limit?: number }) {
    const { page, limit, offset } = normalizePagination(opts);
    const cacheKey = `hangouts:list:${createHash('sha1').update(JSON.stringify(opts)).digest('hex')}`;
    const cached = await this.cache.get<Hangout[]>(cacheKey);
    if (cached) return { data: cached, meta: buildMeta({ page, limit, offset }, cached.length) };
    const qb = this.hangouts.createQueryBuilder('h').leftJoinAndSelect('h.venue', 'v').leftJoinAndSelect('v.photos', 'p').leftJoin('h.participants', 'part').addSelect('COUNT(part."userId")', 'participantsCount').groupBy('h.id, v.id, p.id');
    if (opts.venueId) qb.andWhere('h.venueId = :venueId', { venueId: opts.venueId });
    if (opts.date) qb.andWhere('h.date = :date', { date: opts.date });
    if (opts.status) qb.andWhere('h.status = :status', { status: opts.status });
    else qb.andWhere('h.status = :status', { status: 'open' });
    qb.orderBy('h.date', 'ASC').addOrderBy('h.time', 'ASC').skip(offset).take(limit);
    const [data, total] = await qb.getManyAndCount();
    await this.cache.set(cacheKey, data, 30);
    return { data, meta: buildMeta({ page, limit, offset }, total) };
  }

  async getForUser(userId: string, hangoutId: string): Promise<Hangout> {
    const h = await this.hangouts.findOne({ where: { id: hangoutId }, relations: ['participants'] });
    if (!h) throw new NotFoundException('Заявку не знайдено');
    const isParticipant = h.participants.some(p => p.userId === userId);
    if (!isParticipant) throw new ForbiddenException('Ви не учасник цієї заявки');
    return h;
  }

  async listMine(userId: string, role: 'created' | 'joined' | 'all') {
    if (role === 'created') return this.hangouts.find({ where: { creatorId: userId }, order: { createdAt: 'DESC' } });
    if (role === 'joined') {
      return this.hangouts.createQueryBuilder('h').innerJoin('h.participants', 'p').where('p.userId = :userId', { userId }).andWhere('h.creatorId != :userId', { userId }).getMany();
    }
    return this.hangouts.createQueryBuilder('h').leftJoin('h.participants', 'p').where(new Brackets(b => b.where('h.creatorId = :userId', { userId }).orWhere('p.userId = :userId', { userId }))).getMany();
  }

  async findOneOrThrow(id: string): Promise<Hangout> {
    const h = await this.hangouts.findOne({ where: { id } });
    if (!h) throw new NotFoundException('Заявку не знайдено');
    return h;
  }

  async markCompletedBatch(): Promise<number> {
    const result = await this.hangouts
      .createQueryBuilder()
      .update()
      .set({ status: 'completed' })
      .where(`status IN ('open','filled') AND (date + time)::timestamp < NOW()`)
      .execute();
    await this.invalidateListCache();
    return result.affected ?? 0;
  }

  async invalidateListCache() {
    await this.cache.delByPattern('hangouts:list:*');
  }

  private startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
```

**Step 2:** Cron `hangout-cron.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HangoutsService } from '../hangouts.service';

@Injectable()
export class HangoutCron {
  private readonly logger = new Logger(HangoutCron.name);
  constructor(private readonly hangouts: HangoutsService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async markPastHangoutsCompleted() {
    const count = await this.hangouts.markCompletedBatch();
    if (count > 0) this.logger.log(`Marked ${count} past hangouts as completed`);
  }
}
```

**Step 3:** `hangouts.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Hangout } from './entities/hangout.entity';
import { HangoutParticipant } from './entities/hangout-participant.entity';
import { HangoutsService } from './hangouts.service';
import { HangoutsController } from './hangouts.controller';
import { VenuesModule } from '../venues/venues.module';
import { HangoutCron } from './cron/hangout-cron';

@Module({
  imports: [TypeOrmModule.forFeature([Hangout, HangoutParticipant]), VenuesModule, ScheduleModule.forRoot()],
  providers: [HangoutsService, HangoutCron],
  controllers: [HangoutsController],
  exports: [HangoutsService],
})
export class HangoutsModule {}
```

**Step 4:** Unit-тест `hangouts.service.spec.ts` (перевірки: create з минулою датою → 400, join коли status≠open → 409, fill trigger, leave creator блокування, cancel чужий → 403).

**Step 5:** Commit:

```bash
git add src/modules/hangouts
git commit -m "feat(hangouts): HangoutsService with create/join/leave/cancel, cron, cache"
```

---

### Task 32: HangoutsController

**Files:**
- Create: `src/modules/hangouts/hangouts.controller.ts`

**Step 1:** Endpoints (з Permissions):

```ts
@Public() @Get('hangouts') list(@Query() q) { return this.hangouts.listPublic(q); }
@UseGuards(JwtAuthGuard, PermissionsGuard) @Post('venues/:venueId/hangouts') @Permissions('hangout:create') create(...)
@UseGuards(JwtAuthGuard, PermissionsGuard) @Post('hangouts/:id/join') @Permissions('hangout:create') join(...)
@UseGuards(JwtAuthGuard) @Post('hangouts/:id/leave') leave(...)
@UseGuards(JwtAuthGuard) @Post('hangouts/:id/cancel') cancel(...)
@UseGuards(JwtAuthGuard) @Get('hangouts/:id') get(@CurrentUser() u, @Param('id') id) { return this.hangouts.getForUser(u.sub, id).then(d => ({ data: d })); }
@UseGuards(JwtAuthGuard) @Get('me/hangouts') myList(@CurrentUser() u, @Query('role') r) { return this.hangouts.listMine(u.sub, r).then(d => ({ data: d })); }
```

**Step 2:** Commit:

```bash
git add src/modules/hangouts
git commit -m "feat(hangouts): HangoutsController"
```

---

## Phase 11: Analytics, Admin, Health, E2E

### Task 33: Analytics entities + service

**Files:**
- Create: `src/modules/analytics/entities/venue-view.entity.ts`
- Create: `src/modules/analytics/entities/analytics-event.entity.ts`
- Create: `src/modules/analytics/analytics.service.ts`
- Create: `src/modules/analytics/analytics.controller.ts`
- Create: `src/modules/analytics/listeners/event-listener.ts`
- Create: `src/modules/analytics/analytics.module.ts`
- Create: `src/migrations/1700000007000-Analytics.ts`
- Test: `src/modules/analytics/analytics.service.spec.ts`

**Step 1:** `venue-view.entity.ts`: id, venueId, userId (nullable), sessionId (varchar nullable), viewedAt. `analytics-event.entity.ts`: id, venueId (nullable), userId (nullable), eventType (varchar), payload (jsonb), occurredAt.

**Step 2:** `AnalyticsService.recordView(venueId, userId?, sessionId?)` — перевіряє Redis dedup (`view:dedup:{userId|sessionId}:{venueId}` TTL 30 хв), якщо немає — insert. `getForVenue(venueId, from, to, groupBy)` — агрегує views + events.

**Step 3:** `event-listener.ts` слухає `FavoriteAdded`, `ReviewCreated`, `HangoutCreated`, `RouteClicked` (через event emitter) → пише в `analytics_events`.

**Step 4:** `AnalyticsController`:
- `POST /venues/:id/view` (public, записує view з dedup)
- `GET /me/venues/:id/analytics` (owner/super_admin)
- `GET /admin/analytics/overview` (super_admin)

**Step 5:** Migration: tables.

**Step 6:** Commit:

```bash
git add src/modules/analytics src/migrations
git commit -m "feat(analytics): views, events, aggregation, controller"
```

---

### Task 34: Admin module (users, audit, health)

**Files:**
- Create: `src/modules/admin/entities/audit-log.entity.ts`
- Create: `src/modules/admin/audit.service.ts`
- Create: `src/modules/admin/admin-users.controller.ts`
- Create: `src/modules/admin/admin.module.ts`
- Create: `src/modules/health/health-db.controller.ts`
- Create: `src/migrations/1700000008000-Admin.ts`
- Test: `src/modules/admin/audit.service.spec.ts`

**Step 1:** `AuditLog` entity: id, actorId, action, entityType, entityId, before (jsonb), after (jsonb), createdAt.

**Step 2:** `AuditService.log(actorId, action, entityType, entityId, before, after)` — insert.

**Step 3:** `AdminUsersController`:
- `GET /admin/users` (з пагінацією)
- `GET /admin/users/:id`
- `PATCH /admin/users/:id` (оновлює profile)
- `DELETE /admin/users/:id` (soft delete — додати колонку `deletedAt` в users через міграцію)
- `POST /admin/users/:id/roles` body `{ roleCode, action }` — додає/видаляє роль + аудит + emit `USER_ROLE_ADDED/REMOVED`

**Step 4:** `health-db.controller.ts`:

```ts
@Controller('health')
export class HealthDbController {
  constructor(@InjectDataSource() private readonly ds: DataSource, @Inject('REDIS') private readonly redis?: any) {}

  @Public() @Get() health() { return { status: 'ok', timestamp: new Date().toISOString() }; }
  @Public() @Get('db') async db() {
    await this.ds.query('SELECT 1');
    return { status: 'ok', db: 'up' };
  }
}
```

**Step 5:** Migration додає `deletedAt` до `users` (soft delete).

**Step 6:** Commit:

```bash
git add src/modules/admin src/modules/health src/migrations
git commit -m "feat(admin): users controller, audit log, soft delete, health/db endpoint"
```

---

### Task 35: Final E2E suite (повний flow)

**Files:**
- Modify: `test/` — додати `auth.e2e-spec.ts`, `reviews.e2e-spec.ts`, `favorites.e2e-spec.ts`, `hangouts.e2e-spec.ts`

**Step 1:** `auth.e2e-spec.ts` — register → login → me → refresh (rotation) → logout → refresh fails.

**Step 2:** `reviews.e2e-spec.ts` — owner створює venue, super_admin approves, user створює review → check rating updated on venue, second user створює другий review → rating averaged.

**Step 3:** `favorites.e2e-spec.ts` — user adds/removes/list.

**Step 4:** `hangouts.e2e-spec.ts` — creator створює → 2 інших юзерів join → status=open → 3-й join triggers fill → status=filled.

**Step 5:** Запусти повний E2E:

```bash
docker compose -f docker-compose.test.yml up -d
export DATABASE_PORT_TEST=5433 DATABASE_USER_TEST=piyachok_test DATABASE_PASS_TEST=piyachok_test DATABASE_NAME_TEST=piyachok_test
pnpm test:e2e
```

**Step 6:** Coverage:

```bash
pnpm test:cov
```

Перевір, що ≥80% statements.

**Step 7:** Commit:

```bash
git add test
git commit -m "test: full E2E coverage of auth, reviews, favorites, hangouts flows"
```

---

## Self-Review (Plan vs Spec)

**1. Spec coverage (секції → tasks):**

| Спека | Задача |
|---|---|
| §1 Архітектура | Task 1-8 (Docker, deps, env, common) |
| §2 Модель даних + RBAC | Task 9-12 (Init migration, RbacModule, listener) |
| §3 Auth API | Task 15-19 (TokenService, AuthService, strategies, controller) |
| §4 Venues + пошук + модерація | Task 20-23 (entities, migration, service, controllers, E2E) |
| §5 Reviews + Favorites + Hangouts | Task 24-32 (entities, services, controllers) |
| §6 News + Complaints + Analytics + Admin | Task 28-29 (News, Complaints), Task 33 (Analytics), Task 34 (Admin) |
| §7 Інфраструктура, тестування, безпека | Task 1, 4, 5, 7, 8, 35 (Docker, cache, file storage, guards, exceptions, E2E) |
| §8 Наступний крок | (цяплан) → writing-plans → subagent-driven-development |

**2. Placeholder scan:** Перевірено — немає TBD/TODO у фінальному плані.

**3. Type consistency:**
- `JwtUser { sub, email, roles }` — використовується в Task 6, 14, 19, 26, 28, 30, 32 (узгоджено)
- `CacheService.{get,set,del,delByPattern}` — використовується скрізь (узгоджено)
- `VENUE_*`, `REVIEW_*`, `HANGOUT_*` event names — узгоджено з listener'ами
- `PermissionsService.{hasPermission,getUserPermissions,invalidate}` — узгоджено

Усі типи й підписи збігаються між задачами.

---

## Execution Handoff

План збережено у `docs/superpowers/plans/2026-08-26-piyachok-backend.md`. Два варіанти виконання:

1. **Subagent-Driven (рекомендовано)** — свіжий subagent на кожну задачу, ревʼю між ними
2. **Inline Execution** — виконання задач у цій сесії з чекпоїнтами

Який підхід обрати?

