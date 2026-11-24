import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createApp } from './app.js';

const schema = readFileSync(fileURLToPath(new URL('../schema.sql', import.meta.url)), 'utf8');
const { DATABASE_URL, JWT_SECRET, CORS_ORIGIN = '*', PORT = 8787, ADMIN_EMAIL } = process.env;

async function getDb() {
  if (DATABASE_URL) {
    const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: /sslmode=disable|localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false } });
    await pool.query(schema);
    return pool;
  }
  // Development fallback: in-memory PostgreSQL emulation. Data is lost on restart.
  console.warn('[netlab] DATABASE_URL not set — using an in-memory database (development only).');
  const { newDb } = await import('pg-mem');
  const mem = newDb();
  mem.public.none(schema);
  const { Pool } = mem.adapters.createPg();
  return new Pool();
}

if (!JWT_SECRET) {
  console.error('[netlab] JWT_SECRET is required (32+ random characters). Example: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  process.exit(1);
}

const db = await getDb();
if (ADMIN_EMAIL) await db.query("UPDATE users SET role = 'admin' WHERE email = $1", [ADMIN_EMAIL.toLowerCase()]);
createApp({ db, jwtSecret: JWT_SECRET, corsOrigin: CORS_ORIGIN }).listen(PORT, () => console.log(`[netlab] API listening on :${PORT}`));
