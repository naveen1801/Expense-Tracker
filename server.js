

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './src/routes/auth.js';
import expenseRoutes from './src/routes/expenses.js';
import budgetRoutes from './src/routes/budgets.js';
import pool from './src/db.js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Expense Tracker API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/budgets', budgetRoutes);

// Serve the built frontend (frontend/dist) so one server hosts the whole app.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get(/^(?!\/api).*/, (req, res, next) => {
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

async function start() {
  try {
    // Validate DB credentials early so you get a clear error.
    const conn = await pool.getConnection();
    conn.release();
    console.log('MySQL connected successfully');
  } catch (err) {
    console.error(
      'MySQL connection failed. Check your .env values (DB_HOST/DB_USER/DB_PASSWORD/DB_NAME).',
    );
    console.error(err?.message || err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
  });
}

start();

