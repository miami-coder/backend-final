import { typeOrmAsyncConfig } from './typeorm.config';
import { ConfigService } from '@nestjs/config';

function mockConfig(vars: Record<string, string>): ConfigService {
  return { get: <K = string>(key: string) => vars[key] as K } as unknown as ConfigService;
}

describe('typeOrmAsyncConfig', () => {
  it('builds a postgres config from env', () => {
    const cfg = (typeOrmAsyncConfig.useFactory as (c: ConfigService) => object)(
      mockConfig({
        DATABASE_HOST: 'dbhost',
        DATABASE_PORT: '5433',
        DATABASE_USER: 'u',
        DATABASE_PASS: 'p',
        DATABASE_NAME: 'd',
        NODE_ENV: 'development',
      }),
    );
    expect(cfg).toMatchObject({
      type: 'postgres',
      host: 'dbhost',
      port: 5433,
      username: 'u',
      password: 'p',
      database: 'd',
      autoLoadEntities: true,
      synchronize: false,
      migrationsRun: false,
      migrations: ['dist/migrations/*.js'],
    });
    expect((cfg as { logging: unknown }).logging).toEqual(['error', 'warn']);
  });

  it('disables logging outside development', () => {
    const cfg = (typeOrmAsyncConfig.useFactory as (c: ConfigService) => object)(
      mockConfig({ DATABASE_HOST: 'h', DATABASE_PORT: '5432', DATABASE_USER: 'x', DATABASE_PASS: 'y', DATABASE_NAME: 'z', NODE_ENV: 'production' }),
    );
    expect((cfg as { logging: unknown }).logging).toBe(false);
  });
});
