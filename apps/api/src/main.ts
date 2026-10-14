import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Локальний режим: роздача uploads з диска + Swagger не на проді.
  // На Vercel-серверлесі аналогічний конфіг живе в api/index.ts.
  configureApp(app, {
    staticUploads: true,
    swagger: process.env.NODE_ENV !== 'production',
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}
void bootstrap();