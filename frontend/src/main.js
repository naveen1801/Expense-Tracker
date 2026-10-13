import './tailwind-overrides.css';
import { createApi, toQueryString } from './utils/api.js';
import { renderCategoriesPie, renderMonthlyTrendsLine } from './utils/charts.js';

const app = document.querySelector('#app');
const API_BASE = 'http://localhost:4000/api';

const CATEGORIES = ['Food', 'Travel', 'Bills', 'Shopping', 'Other'];

const state = {
  token: null,
  user: null,
  loading: false,
  error: '',
  expenses: [],
  summary: null,
  charts: {
    byCategory: [],
    trends: [],
  },
  budget: null,
  view: 'dashboard',
  authMode: 'login',
  filters: {
    from: '',
    to: '',
    category: '',
    minAmount: '',
    maxAmount: '',
    q: '',
  },
};

const api = createApi({
  baseUrl: API_BASE,
  getToken: () => state.token,
});

let searchTimer = null;

function setError(msg) {
  state.error = msg || '';
}

function setAuthMode(mode) {
  state.authMode = mode;
  state.error = '';
  render();
}

function currentYearMonth() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function formatINR(n) {
  const num = Number(n) || 0;
  return `₹${num.toFixed(2)}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  // dateStr is expected as YYYY-MM-DD
  const [y, m, d] = String(dateStr).split('-').map((x) => Number(x));
  if (!y || !m || !d) return dateStr;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function filtersToQuery(filters) {
  const query = {};
  if (filters.from) query.from = filters.from;
  if (filters.to) query.to = filters.to;
  if (filters.category) query.category = filters.category;
  if (filters.minAmount !== '') query.minAmount = Number(filters.minAmount);
  if (filters.maxAmount !== '') query.maxAmount = Number(filters.maxAmount);
  if (filters.q) query.q = filters.q;
  return query;
}

function syncLocalAuth() {
  if (state.token) {
    localStorage.setItem('token', state.token);
    localStorage.setItem('user', JSON.stringify(state.user));
  } else {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
}

async function refreshAll() {
  if (!state.token) return;
  setError('');
  state.loading = true;
  render();

  try {
    const expenseQuery = filtersToQuery(state.filters);
    const trendsQuery = {
      from: state.filters.from || undefined,
      to: state.filters.to || undefined,
      category: state.filters.category || undefined,
    };

    const [expenses, summary, categoriesRes, trendsRes] = await Promise.all([
      api.request(`/expenses${toQueryString(expenseQuery)}`),
      api.request(`/expenses/summary/basic${toQueryString(expenseQuery)}`),
      api.request(`/expenses/charts/categories${toQueryString(expenseQuery)}`),
      api.request(`/expenses/charts/trends${toQueryString(trendsQuery)}`),
    ]);

    state.expenses = expenses || [];
    state.summary = summary || null;
    state.charts.byCategory = categoriesRes?.byCategory || [];
    state.charts.trends = trendsRes?.trends || [];

    // Budget is optional; if it fails (e.g., table not created yet),
    // show the rest of the dashboard anyway.
    try {
      const budget = await api.request('/budgets/current');
      state.budget = budget || null;
    } catch (e) {
      state.budget = null;
    }
  } catch (err) {
    console.error(err);
    state.expenses = [];
    state.summary = null;
    state.charts.byCategory = [];
    state.charts.trends = [];
    state.budget = null;
    setError(err.message || 'Something went wrong');
  } finally {
    state.loading = false;
    render();
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const form = e.target;
  const email = form.email.value;
  const password = form.password.value;
  try {
    setError('');
    const data = await api.request('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    state.token = data.token;
    state.user = data.user;
    syncLocalAuth();
    form.reset();
    await refreshAll();
  } catch (err) {
    setError(err.message || 'Login failed');
    render();
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const form = e.target;
  const name = form.name.value;
  const email = form.email.value;
  const password = form.password.value;
  try {
    setError('');
    await api.request('/auth/register', {
      method: 'POST',
      body: { name, email, password },
    });

    // Auto-login after successful registration.
    const data = await api.request('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    state.token = data.token;
    state.user = data.user;
    syncLocalAuth();
    form.reset();
    await refreshAll();
  } catch (err) {
    setError(err.message || 'Registration failed');
    render();
  }
}

async function handleAddExpense(e) {
  e.preventDefault();
  const form = e.target;
  const amount = Number(form.amount.value);
  const category = form.category.value;
  const date = form.date.value;
  const note = form.note.value;

  try {
    setError('');
    await api.request('/expenses', {
      method: 'POST',
      body: { amount, category, date, note },
    });
    form.reset();
    await refreshAll();

    // Close modal after successful add.
    const modal = document.querySelector('#addTransactionModal');
    if (modal) modal.classList.add('hidden');
  } catch (err) {
    setError(err.message || 'Could not add expense');
    render();
  }
}

async function handleDeleteExpense(id) {
  if (!confirm('Delete this expense?')) return;
  try {
    setError('');
    await api.request(`/expenses/${id}`, { method: 'DELETE' });
    await refreshAll();
  } catch (err) {
    setError(err.message || 'Could not delete expense');
    render();
  }
}

async function handleApplyFilters(e) {
  e.preventDefault();
  const form = e.target;

  state.filters.from = form.from.value;
  state.filters.to = form.to.value;
  state.filters.category = form.category.value;
  state.filters.minAmount = form.minAmount.value;
  state.filters.maxAmount = form.maxAmount.value;
  state.filters.q = form.q.value;

  await refreshAll();
}

async function handleClearFilters() {
  state.filters = { from: '', to: '', category: '', minAmount: '', maxAmount: '', q: '' };
  await refreshAll();
}

async function handleSaveBudget(e) {
  e.preventDefault();
  const form = e.target;
  const yearMonth = form.yearMonth.value;
  const monthlyLimit = Number(form.monthlyLimit.value);
  try {
    setError('');
    await api.request('/budgets', {
      method: 'POST',
      body: { yearMonth, monthlyLimit },
    });
    await refreshAll();
  } catch (err) {
    setError(err.message || 'Could not save budget');
    render();
  }
}

function renderAuth() {
  const errorHtml = state.error
    ? `<div class="mb-4 rounded-lg border border-error/40 bg-error-container/10 p-3 text-error text-sm font-bold">${state.error}</div>`
    : '';

  const marketing = `
    <div class="max-w-md">
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-lowest border border-outline-variant/20 shadow-sm">
        <span class="material-symbols-outlined text-primary" style="font-size:18px;">auto_awesome</span>
        <span class="text-sm font-bold text-on-surface">eXpend</span>
      </div>
      <h1 class="mt-6 text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.05] text-on-surface">
        Master your <span class="text-primary">financial flow</span> with precision.
      </h1>
      <p class="mt-5 text-sm md:text-base text-on-surface-variant leading-relaxed">
        Experience the next generation of expense tracking. Minimal, ethical, and built for high-performance teams.
      </p>
    </div>
  `;

  if (state.authMode === 'register') {
    return `
      <div class="min-h-screen w-full bg-surface-container-lowest flex items-center justify-center p-6">
        <div class="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div class="hidden md:block">${marketing}</div>

          <div class="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/20 p-8 md:p-10">
            ${errorHtml}

            <h2 class="text-2xl font-extrabold text-on-surface">Create account</h2>
            <p class="text-sm text-on-surface-variant mt-1">Sign up to start tracking expenses.</p>

            <form id="registerForm" class="mt-6 space-y-4">
              <label class="block text-xs font-bold text-on-surface-variant">NAME</label>
              <input
                name="name"
                required
                class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />

              <label class="block text-xs font-bold text-on-surface-variant">EMAIL ADDRESS</label>
              <input
                name="email"
                type="email"
                required
                class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />

              <label class="block text-xs font-bold text-on-surface-variant">PASSWORD</label>
              <input
                name="password"
                type="password"
                required
                class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />

              <button
                type="submit"
                class="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary px-6 py-3.5 rounded-full font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                Sign up
              </button>
            </form>

            <div class="mt-5 text-sm text-on-surface-variant">
              Already have an account?
              <button id="switchToLogin" type="button" class="text-primary font-bold hover:underline ml-1">Log in</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // login (default)
  return `
    <div class="min-h-screen w-full bg-surface-container-lowest flex items-center justify-center p-6">
      <div class="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div class="hidden md:block">${marketing}</div>

        <div class="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/20 p-8 md:p-10">
          ${errorHtml}

          <h2 class="text-2xl font-extrabold text-on-surface">Welcome Back</h2>
          <p class="text-sm text-on-surface-variant mt-1">Log in to manage your finances.</p>

          <form id="loginForm" class="mt-6 space-y-4">
            <div class="space-y-2">
              <label class="block text-xs font-bold text-on-surface-variant">EMAIL ADDRESS</label>
              <input
                name="email"
                type="email"
                required
                class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="name@email.com"
              />
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between gap-4">
                <label class="block text-xs font-bold text-on-surface-variant">PASSWORD</label>
                <button type="button" class="text-xs font-bold text-primary hover:underline" id="forgotPasswordBtn">
                  FORGOT PASSWORD?
                </button>
              </div>
              <input
                name="password"
                type="password"
                required
                class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <button
              type="submit"
              class="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary px-6 py-3.5 rounded-full font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
            >
              Log in →
            </button>
          </form>

          <div class="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-on-surface-variant">
            <div>
              Don&apos;t have an account?
              <button id="switchToRegister" type="button" class="text-primary font-bold hover:underline ml-1">Sign up</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderDashboard() {
  const { user, expenses, summary, charts, budget } = state;
  const totalSpent = summary?.totalExpense ?? 0;

  const yearMonth = budget?.yearMonth || currentYearMonth();
  const monthlyLimit = budget?.monthlyLimit ?? 0;
  const remaining = budget ? budget.remaining : monthlyLimit - (budget?.totalExpense ?? 0);

  const percentUsed = monthlyLimit ? Math.max(0, Math.min(100, (totalSpent / monthlyLimit) * 100)) : 0;
  const percentUsedText = Math.round(percentUsed);

  const trends = charts.trends || [];
  const currentTrend = trends[trends.length - 1]?.totalExpense ?? 0;
  const prevTrend = trends[trends.length - 2]?.totalExpense ?? 0;
  const growthPct = prevTrend ? ((currentTrend - prevTrend) / prevTrend) * 100 : 0;
  const growthGood = growthPct <= 0;

  const usedDasharray = 364.4;
  const usedDashoffset = usedDasharray * (1 - percentUsed / 100);

  const navLink = (viewName, label, icon) => {
    const isActive = state.view === viewName;
    const base =
      'flex items-center gap-3 px-4 py-3 font-medium transition-colors border-l-4';
    const cls = isActive
      ? 'text-red-700 dark:text-red-400 border-red-700 dark:border-red-400 bg-white/50 dark:bg-white/5'
      : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-200 dark:hover:bg-slate-800';
    return `
      <a href="#" data-view="${viewName}" class="${base} ${cls}">
        <span class="material-symbols-outlined" data-icon="${icon}">${icon}</span>
        <span>${label}</span>
      </a>
    `;
  };

  const recentRows = expenses
    .slice(0, 10)
    .map((e) => {
      const note = e.note ? String(e.note) : '';
      const title = note ? `${e.category} - ${note}` : e.category;
      return `
        <tr class="hover:bg-surface-container-low/30 transition-colors">
          <td class="px-8 py-5">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
                <span class="material-symbols-outlined text-on-surface" style="font-size:18px;">receipt_long</span>
              </div>
              <div>
                <p class="font-bold text-on-surface">${title}</p>
                <p class="text-xs text-on-surface-variant">${formatDate(e.date)}</p>
              </div>
            </div>
          </td>
          <td class="px-8 py-5">
            <span class="px-3 py-1 rounded-full bg-tertiary-container/20 text-on-tertiary-container text-[10px] font-extrabold uppercase">
              ${e.category}
            </span>
          </td>
          <td class="px-8 py-5 text-sm text-on-surface-variant">${formatDate(e.date)}</td>
          <td class="px-8 py-5 text-right font-bold text-on-surface">${'-' + formatINR(e.amount)}</td>
        </tr>
      `;
    })
    .join('');

  const dashboardMain = `
    <div class="pb-12 px-8 max-w-7xl mx-auto space-y-8">
      <div class="flex justify-between items-end">
        <div>
          <h2 class="text-3xl font-extrabold text-on-surface tracking-tight">Financial Overview</h2>
          <p class="text-on-surface-variant mt-1">Welcome back, your spending is down ${Math.abs(growthPct).toFixed(1)}% this month.</p>
        </div>
        <button id="openExpenseModal" class="bg-gradient-to-br from-primary to-primary-container text-on-primary px-6 py-2.5 rounded-full font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
          + Add Transaction
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="md:col-span-2 bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-outline-variant/10 relative overflow-hidden group">
          <div class="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-primary/10 transition-colors"></div>
          <div class="relative z-10 flex flex-col justify-between h-full">
            <div>
              <span class="text-xs font-bold uppercase tracking-widest text-primary mb-2 block">Monthly Spending</span>
              <h3 class="text-5xl font-extrabold text-on-surface">${formatINR(totalSpent)}</h3>
            </div>
            <div class="mt-8 flex items-end justify-between">
              <div class="flex items-center gap-4">
                <div class="bg-tertiary/10 p-2 rounded-lg">
                  <span class="material-symbols-outlined text-tertiary" style="font-variation-settings: 'FILL' 1;">trending_down</span>
                </div>
                <div>
                  <p class="text-sm text-tertiary font-bold">${growthGood ? '-' : '+'}${Math.abs(growthPct).toFixed(1)}% from last month</p>
                  <p class="text-xs text-on-surface-variant">Insights based on your spending</p>
                </div>
              </div>
              <div class="flex gap-1 items-end h-12" aria-hidden="true">
                <div class="w-2 bg-primary/20 h-4 rounded-full"></div>
                <div class="w-2 bg-primary/20 h-6 rounded-full"></div>
                <div class="w-2 bg-primary/40 h-8 rounded-full"></div>
                <div class="w-2 bg-primary/30 h-5 rounded-full"></div>
                <div class="w-2 bg-primary/60 h-10 rounded-full"></div>
                <div class="w-2 bg-primary h-12 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-outline-variant/10">
          <span class="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4 block">Budget Status</span>
          <div class="flex items-center justify-center py-4">
            <div class="relative w-32 h-32">
              <svg class="w-full h-full transform -rotate-90">
                <circle class="text-surface-container" cx="64" cy="64" fill="transparent" r="58" stroke="currentColor" stroke-width="8"></circle>
                <circle cx="64" cy="64" fill="transparent" r="58"
                  stroke="currentColor" stroke-width="8"
                  class="text-primary"
                  stroke-dasharray="${usedDasharray}"
                  stroke-dashoffset="${usedDashoffset}"
                  stroke-linecap="round">
                </circle>
              </svg>
              <div class="absolute inset-0 flex flex-col items-center justify-center">
                <span class="text-2xl font-extrabold text-on-surface">${percentUsedText}%</span>
                <span class="text-[10px] text-on-surface-variant uppercase font-bold">Used</span>
              </div>
            </div>
          </div>
          <div class="mt-4 text-center">
            <p class="text-sm font-bold text-on-surface">${formatINR(monthlyLimit)} Total Limit</p>
            <p class="text-xs text-on-surface-variant mt-1">${formatINR(remaining)} Remaining</p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-surface-container-low p-8 rounded-xl flex items-center justify-between group cursor-pointer hover:bg-surface-container-high transition-colors">
          <div>
            <span class="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Cash Flow</span>
            <div class="flex items-baseline gap-2">
              <span class="text-3xl font-extrabold text-on-surface">-${formatINR(totalSpent)}</span>
              <span class="text-xs font-bold text-tertiary">${growthGood ? '-' : '+'}${Math.abs(growthPct).toFixed(1)}%</span>
            </div>
          </div>
          <div class="bg-surface-container-lowest p-4 rounded-full shadow-sm group-hover:scale-110 transition-transform">
            <span class="material-symbols-outlined text-tertiary text-3xl">account_balance</span>
          </div>
        </div>

        <div class="bg-surface-container-low p-8 rounded-xl flex items-center justify-between group cursor-pointer hover:bg-surface-container-high transition-colors">
          <div>
            <span class="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Spending Growth</span>
            <div class="flex items-baseline gap-2">
              <span class="text-3xl font-extrabold text-on-surface">${growthGood ? '-' : '+'}${Math.abs(growthPct).toFixed(1)}%</span>
              <span class="text-xs font-bold ${growthGood ? 'text-tertiary' : 'text-error'}">${growthGood ? 'Good' : 'Bad'}</span>
            </div>
          </div>
          <div class="bg-surface-container-lowest p-4 rounded-full shadow-sm group-hover:scale-110 transition-transform">
            <span class="material-symbols-outlined text-primary text-3xl">insights</span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-on-surface">Category Distribution</h3>
          </div>
          <div class="relative h-72">
            <canvas id="categoriesPie"></canvas>
          </div>
        </div>
        <div class="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-on-surface">Spending Trends</h3>
          </div>
          <div class="relative h-72">
            <canvas id="trendsLine"></canvas>
          </div>
        </div>
      </div>

      <div class="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 overflow-hidden">
        <div class="px-8 py-6 flex justify-between items-center border-b border-surface-container-low/50">
          <h3 class="text-lg font-bold text-on-surface">Recent Transactions</h3>
          <button id="goToTransactions" class="text-primary text-sm font-bold hover:underline" type="button">View all report</button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead class="bg-surface-container-low/50 text-on-surface-variant">
              <tr>
                <th class="px-8 py-4 text-xs font-bold uppercase tracking-widest">Transaction</th>
                <th class="px-8 py-4 text-xs font-bold uppercase tracking-widest">Category</th>
                <th class="px-8 py-4 text-xs font-bold uppercase tracking-widest">Date</th>
                <th class="px-8 py-4 text-xs font-bold uppercase tracking-widest text-right">Amount</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-container-low">
              ${recentRows || '<tr><td colspan="4" class="px-8 py-6 text-on-surface-variant">No transactions yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const transactionsMain = `
    <div class="pb-12 px-8 max-w-5xl mx-auto space-y-8">
      <div class="flex justify-between items-end">
        <div>
          <h2 class="text-3xl font-extrabold text-on-surface tracking-tight">Transactions</h2>
          <p class="text-on-surface-variant mt-1">Filter, search, and manage your expenses.</p>
        </div>
        <button id="openExpenseModal" class="bg-gradient-to-br from-primary to-primary-container text-on-primary px-6 py-2.5 rounded-full font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
          + Add Transaction
        </button>
      </div>

      <div class="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 p-6">
        <form id="filtersForm" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label class="block">
            <span class="text-xs font-bold text-on-surface-variant">From</span>
            <input type="date" name="from" value="${state.filters.from}" class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </label>
          <label class="block">
            <span class="text-xs font-bold text-on-surface-variant">To</span>
            <input type="date" name="to" value="${state.filters.to}" class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </label>
          <label class="block">
            <span class="text-xs font-bold text-on-surface-variant">Category</span>
            <select name="category" class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">All</option>
              ${CATEGORIES.map((c) => `<option value="${c}" ${state.filters.category === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </label>
          <label class="block">
            <span class="text-xs font-bold text-on-surface-variant">Min Amount</span>
            <input type="number" step="0.01" min="0" name="minAmount" value="${state.filters.minAmount}" class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </label>
          <label class="block">
            <span class="text-xs font-bold text-on-surface-variant">Max Amount</span>
            <input type="number" step="0.01" min="0" name="maxAmount" value="${state.filters.maxAmount}" class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </label>
          <label class="block md:col-span-2">
            <span class="text-xs font-bold text-on-surface-variant">Search</span>
            <input name="q" placeholder="keyword in note/category" value="${state.filters.q}" class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </label>
          <div class="flex gap-3 md:col-span-3">
            <button id="applyFiltersBtn" type="submit" class="bg-gradient-to-br from-primary to-primary-container text-on-primary px-6 py-2.5 rounded-full font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
              Apply Filters
            </button>
            <button id="clearFiltersBtn" type="button" class="bg-surface-container-lowest border border-outline-variant/30 px-6 py-2.5 rounded-full font-bold text-sm hover:bg-surface-container-high transition-colors">
              Clear
            </button>
          </div>
        </form>
      </div>

      <div class="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 overflow-hidden">
        <div class="px-8 py-6 flex justify-between items-center border-b border-surface-container-low/50">
          <h3 class="text-lg font-bold text-on-surface">Expense List</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead class="bg-surface-container-low/50 text-on-surface-variant">
              <tr>
                <th class="px-8 py-4 text-xs font-bold uppercase tracking-widest">Category</th>
                <th class="px-8 py-4 text-xs font-bold uppercase tracking-widest">Date</th>
                <th class="px-8 py-4 text-xs font-bold uppercase tracking-widest text-right">Amount</th>
                <th class="px-8 py-4 text-xs font-bold uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-container-low">
              ${
                expenses.length
                  ? expenses
                      .map(
                        (e) => `
                  <tr class="hover:bg-surface-container-low/30 transition-colors">
                    <td class="px-8 py-5">
                      <span class="px-3 py-1 rounded-full bg-tertiary-container/20 text-on-tertiary-container text-[10px] font-extrabold uppercase">
                        ${e.category}
                      </span>
                      <div class="text-xs text-on-surface-variant mt-1">${e.note || ''}</div>
                    </td>
                    <td class="px-8 py-5 text-sm text-on-surface-variant">${formatDate(e.date)}</td>
                    <td class="px-8 py-5 text-right font-bold text-on-surface">${'-' + formatINR(e.amount)}</td>
                    <td class="px-8 py-5 text-right">
                      <button data-action="delete-expense" data-id="${e.id}" class="text-error font-bold text-xs hover:underline">Delete</button>
                    </td>
                  </tr>
                `,
                      )
                      .join('')
                  : '<tr><td colspan="4" class="px-8 py-6 text-on-surface-variant">No expenses match your filters.</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const budgetsMain = `
    <div class="pb-12 px-8 max-w-4xl mx-auto space-y-8">
      <div class="flex justify-between items-end">
        <div>
          <h2 class="text-3xl font-extrabold text-on-surface tracking-tight">Budgets</h2>
          <p class="text-on-surface-variant mt-1">Set your monthly spending limit and track remaining balance.</p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 p-6">
          <span class="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4 block">Budget Status (${yearMonth})</span>
          <div class="flex items-center justify-center py-4">
            <div class="relative w-32 h-32">
              <svg class="w-full h-full transform -rotate-90">
                <circle class="text-surface-container" cx="64" cy="64" fill="transparent" r="58" stroke="currentColor" stroke-width="8"></circle>
                <circle cx="64" cy="64" fill="transparent" r="58"
                  stroke="currentColor" stroke-width="8"
                  class="text-primary"
                  stroke-dasharray="${usedDasharray}"
                  stroke-dashoffset="${usedDashoffset}"
                  stroke-linecap="round">
                </circle>
              </svg>
              <div class="absolute inset-0 flex flex-col items-center justify-center">
                <span class="text-2xl font-extrabold text-on-surface">${percentUsedText}%</span>
                <span class="text-[10px] text-on-surface-variant uppercase font-bold">Used</span>
              </div>
            </div>
          </div>
          <div class="mt-4 text-center">
            <p class="text-sm font-bold text-on-surface">${formatINR(monthlyLimit)} Total Limit</p>
            <p class="text-xs text-on-surface-variant mt-1">${formatINR(remaining)} Remaining</p>
          </div>
        </div>

        <div class="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 p-6">
          <h3 class="text-lg font-bold text-on-surface mb-3">Set Monthly Limit</h3>
          <form id="budgetForm" class="space-y-4">
            <input type="hidden" name="yearMonth" value="${yearMonth}" />
            <label class="block">
              <span class="text-xs font-bold text-on-surface-variant">Monthly Limit</span>
              <input type="number" step="0.01" min="0" name="monthlyLimit" value="${monthlyLimit}" required class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </label>
            <button type="submit" class="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary px-6 py-2.5 rounded-full font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
              Save Budget
            </button>
          </form>
        </div>
      </div>
    </div>
  `;

  const settingsMain = `
    <div class="pb-12 px-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h2 class="text-3xl font-extrabold text-on-surface tracking-tight">Settings</h2>
        <p class="text-on-surface-variant mt-1">Profile and account settings (not implemented in this demo).</p>
      </div>
      <div class="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 p-6 text-on-surface-variant text-sm">
        Coming soon: change password, admin controls, exports (CSV/PDF), and alerts.
      </div>
    </div>
  `;

  const mainByView =
    state.view === 'transactions' ? transactionsMain : state.view === 'budgets' ? budgetsMain : state.view === 'settings' ? settingsMain : dashboardMain;

  return `
    <aside class="w-64 h-full fixed left-0 top-0 bg-slate-100 dark:bg-slate-900 flex flex-col py-6 px-4 z-50">
      <div class="mb-10 px-2">
        <h1 class="text-lg font-bold text-slate-900 dark:text-white">eXpend</h1>
        <p class="text-xs text-on-surface-variant">Expense Tracker</p>
      </div>

      <nav class="flex-1 space-y-2">
        ${navLink('dashboard', 'Dashboard', 'dashboard')}
        ${navLink('transactions', 'Transactions', 'receipt_long')}
        ${navLink('budgets', 'Budgets', 'account_balance_wallet')}
        ${navLink('settings', 'Settings', 'settings')}
      </nav>

      <div class="mt-auto pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3 px-2">
        <div class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
          <span class="material-symbols-outlined text-on-surface" style="font-size:18px;">person</span>
        </div>
        <div>
          <p class="text-sm font-bold text-on-surface">${user?.name || ''}</p>
          <p class="text-xs text-on-surface-variant">Pro Plan</p>
        </div>
      </div>
    </aside>

    <main class="ml-64 w-[calc(100%-16rem)] min-h-screen pt-24">
      <header class="fixed top-0 right-0 w-[calc(100%-16rem)] h-16 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl z-40 flex justify-between items-center px-8 shadow-sm shadow-slate-200/50 dark:shadow-none">
        <div class="flex items-center bg-surface-container-low px-4 py-2 rounded-full w-96 group focus-within:ring-2 focus-within:ring-red-500/30 transition-all">
          <span class="material-symbols-outlined text-on-surface-variant text-lg">search</span>
          <input id="globalSearch" class="bg-transparent border-none focus:ring-0 text-sm w-full font-body placeholder:text-on-surface-variant/60" placeholder="Search transactions, budgets..." type="text" value="${state.filters.q}" />
        </div>
        <div class="flex items-center gap-6">
          <button class="relative text-on-surface-variant hover:text-primary transition-colors" type="button">
            <span class="material-symbols-outlined" data-icon="notifications">notifications</span>
            <span class="absolute top-0 right-0 w-2 h-2 bg-primary rounded-full"></span>
          </button>
          <div class="h-8 w-[1px] bg-outline-variant/20"></div>
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-on-surface">Workspace</span>
            <span class="material-symbols-outlined text-on-surface-variant text-sm">expand_more</span>
          </div>
          <button id="logoutBtn" class="ml-3 text-sm font-bold text-error hover:underline" type="button">Logout</button>
        </div>
      </header>

      ${state.error ? `<div class="max-w-4xl mx-auto mt-6 px-8"><div class="rounded-xl border border-error/40 bg-error-container/10 p-4 text-error text-sm font-bold">${state.error}</div></div>` : ''}
      ${mainByView}
    </main>

    <div id="addTransactionModal" class="fixed inset-0 z-50 hidden">
      <div class="absolute inset-0 bg-black/40"></div>
      <div class="relative w-full max-w-lg mx-auto mt-20 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/10 p-6">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-extrabold text-on-surface">Add Transaction</h3>
          <button id="closeExpenseModal" type="button" class="text-on-surface-variant hover:text-primary font-bold">Close</button>
        </div>
        <form id="expenseForm" class="space-y-4 pt-4">
          <label class="block">
            <span class="text-xs font-bold text-on-surface-variant">Amount</span>
            <input name="amount" type="number" step="0.01" min="0" required class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </label>
          <label class="block">
            <span class="text-xs font-bold text-on-surface-variant">Category</span>
            <select name="category" required class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30">
              ${CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </label>
          <label class="block">
            <span class="text-xs font-bold text-on-surface-variant">Date</span>
            <input name="date" type="date" required class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </label>
          <label class="block">
            <span class="text-xs font-bold text-on-surface-variant">Note</span>
            <input name="note" placeholder="Optional description" class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </label>
          <button type="submit" class="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary px-6 py-2.5 rounded-full font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
            Save Expense
          </button>
        </form>
      </div>
    </div>
  `;
}

function attachDashboardEvents() {
  const logoutBtn = document.querySelector('#logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      state.token = null;
      state.user = null;
      syncLocalAuth();
      state.expenses = [];
      state.summary = null;
      state.charts.byCategory = [];
      state.charts.trends = [];
      state.budget = null;
      state.error = '';
      state.view = 'dashboard';
      render();
    });
  }

  const expenseForm = document.querySelector('#expenseForm');
  if (expenseForm) expenseForm.addEventListener('submit', handleAddExpense);

  // Delete buttons (Transactions view)
  document.querySelectorAll('[data-action="delete-expense"]').forEach((btn) => {
    btn.addEventListener('click', () => handleDeleteExpense(btn.dataset.id));
  });

  // Filters (Transactions view)
  const filtersForm = document.querySelector('#filtersForm');
  if (filtersForm) {
    filtersForm.addEventListener('submit', handleApplyFilters);
    const clearBtn = document.querySelector('#clearFiltersBtn');
    if (clearBtn) clearBtn.addEventListener('click', handleClearFilters);
  }

  // Budget (Budgets view)
  const budgetForm = document.querySelector('#budgetForm');
  if (budgetForm) budgetForm.addEventListener('submit', handleSaveBudget);

  // Modal open/close
  const modal = document.querySelector('#addTransactionModal');
  const openModalBtn = document.querySelectorAll('#openExpenseModal');
  openModalBtn.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!modal) return;
      modal.classList.remove('hidden');
    });
  });
  const closeModalBtn = document.querySelector('#closeExpenseModal');
  if (closeModalBtn && modal) {
    closeModalBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }
  if (modal) {
    const overlay = modal.querySelector('div.absolute.inset-0');
    if (overlay) overlay.addEventListener('click', () => modal.classList.add('hidden'));
  }

  // Sidebar navigation
  document.querySelectorAll('a[data-view]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      state.view = link.dataset.view;
      render();
    });
  });

  // Global search (debounced)
  const globalSearch = document.querySelector('#globalSearch');
  if (globalSearch) {
    globalSearch.addEventListener('input', (e) => {
      state.filters.q = e.target.value;
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => refreshAll(), 350);
    });
  }

  // Quick nav from dashboard card header
  const goToTransactions = document.querySelector('#goToTransactions');
  if (goToTransactions) {
    goToTransactions.addEventListener('click', () => {
      state.view = 'transactions';
      render();
    });
  }
}

function renderCharts() {
  const pieCanvas = document.getElementById('categoriesPie');
  const lineCanvas = document.getElementById('trendsLine');
  const totalSpent = state.summary?.totalExpense ?? 0;
  renderCategoriesPie(pieCanvas, state.charts.byCategory, totalSpent);
  renderMonthlyTrendsLine(lineCanvas, state.charts.trends);
}

function render() {
  if (!state.token) {
    app.innerHTML = renderAuth();
    const loginForm = document.querySelector('#loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    const registerForm = document.querySelector('#registerForm');
    if (registerForm) registerForm.addEventListener('submit', handleRegister);

    const switchToRegister = document.querySelector('#switchToRegister');
    if (switchToRegister) {
      switchToRegister.addEventListener('click', () => setAuthMode('register'));
    }

    const switchToLogin = document.querySelector('#switchToLogin');
    if (switchToLogin) {
      switchToLogin.addEventListener('click', () => setAuthMode('login'));
    }

    return;
  }

  app.innerHTML = renderDashboard();
  attachDashboardEvents();
  renderCharts();
}

function initFromStorage() {
  const savedToken = localStorage.getItem('token');
  const savedUser = localStorage.getItem('user');
  if (savedToken && savedUser) {
    state.token = savedToken;
    state.user = JSON.parse(savedUser);
  }
}

initFromStorage();
render();
if (state.token) {
  // Try to fetch data immediately; if token is invalid, refreshAll will show error.
  refreshAll();
}

