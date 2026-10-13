import express from 'express';
import pool from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { schemas, validate } from '../utils/validators.js';

const router = express.Router();
router.use(authRequired);

function currentYearMonth() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

async function getMonthlyExpenseTotal(userId, yearMonth) {
  const [rows] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM expenses
     WHERE user_id = ?
       AND DATE_FORMAT(date, '%Y-%m') = ?`,
    [userId, yearMonth],
  );
  return Number(rows[0].total);
}

router.get('/current', async (req, res) => {
  const yearMonth = currentYearMonth();
  try {
    const [budgetRows] = await pool.query(
      'SELECT monthly_limit FROM budgets AS b WHERE b.user_id = ? AND b.`year_month` = ?',
      [req.user.id, yearMonth],
    );

    const totalExpense = await getMonthlyExpenseTotal(req.user.id, yearMonth);
    const monthlyLimit = budgetRows[0]?.monthly_limit ?? 0;
    const remaining = monthlyLimit - totalExpense;

    return res.json({ yearMonth, monthlyLimit, totalExpense, remaining });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Could not fetch budget' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { yearMonth, monthlyLimit } = validate(schemas.budgetUpsertBody, req.body);

    // Upsert the budget for a month.
    await pool.query(
      `INSERT INTO budgets (user_id, \`year_month\`, monthly_limit)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE monthly_limit = VALUES(monthly_limit)`,
      [req.user.id, yearMonth, monthlyLimit],
    );

    const totalExpense = await getMonthlyExpenseTotal(req.user.id, yearMonth);
    const remaining = monthlyLimit - totalExpense;

    return res.status(200).json({ yearMonth, monthlyLimit, totalExpense, remaining });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ message: err.message || 'Could not set budget' });
  }
});

export default router;

