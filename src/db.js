import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load .env when present (local dev). On a host like Render, variables come from the dashboard.
dotenv.config();

// Fail fast with a clear error when env vars are missing.
// This avoids confusing MySQL "password: NO" errors caused by an absent `.env`.
const missing = [];
if (!process.env.DB_HOST) missing.push('DB_HOST');
if (!process.env.DB_USER) missing.push('DB_USER');
if (process.env.DB_PASSWORD === undefined) missing.push('DB_PASSWORD');
if (!process.env.DB_NAME) missing.push('DB_NAME');

if (missing.length) {
  throw new Error(
    `Missing environment variables: ${missing.join(
      ', ',
    )}. Create a .env file in the project root.`,
  );
}

const poolConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  // Cloud MySQL (Aiven, TiDB Cloud, ...) needs TLS. Aiven also needs its CA certificate in DB_SSL_CA.
  ...(process.env.DB_SSL === 'true'
    ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true, ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n') } : {}) } }
    : {}),
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
};

// Only pass password to mysql2 when it's non-empty.
// This helps with local setups where MySQL root has no password configured.
if (process.env.DB_PASSWORD) {
  poolConfig.password = process.env.DB_PASSWORD;
}

const pool = mysql.createPool(poolConfig);

export default pool;

