import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const dotenvResult = dotenv.config();
if (dotenvResult?.error) {
  throw new Error(
    `Missing .env file in the project root. Expected at: ${process.cwd()}\\/.env`,
  );
}

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

