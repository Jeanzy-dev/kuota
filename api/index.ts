import type { IncomingMessage, ServerResponse } from 'http';

let isInitialized = false;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const { app, ensureDemoSeedData } = await import('../src/server/index');
    const { db } = await import('../src/server/db');

    if (!isInitialized) {
      await db.init();
      await ensureDemoSeedData().catch((seedErr: any) => {
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
        stack: err?.stack,
      })
    );
  }
}
