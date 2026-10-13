import Chart from 'chart.js/auto';

let pieChart = null;
let lineChart = null;

function destroyIfExists(chart) {
  if (chart) {
    chart.destroy();
  }
}

export function renderCategoriesPie(canvas, byCategory = [], total = 0) {
  destroyIfExists(pieChart);
  if (!canvas) return;

  const labels = byCategory.map((c) => c.category);
  const data = byCategory.map((c) => Number(c.total));

  pieChart = new Chart(canvas, {
    type: 'pie',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: [
            'rgba(34, 197, 94, 0.9)',
            'rgba(59, 130, 246, 0.9)',
            'rgba(168, 85, 247, 0.9)',
            'rgba(244, 63, 94, 0.9)',
            'rgba(245, 158, 11, 0.9)',
            'rgba(20, 184, 166, 0.9)',
          ],
          borderColor: 'rgba(2, 6, 23, 0.6)',
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#cbd5e1' } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = Number(ctx.parsed);
              const pct = total ? Math.round((val / total) * 100) : 0;
              return ` ₹${val.toFixed(2)} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

export function renderMonthlyTrendsLine(canvas, trends = []) {
  destroyIfExists(lineChart);
  if (!canvas) return;

  lineChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: trends.map((t) => t.yearMonth),
      datasets: [
        {
          label: 'Spending',
          data: trends.map((t) => Number(t.totalExpense)),
          borderColor: 'rgba(34, 197, 94, 0.95)',
          backgroundColor: 'rgba(34, 197, 94, 0.15)',
          pointBackgroundColor: 'rgba(34, 197, 94, 0.95)',
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#cbd5e1' } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ₹${Number(ctx.parsed.y).toFixed(2)}`,
          },
        },
      },
      scales: {
        x: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(148, 163, 184, 0.2)' } },
        y: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(148, 163, 184, 0.2)' } },
      },
    },
  });
}

