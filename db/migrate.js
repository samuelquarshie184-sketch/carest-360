import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required for database migrations.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});

try {
  const schema = await readFile(join(__dirname, 'schema.sql'), 'utf8');
  const accounting = await readFile(join(__dirname, 'accounting.sql'), 'utf8');
  await pool.query(schema);
  await pool.query(accounting);
  console.log('CAREST 360 database and accounting schema are ready.');
} finally {
  await pool.end();
}
