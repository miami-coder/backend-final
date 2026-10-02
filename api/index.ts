import { NestFactory } from '@nestjs/core';
// Явний трейсований імпорт: TypeORM завантажує pg через динамічний
// require (PlatformTools.load) — трейсер @vercel/node його не бачить і не
// пакує pg у лямбду → DriverPackageNotInstalledError. Переконатися заздалегідь.
import 'pg';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

/**
 * Vercel-серверлес вхід для Nest API. Екземпляр кешується між
 * warm-інвокаціями: перший запит піднімає Nest-додаток, далі він сніпшетиться.
 *
 * @vercel/node передає в хендлер звичайні Node req/res, а сам Express-інстанс
 * і є Node-хендлером — обгортка @vendia/serverless-express тут не потрібна
 * (вона чекає AWS-пейлоади і кидає Unable to determine event source).
 */
type NodeHandler = (req: unknown, res: unknown) => void;

let handlerPromise: Promise<NodeHandler> | undefined;

async function getHandler(): Promise<NodeHandler> {
  if (!handlerPromise) {
    handlerPromise = (async () => {
      const expressApp = express();
      const adapter = new ExpressAdapter(expressApp);
      const app = await NestFactory.create(AppModule, adapter, {
        bufferLogs: true,
      });
      ///uploads роздача не потрібна: на проді — Vercel Blob, локально — main.ts.
      configureApp(app, { staticUploads: false, swagger: false });
      await app.init();
      return expressApp as unknown as NodeHandler;
    })().catch((err) => {
      handlerPromise = undefined;
      throw err;
    });
  }
  return handlerPromise;
}

export async function handler(req: unknown, res: unknown): Promise<void> {
  const handle = await getHandler();
  return handle(req, res);
}

export default handler;