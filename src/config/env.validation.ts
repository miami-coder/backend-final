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

  @IsString() JWT_ACCESS_SECRET: string =
    'dev_access_secret_min_32_chars_xxxxxx';
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
  const validated = plainToInstance(EnvVars, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length) {
    throw new Error(`Env validation failed: ${errors.toString()}`);
  }
  return validated;
}
