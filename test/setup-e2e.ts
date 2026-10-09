// Виконується в кожному e2e-воркері ДО імпорту будь-якого тестового файлу.
// ConfigModule.forRoot() AppModuleʼа кешує валідований config у момент імпорту
// (парсить .env через dotenv.parse і зливає process.env зверху), тому DATABASE_*
// треба задати тут — до виконання `import { AppModule }`, а не в beforeAll.
process.env.DATABASE_HOST = process.env.DATABASE_HOST ?? 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT_TEST ?? '5433';
process.env.DATABASE_USER = process.env.DATABASE_USER_TEST ?? 'piyachok_test';
process.env.DATABASE_PASS = process.env.DATABASE_PASS_TEST ?? 'piyachok_test';
process.env.DATABASE_NAME = process.env.DATABASE_NAME_TEST ?? 'piyachok_test';
process.env.REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT_TEST ?? '6380';
