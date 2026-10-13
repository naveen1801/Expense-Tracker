import express from 'express';
import pool from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { schemas, validate } from '../utils/validators.js';

const router = express.Router();

router.use(authRequired);

function buildExpenseWhere({ from, to, category, minAmount, maxAmount, q }, userId) {
  const conditions = ['user_id = ?'];
  const params = [userId];

  if (from) {
    conditions.push('date >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('date <= ?');
    params.push(to);
  }
  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }
  if (typeof minAmount === 'number') {
    conditions.push('amount >= ?');
    params.push(minAmount);
  }
  if (typeof maxAmount === 'number') {
    conditions.push('amount <= ?');
    params.push(maxAmount);
  }
  if (q) {
    const like = `%${q}%`;
    conditions.push('(note LIKE ? OR category LIKE ?)');
    params.push(like, like);
  }

  return { where: conditions.join(' AND '), params };
}

router.post('/', async (req, res) => {
  const { amount, category, date, note } = req.body;
  try {
    // Validate input
    validate(schemas.expenseCreateBody, { amount, category, date, note });

    const [result] = await pool.query(
      'INSERT INTO expenses (user_id, amount, category, date, note) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, amount, category, date, note || null],
    );
    return res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ message: err.message || 'Could not add expense' });
  }
});

router.get('/', async (req, res) => {
  const query = validate(schemas.expenseQuery, req.query);
  const { where, params } = buildExpenseWhere(query, req.user.id);
  try {
    const [rows] = await pool.query(
      `SELECT id, amount, category, date, note
       FROM expenses
       WHERE ${where}
       ORDER BY date DESC`,
      params,
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ message: err.message || 'Could not fetch expenses' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM expenses WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id],
    );
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Not found' });
    }
    return res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not delete expense' });
  }
});

router.get('/summary/basic', async (req, res) => {
  try {
    const query = validate(schemas.expenseQuery, req.query);
    const { where, params } = buildExpenseWhere(query, req.user.id);

    const [totals] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS totalExpense
       FROM expenses
       WHERE ${where}`,
      params,
    );
    const [byCategory] = await pool.query(
      `SELECT category, COALESCE(SUM(amount),0) AS total
       FROM expenses
       WHERE ${where}
       GROUP BY category
       ORDER BY total DESC`,
      params,
    );
    return res.json({ totalExpense: totals[0].totalExpense, byCategory });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ message: err.message || 'Could not compute summary' });
  }
});

// Pie chart data: category distribution
router.get('/charts/categories', async (req, res) => {
  try {
    const query = validate(schemas.expenseQuery, req.query);
    const { where, params } = buildExpenseWhere(query, req.user.id);

    const [byCategory] = await pool.query(
      `SELECT category, COALESCE(SUM(amount),0) AS total
       FROM expenses
       WHERE ${where}
       GROUP BY category
       ORDER BY total DESC`,
      params,
    );

    return res.json({ byCategory });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ message: err.message || 'Could not compute categories' });
  }
});

// Line chart data: monthly trends
router.get('/charts/trends', async (req, res) => {
  try {
    const query = validate(schemas.expenseQuery, req.query);

    // Default to last 6 months if from/to not provided.
    const now = new Date();
    const toDate = query.to ? new Date(query.to) : new Date(now);
    const fromDate = query.from
      ? new Date(query.from)
      : new Date(new Date(now).setMonth(now.getMonth() - 5));

    // Make sure we use YYYY-MM-DD strings for MySQL comparison.
    const pad = (n) => String(n).padStart(2, '0');
    const toStr = `${toDate.getFullYear()}-${pad(toDate.getMonth() + 1)}-${pad(toDate.getDate())}`;
    const fromStr = `${fromDate.getFullYear()}-${pad(fromDate.getMonth() + 1)}-${pad(fromDate.getDate())}`;

    const conditions = ['user_id = ?', 'date >= ?', 'date <= ?'];
    const params = [req.user.id, fromStr, toStr];

    // Optional category filter to keep the chart more useful.
    if (query.category) {
      conditions.push('category = ?');
      params.push(query.category);
    }

    const where = conditions.join(' AND ');

    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(date, '%Y-%m') AS yearMonth,
              COALESCE(SUM(amount), 0) AS total
       FROM expenses
       WHERE ${where}
       GROUP BY yearMonth
       ORDER BY yearMonth ASC`,
      params,
    );

    return res.json({
      from: fromStr,
      to: toStr,
      trends: rows.map((r) => ({ yearMonth: r.yearMonth, totalExpense: Number(r.total) })),
    });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ message: err.message || 'Could not compute trends' });
  }
});

export default router;

