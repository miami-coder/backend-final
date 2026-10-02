import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import serverlessExpress from '@vendia/serverless-express';
import express from 'express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

/**
 * Vercel-серверлес вхід для Nest API. Екземпляр кешується між
 * warm-інвокаціями: перший запит піднімає Nest-додаток, далі він сніпшетиться.
 */
type ServerlessHandler = (req: unknown, res: unknown) => Promise<unknown>;

let handlerPromise: Promise<ServerlessHandler> | undefined;

async function getHandler(): Promise<ServerlessHandler> {
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
      return serverlessExpress({ app: expressApp }) as ServerlessHandler;
    })().catch((err) => {
      handlerPromise = undefined;
      throw err;
    });
  }
  return handlerPromise;
}

export async function handler(req: unknown, res: unknown): Promise<unknown> {
  const handle = await getHandler();
  return handle(req, res);
}

export default handler;