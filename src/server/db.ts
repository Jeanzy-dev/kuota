import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export interface DbQueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

class DatabaseManager {
  private pgPool: Pool | null = null;
  private pglite: PGlite | null = null;
  private initialized = false;
  private mode: 'POSTGRES_SERVER' | 'PGLITE_EMBEDDED' = 'PGLITE_EMBEDDED';

  public getMode() {
    return this.mode;
  }

  public async init(): Promise<void> {
    if (this.initialized) return;

    const dbUrl = (process.env.DATABASE_URL || '').trim();
    const useExternalPg =
      dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

    if (useExternalPg) {
      try {
        const pool = new Pool({
          connectionString: dbUrl,
          connectionTimeoutMillis: 3500,
          ssl:
            process.env.NODE_ENV === 'production' && !dbUrl.includes('localhost')
              ? { rejectUnauthorized: false }
              : undefined,
        });
        await pool.query('SELECT 1');
        this.pgPool = pool;
        this.mode = 'POSTGRES_SERVER';
        await this.ensureSchema();
        this.initialized = true;
        console.log('[DB] Conectado exitosamente a servidor PostgreSQL externo (DATABASE_URL).');
        return;
      } catch (err: any) {
        if (process.env.NODE_ENV === 'production') {
          console.error('[DB] Error conectando a DATABASE_URL en producción:', err.message);
          throw err;
        }
        console.warn(
          `[DB] No se detectó servidor PostgreSQL activo en ${dbUrl} (${err.message}). Iniciando motor PostgreSQL embebido persistente (PGlite)...`
        );
      }
    }

    // Fallback o modo local persistente con motor PostgreSQL real (PGlite)
    const dataDir =
      process.env.PGLITE_DATA_DIR === 'memory://'
        ? undefined
        : path.resolve(process.cwd(), process.env.PGLITE_DATA_DIR || '.pgdata');

    this.pglite = new PGlite(dataDir);
    await this.pglite.waitReady;
    this.mode = 'PGLITE_EMBEDDED';
    await this.ensureSchema();
    this.initialized = true;
    console.log(
      `[DB] Motor PostgreSQL persistente inicializado (${dataDir ? dataDir : 'in-memory'}).`
    );
  }

  private async ensureSchema(): Promise<void> {
    // Verificamos si la tabla "users" ya existe en PostgreSQL
    const check = await this.rawQuery<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      ) as exists;`
    );

    const exists = check.rows[0]?.exists === true || (check.rows[0] as any)?.exists === 't';
    if (!exists) {
      const migrationPath = path.resolve(
        process.cwd(),
        'prisma/migrations/20260101000000_init/migration.sql'
      );
      if (fs.existsSync(migrationPath)) {
        const sql = fs.readFileSync(migrationPath, 'utf-8');
        if (this.pgPool) {
          await this.pgPool.query(sql);
        } else if (this.pglite) {
          await this.pglite.exec(sql);
        }
        console.log('[DB] Esquema relacional PostgreSQL (SRS Sección 5) aplicado correctamente.');
      }
    }
  }

  private async rawQuery<T = any>(sql: string, params: any[] = []): Promise<DbQueryResult<T>> {
    if (this.pgPool) {
      const res = await this.pgPool.query(sql, params);
      return { rows: res.rows as T[], rowCount: res.rowCount || 0 };
    }
    if (this.pglite) {
      const res = await this.pglite.query<T>(sql, params);
      return { rows: res.rows, rowCount: res.rows.length };
    }
    throw new Error('Base de datos no inicializada');
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<DbQueryResult<T>> {
    if (!this.initialized) {
      await this.init();
    }
    return this.rawQuery<T>(sql, params);
  }
}

export const db = new DatabaseManager();
