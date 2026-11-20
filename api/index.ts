import type { IncomingMessage, ServerResponse } from 'http';
import { app, ensureDemoSeedData } from '../src/server/index';
import { db } from '../src/server/db';

let isInitialized = false;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (!isInitialized) {
      await db.init();
      await ensureDemoSeedData().catch((seedErr) => {
        console.warn('[Vercel Seed Warning]', seedErr?.message);
      });
      isInitialized = true;
    }
    return app(req as any, res as any);
  } catch (err: any) {
    console.error('[Vercel Handler Error]', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        error: err?.message || 'Error interno en la función Serverless de Vercel',
      })
    );
  }
}
