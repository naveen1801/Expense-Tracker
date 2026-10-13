import fs from 'fs/promises';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
// DB_PASSWORD may be intentionally empty on some local MySQL setups,
// so we only treat it as missing when it's truly undefined.
const missing = required.filter((k) => process.env[k] === undefined);
if (missing.length) {
  throw new Error(`Missing environment variables: ${missing.join(', ')}. Update .env first.`);
}

const DB_NAME_SAFE = String(process.env.DB_NAME);
if (!/^[A-Za-z0-9_]+$/.test(DB_NAME_SAFE)) {
  throw new Error(`Unsafe DB_NAME value: ${DB_NAME_SAFE}`);
}

const sqlPath = new URL('./database.sql', import.meta.url);
const sql = await fs.readFile(sqlPath, 'utf8');

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  // Cloud MySQL (Aiven, TiDB Cloud, ...) needs TLS. Aiven also needs its CA certificate in DB_SSL_CA.
  ...(process.env.DB_SSL === 'true'
    ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true, ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n') } : {}) } }
    : {}),
  user: process.env.DB_USER,
  // Only pass password when non-empty.
  password: process.env.DB_PASSWORD || undefined,
  // If DB doesn't exist yet, we still try to connect to MySQL server first.
  database: undefined,
  multipleStatements: true,
});

try {
  await conn.query(`CREATE DATABASE IF NOT EXISTS ${DB_NAME_SAFE};`);
  await conn.query(`USE ${DB_NAME_SAFE};`);
  // Execute schema statements (users, expenses).
  await conn.query(sql);
  console.log('Database setup complete.');
} finally {
  await conn.end();
}

