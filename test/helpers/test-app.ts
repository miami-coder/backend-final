import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { DataSource } from 'typeorm';
import { execSync } from 'child_process';

export async function bootstrapTestApp(): Promise<{
  app: INestApplication;
  module: TestingModule;
}> {
  process.env.DATABASE_HOST = process.env.DATABASE_HOST ?? 'localhost';
  process.env.DATABASE_PORT = process.env.DATABASE_PORT_TEST ?? '5433';
  process.env.DATABASE_USER = process.env.DATABASE_USER_TEST ?? 'piyachok_test';
  process.env.DATABASE_PASS = process.env.DATABASE_PASS_TEST ?? 'piyachok_test';
  process.env.DATABASE_NAME = process.env.DATABASE_NAME_TEST ?? 'piyachok_test';
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
  await ds.query('DROP SCHEMA IF EXISTS public CASCADE');
  await ds.query('CREATE SCHEMA public');
  await ds.destroy();
  execSync(
    'pnpm typeorm-ts-node-commonjs -d src/config/data-source.ts migration:run',
    {
      env: {
        ...process.env,
        DATABASE_PORT: process.env.DATABASE_PORT_TEST ?? '5433',
        DATABASE_USER: 'piyachok_test',
        DATABASE_PASS: 'piyachok_test',
        DATABASE_NAME: 'piyachok_test',
      },
      stdio: 'inherit',
    },
  );

  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  return { app, module };
}

export function getAuthToken(response: any): string {
  return response.body.accessToken;
}
