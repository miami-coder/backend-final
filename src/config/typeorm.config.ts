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
    logging:
      config.get<string>('NODE_ENV') === 'development'
        ? ['error', 'warn']
        : false,
  }),
};
