import { Logger } from 'nestjs-pino';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import express from 'express';
import { join } from 'path';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/**
 * Спільне налаштування додатку для класичного бутстрапа (main.ts) і
 * Vercel-серверлес входу (api/index.ts): логер, middleware, CORS, префікс,
 * валідаційні пайпи, глобальний фільтр. Swagger монтується лише поза production.
 */
export function configureApp(
  app: INestApplication,
  mounts: { staticUploads?: boolean; swagger?: boolean } = {},
): void {
  const { staticUploads = true, swagger = true } = mounts;

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
  // Фільтр жодним модулем не провайдиться (залежностей у конструктора немає),
  // тому app.get(AllExceptionsFilter) кидає Nest could not find ... — інстанціюємо напряму.
  app.useGlobalFilters(new AllExceptionsFilter());

  if (staticUploads) {
    // Роздача завантажених файлів: /static/* з uploads (локальний дисковий режим;
    // у blob-режимі на проді файли роздаються напряму з Vercel Blob).
    app.use(
      '/static',
      express.static(process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads')),
    );
  }

  if (swagger && process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Piyachok API')
      .setDescription('REST API for the Piyachok venues / hangouts platform')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      useGlobalPrefix: true,
      swaggerOptions: { persistAuthorization: true },
    });
  }
}