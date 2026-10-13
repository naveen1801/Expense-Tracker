# Expense Tracker Project

Full-stack expense tracking app with:
- `Express` + `MySQL` backend API
- `Vite` frontend dashboard
- JWT-based authentication
- Expenses, monthly budget, filters, and chart summaries

## Tech Stack

- Backend: `Node.js`, `Express`, `mysql2`, `JWT`, `bcryptjs`
- Frontend: `Vite`, vanilla JS, `Chart.js`, Tailwind CSS
- Database: `MySQL`

## Project Structure

```text
expense Project/
├─ server.js                # API entry point
├─ setup-db.js              # Creates DB and tables from database.sql
├─ database.sql             # SQL schema
├─ src/
│  ├─ db.js
│  ├─ middleware/auth.js
│  └─ routes/
│     ├─ auth.js
│     ├─ expenses.js
│     └─ budgets.js
└─ frontend/
   ├─ package.json
   └─ src/
      ├─ main.js
      └─ utils/
```

## Prerequisites

- Node.js 18+ (recommended 20+)
- MySQL 8+ (or compatible)
- npm

## Environment Variables

Create a `.env` file in the project root:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=expense_tracker
JWT_SECRET=replace-with-a-strong-secret
PORT=4000
```

Notes:
- Keep `DB_PASSWORD` present even if it is empty.
- Frontend is configured to call backend at `http://localhost:4000/api`.

## Installation

Install backend dependencies (root):

```bash
npm install
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

## Database Setup

Initialize database and tables from `database.sql`:

```bash
npm run setup-db
```

This will:
- create the database if it does not exist
- create `users`, `expenses`, and `budgets` tables

## Run the App

Start backend API (from project root):

```bash
npm run dev
```

Start frontend (in a second terminal):

```bash
cd frontend
npm run dev
```

Default URLs:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000`

## API Overview

Base URL: `http://localhost:4000/api`

Auth:
- `POST /auth/register`
- `POST /auth/login`

Expenses (Bearer token required):
- `POST /expenses`
- `GET /expenses`
- `DELETE /expenses/:id`
- `GET /expenses/summary/basic`
- `GET /expenses/charts/categories`
- `GET /expenses/charts/trends`

Budgets (Bearer token required):
- `GET /budgets/current`
- `POST /budgets`

## Features

- User registration and login
- Add/list/delete expenses
- Filter/search expenses by date, category, amount, and keyword
- Summary by category and total spend
- Monthly trend charts
- Monthly budget with remaining balance

## Scripts

Root scripts:
- `npm run dev` - run backend with nodemon
- `npm start` - run backend with node
- `npm run setup-db` - create DB and tables

Frontend scripts:
- `npm run dev` - start Vite dev server
- `npm run build` - production build
- `npm run preview` - preview build

## Troubleshooting

- If backend fails with missing env vars, verify `.env` is in project root.
- If MySQL connection fails, verify `DB_HOST`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`.
- If frontend cannot call API, ensure backend is running on port `4000`.
