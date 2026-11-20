import type { IncomingMessage, ServerResponse } from 'http';
import { app, ensureDemoSeedData } from '../src/server/index';
import { db } from '../src/server/db';

let isInitialized = false;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!isInitialized) {
    await db.init();
    await ensureDemoSeedData();
    isInitialized = true;
  }
  return app(req as any, res as any);
}
