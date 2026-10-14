import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';

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

  // Кредів БД немає у дефолтах: задаються лише через .env (можуть відрізнятись між середовищами)
  @IsString() @IsNotEmpty() DATABASE_USER!: string;
  @IsString() @IsNotEmpty() DATABASE_PASS!: string;
  @IsString() @IsNotEmpty() DATABASE_NAME!: string;

  @IsString() REDIS_HOST: string = 'localhost';
  @IsNumber() REDIS_PORT: number = 6379;

  // Секрети обов'язкові і не мають дефолтів: без них конфігурація не повинна валідуватись
  @IsString() @IsNotEmpty() @MinLength(16) JWT_ACCESS_SECRET!: string;
  @IsString() @IsNotEmpty() @MinLength(16) JWT_REFRESH_SECRET!: string;
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
  const validated = plainToInstance(EnvVars, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length) {
    throw new Error(`Env validation failed: ${errors.toString()}`);
  }
  return validated;
}
