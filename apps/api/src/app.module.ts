import { Module, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv } from './config/env.validation';
import { typeOrmAsyncConfig } from './config/typeorm.config';
import { HealthModule } from './modules/health/health.module';
import { CommonModule } from './common/common.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { VenuesModule } from './modules/venues/venues.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { NewsModule } from './modules/news/news.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { HangoutsModule } from './modules/hangouts/hangouts.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { MessagesModule } from './modules/messages/messages.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.' }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'debug',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty' },
      },
      // path-to-regexp v8 (Express 5) більше не приймає «голий» wildcard `*`,
      // який nestjs-pino реєструє за замовчуванням. Разом із глобальним префіксом
      // він перетворювався на `/api/v1/*` і спричиняв warning LegacyRouteConverter.
      // Використовуємо синтаксис named-wildcard, щоб зареєструвати той самий
      // catch-all без warning-у.
      forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
    }),
    CommonModule,
    HealthModule,
    RbacModule,
    AuthModule,
    UsersModule,
    VenuesModule,
    ReviewsModule,
    FavoritesModule,
    NewsModule,
    ComplaintsModule,
    HangoutsModule,
    AnalyticsModule,
    MessagesModule,
    AdminModule,
  ],
})
export class AppModule {}
