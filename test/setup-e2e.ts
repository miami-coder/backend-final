// Runs in each e2e worker BEFORE any test file is imported. AppModule's
// ConfigModule.forRoot() caches validated env at import time (it parses .env
// via dotenv.parse and merges process.env on top), so DATABASE_* must be set
// here — before `import { AppModule }` executes — not inside beforeAll.
process.env.DATABASE_HOST = process.env.DATABASE_HOST ?? 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT_TEST ?? '5433';
process.env.DATABASE_USER = process.env.DATABASE_USER_TEST ?? 'piyachok_test';
process.env.DATABASE_PASS = process.env.DATABASE_PASS_TEST ?? 'piyachok_test';
process.env.DATABASE_NAME = process.env.DATABASE_NAME_TEST ?? 'piyachok_test';
process.env.REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT_TEST ?? '6380';
