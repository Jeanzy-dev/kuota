import { db } from '../src/server/db';
import { ensureDemoSeedData } from '../src/server/index';

async function main() {
  console.log('[Seed] Inicializando esquema y semilla de datos PostgreSQL...');
  await db.init();
  await ensureDemoSeedData();
  console.log('[Seed] Datos semilla (demo@kuota.app / Demo123456!) verificados exitosamente.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[Seed Error]', err);
  process.exit(1);
});
